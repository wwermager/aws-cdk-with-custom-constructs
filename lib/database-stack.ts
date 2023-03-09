import * as cdk from "aws-cdk-lib";

import { Construct } from "constructs";
import { AuroraMysqlWithBastionHost } from "./common/storage/aurora-mysql-with-bastion-host";
import * as path from "path";
import { AppConfig } from "./config/app-config";
import { MysqlSetup } from "./common/lambda/mysql-setup";

export interface DatabaseStackProps extends cdk.StackProps {
  config: AppConfig;
}

/*
 * Here we are deploying our custom construct that deploys and RDS Cluster and bastion host. Additionally, we leverage
 * a custom construct to deploy a lambda that will initialize the database with a table and some data.
 */
export class DatabaseStack extends cdk.Stack {
  readonly dbInfra: AuroraMysqlWithBastionHost;
  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    /*
     * Deploy an RDS cluster with a bastion host to allow us to connect to the database from our local machine using
     * our custom construct.
     */
    this.dbInfra = new AuroraMysqlWithBastionHost(
      this,
      "rds-with-bastion-host",
      {
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

    /*
     * Deploy a lambda function that will be invoked by the AwsCustomResource construct to create a table
     * and populate it with data.
     */
    new MysqlSetup(this, "mysql-setup", {
      dbInfra: this.dbInfra,
      lambdaDirectory: path.join(__dirname, props.config.lambdaApisDirectory),
      defaultHandler: `utils/${props.config.defaultHandler}`,
      dbTableName: props.config.dbTableName,
    });
  }
}
