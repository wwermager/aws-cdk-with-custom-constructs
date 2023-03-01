import * as rds from 'aws-cdk-lib/aws-rds'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import {KeyPair} from 'cdk-ec2-key-pair'

import {Construct} from "constructs";
import {RemovalPolicy} from "aws-cdk-lib";


export interface RdsWithBastionProps {
    readonly bastionHostInitScriptPath: string,
    readonly bastionhostKeyPairName: string,
    readonly dbInstanceType: ec2.InstanceType,
    readonly dbPort: number,
    readonly dbEngine: rds.IClusterEngine,
}
/*
    * This is a construct (pattern) that creates a VPC with a bastion host and an isolated RDS cluster
    * The bastion host is the only way to access the RDS cluster, and the DatabaseCluster construct enforces
    * a minimum of 2 instances in the cluster for availability
 */
export class RdsWithBastionHost extends Construct {

    readonly dbVpc: ec2.Vpc // allow this to be consumed so we can add other resources to the VPC
    readonly dbBastionHost: ec2.Instance // single entry point to the RDS cluster
    readonly dbCluster: rds.DatabaseCluster // isolated RDS cluster
    readonly bastionHostKeyPair: KeyPair // allow this to be consumed so we can allow iam users in other stacks to access the keypair
    constructor(scope: Construct, id: string, props: RdsWithBastionProps) {
        super(scope, id);

        /*
        * Create a VPC with a public and private subnet per AZ in deployment region
        * Because the Vpc construct does not create an isolated subnet by default we are
        * explicitly definging the subnet configuration
        *
        * One of each PUBLIC, PRIVATE, and PRIVATE_ISOLATED subnets will be created per AZ
         */
        this.dbVpc = new ec2.Vpc(this,'rds-vpc', {
            subnetConfiguration: [
                {
                    cidrMask: 28,
                    name: 'public-subnet',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 28,
                    name: 'private-with-egress',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
                {
                    cidrMask: 28,
                    name: 'rds-private-subnet',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED
                }
            ],
        })

        /*
        * Create an isolated RDS cluster
         */
        this.dbCluster = new rds.DatabaseCluster(this, 'rds-database-cluster', {
            engine: props.dbEngine,
            instanceProps: {
                vpc: this.dbVpc,
                instanceType: props.dbInstanceType,
                vpcSubnets: {
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED
                }
            },
            port: props.dbPort,
            instances: 2,
            removalPolicy: RemovalPolicy.DESTROY
        })


        /*
        * Cloudformation does not support adding a key pair to an instance automatically
        * therefore we use this construct to create a key pair and store it in SSM
         */
        this.bastionHostKeyPair = new KeyPair(this, 'rds-bastion-host-key-pair', {
            name: props.bastionhostKeyPairName,
            storePublicKey: true,
        })

        // /*
        //     * Create a role for the bastion host to assume
        //  */
        // const bastionHostRole = new iam.Role(this, 'rds-bastion-host-role', {
        //     assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        // });
        //
        // /*
        //     * Grant the bastion host access to the key pair, we will use AWS cli to get this secret
        //     * and configure our keypair on the bastion host
        //  */
        // this.bastionHostKeyPair.grantReadOnPrivateKey(bastionHostRole)
        // this.bastionHostKeyPair.grantReadOnPublicKey(bastionHostRole);

        /*
        * Create a bastion host to access the RDS cluster, this is created in a public subnet
         */
        this.dbBastionHost = new ec2.Instance(this, 'rds-bastion-host', {
            vpc: this.dbVpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC
            },
            // role: bastionHostRole,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2,ec2.InstanceSize.MICRO),
            machineImage: ec2.MachineImage.latestAmazonLinux({}),
            init: ec2.CloudFormationInit.fromElements(
                ec2.InitFile.fromAsset('/home/ec2-user/init.sh', props.bastionHostInitScriptPath),
            ),
            keyName: this.bastionHostKeyPair.keyPairName,
        })

        // Allow connections from bastion host to RDS cluster over configured port
        this.dbCluster.connections.allowFrom(this.dbBastionHost.connections, ec2.Port.tcp(props.dbPort))
    }
}