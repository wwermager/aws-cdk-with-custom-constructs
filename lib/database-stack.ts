import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";

import { Construct } from "constructs";
import { AuroraMysqlWithBastionHost } from "./common/storage/aurora-mysql-with-bastion-host";
import * as path from "path";
import { DatabaseVpc } from "./common/network/database-vpc";
import { AppConfig } from "./config/app-config";
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import { MysqlSetup } from "./common/lambda/mysql-setup";
import assert = require("assert");

export interface DatabaseStackProps extends cdk.StackProps {
  // VPC with private isolated subnet configured
  vpc: DatabaseVpc;
  // Application configuration
  config: AppConfig;
}

/*
 * Here we are deploying our custom construct that deploys and RDS Cluster and bastion host. Additionally, we leverage
 * the AwsCustomResource construct to invoke a lambda function we deploy that automates the creation of a table and
 * populating it with data.
 */
export class DatabaseStack extends cdk.Stack {
  readonly rdsConnections: ec2.Connections;
  readonly dbSecret: sm.ISecret;
  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    /*
     * Deploy an RDS cluster with a bastion host to allow us to connect to the database from our local machine using
     * our custom construct.
     */
    const dbInfra = new AuroraMysqlWithBastionHost(
      this,
      "rds-with-bastion-host",
      {
        dbVpc: props.vpc,
        bastionHostInitScriptPath: path.join(
          __dirname,
          props.config.bastionHostInitScriptPath
        ),
        bastionhostKeyPairName: props.config.bastionhostKeyPairName,
        dbAdminUser: props.config.dbAdminUser,
        defaultDbName: props.config.defaultDbName,
        dbSecretName: props.config.dbSecretName,
        dbPort: props.config.dbPort,
      }
    );

    assert(dbInfra.dbCluster.secret, "Secret was not created for DB Cluster");

    this.dbSecret = dbInfra.dbCluster.secret;
    this.rdsConnections = dbInfra.dbCluster.connections;

    /*
     * Deploy a lambda function that will be invoked by the AwsCustomResource construct to create a table
     * and populate it with data.
     */
    new MysqlSetup(this, "mysql-setup", {
      vpc: props.vpc,
      dbCluster: dbInfra.dbCluster,
      lambdaDirectory: path.join(
        __dirname,
        props.config.lambdaApisDirectory,
        "utils"
      ),
      defaultHandler: props.config.defaultHandler,
      dbTableName: props.config.dbTableName,
    });
  }
}
