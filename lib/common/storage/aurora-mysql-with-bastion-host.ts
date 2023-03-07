import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { KeyPair } from "cdk-ec2-key-pair";

import { Construct } from "constructs";
import { CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { DatabaseVpc } from "../network/database-vpc";

export interface RdsWithBastionProps {
  // Expects a VPC created with the DatabaseVpc construct
  readonly dbVpc: DatabaseVpc;
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
 * The purpose of this construct is to simplify the creation of a bastion host and RDS cluster. This will allow consumers
 * to create a bastion host, RDS Cluster, and the network connections between them with a single declaration.
 *
 */
export class AuroraMysqlWithBastionHost extends Construct {
  // Expose this class member as readonly so that other stacks can use it in their definitions
  readonly dbCluster: rds.DatabaseCluster;
  constructor(scope: Construct, id: string, props: RdsWithBastionProps) {
    super(scope, id);

    this.dbCluster = new rds.DatabaseCluster(this, "rds-database-cluster", {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_2_07_8,
      }),
      defaultDatabaseName: props.defaultDbName,
      instanceProps: {
        vpc: props.dbVpc,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T2,
          ec2.InstanceSize.SMALL
        ),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      },
      port: props.dbPort,
      instances: 2,
      removalPolicy: RemovalPolicy.DESTROY,
      credentials: rds.Credentials.fromGeneratedSecret(props.dbAdminUser, {
        secretName: props.dbSecretName,
      }),
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
      vpc: props.dbVpc,
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

    // Allow connections from bastion host to RDS cluster over configured port
    this.dbCluster.connections.allowFrom(
      dbBastionHost,
      ec2.Port.tcp(props.dbPort)
    );

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
