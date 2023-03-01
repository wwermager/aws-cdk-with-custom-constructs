import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';

import {Construct} from 'constructs';
import {RdsWithBastionHost} from "./common/storage/rds-with-bastion-host";
import * as path from "path";

export class CdkWithCustomConstructsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /*
    * Using the custom construct we created in lib/common/storage/rds-with-bastion-host.ts
    * we can create a VPC with a bastion host and an isolated RDS cluster with this one construct
     */
    new RdsWithBastionHost(this, 'rds-with-bastion-host', {
        bastionHostInitScriptPath: path.join(__dirname, 'lib', 'common', 'scripts', 'rds-bastion-host-init.sh'),
        bastionhostKeyPairName: 'rds-bastion-host-key-pair',
        dbInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
        dbEngine: rds.DatabaseClusterEngine.auroraMysql({
            version: rds.AuroraMysqlEngineVersion.VER_3_02_0
        }),
        dbPort: 3306
    })
  }
}

