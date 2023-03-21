import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { KeyPair } from "cdk-ec2-key-pair";

import { Construct } from "constructs";
import { CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { DatabaseVpc } from "../network/database-vpc";

export interface RdsWithBastionProps {
  // Path to a shell script that will be executed on the bastion host
  readonly bastionHostInitScriptPath: string;
  // Name of the key pair that will be used to access the bastion host
  readonly bastionhostKeyPairName: string;
  // Port that the RDS cluster will listen on
  readonly dbPort: number;
  // Username of the admin user that will be created on the RDS cluster
  readonly dbAdminUser: string;
  // Name of the default database that will be created on the RDS cluster
  readonly defaultDbName: string;
  // Name of the secret that will be created in Secrets Manager containing RDS credentials and connection information
  readonly dbSecretName: string;
}
/*
 * This construct deploys an RDS cluster with a bastion host to allow us to connect to the database from our local machine.
 * Additionally, it creates all the networking resources and configurations to isololate our RDS cluster while
 * enabling connectivity from a bastion host or resources in the same Security Group.
 */
export class AuroraMysqlWithBastionHost extends Construct {
  // Expose this class member as readonly so that other stacks can use it in their definitions
  readonly dbCluster: rds.DatabaseCluster;
  readonly securityGroup: ec2.SecurityGroup;
  constructor(scope: Construct, id: string, props: RdsWithBastionProps) {
    super(scope, id);

    const vpc = new DatabaseVpc(this, "rds-vpc");

    // Creating a security group explicitly so that we can disable egress by default
    this.securityGroup = new ec2.SecurityGroup(this, "rds-security-group", {
      vpc,
      allowAllOutbound: false,
    });

    this.dbCluster = new rds.DatabaseCluster(this, "rds-database-cluster", {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_2_07_8,
      }),
      defaultDatabaseName: props.defaultDbName,
      instanceProps: {
        vpc,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T2,
          ec2.InstanceSize.SMALL
        ),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        securityGroups: [this.securityGroup],
      },
      port: props.dbPort,
      instances: 2,
      removalPolicy: RemovalPolicy.DESTROY,
      credentials: rds.Credentials.fromGeneratedSecret(props.dbAdminUser, {
        secretName: props.dbSecretName,
      }),
    });
    this.dbCluster.connections.allowDefaultPortInternally(
      "Allow connections to/from RDS cluster for any resource in the same security group"
    );

    /*
     * Because this security group disables egress by default we need to explicitly allow outbound HTTPS traffic
     * for Secrets Manager additionally we'll need a VPC endpoint for Secrets Manager
     */
    this.securityGroup.addEgressRule(
      this.securityGroup,
      ec2.Port.tcp(443),
      "Allow outbound HTTPS traffic for Secrets Manager"
    );
    vpc.addInterfaceEndpoint("secretsmanager-vpc-endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      securityGroups: [this.securityGroup],
      privateDnsEnabled: true,
    });

    /*
     * Cloudformation does not support creating a key pair automatically
     * therefore we use this L3 construct to create a key pair and store it in SSM
     */
    const bastionHostKeypair = new KeyPair(this, "rds-bastion-host-key-pair", {
      name: props.bastionhostKeyPairName,
      storePublicKey: true,
    });

    /*
     * Create a bastion host to access the RDS cluster, this is created in a public subnet
     */
    const dbBastionHost = new ec2.Instance(this, "rds-bastion-host", {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux({}),
      init: ec2.CloudFormationInit.fromElements(
        ec2.InitFile.fromAsset(
          "/home/ec2-user/init.sh",
          props.bastionHostInitScriptPath
        )
      ),
      keyName: bastionHostKeypair.keyPairName,
    });

    // Allow SSH connections from anywhere
    dbBastionHost.connections.allowFromAnyIpv4(ec2.Port.tcp(22));

    /*
     * Output all the details we'll need to connect to the RDS cluster
     */
    new CfnOutput(this, "keypair-private-key-secret-id", {
      value: bastionHostKeypair.privateKeyArn,
    });
    new CfnOutput(this, "bastion-host-public-ip", {
      value: dbBastionHost.instancePublicIp,
    });
    new CfnOutput(this, "rds-cluster-endpoint", {
      value: this.dbCluster.clusterEndpoint.hostname,
    });
    new CfnOutput(this, "rds-cluster-secret-id", {
      value: this.dbCluster.secret?.secretArn || "Secret not created",
    });
  }
}
