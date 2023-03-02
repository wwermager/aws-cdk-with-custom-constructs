import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apig from "aws-cdk-lib/aws-apigateway";

import { Construct } from "constructs";
import { RdsWithBastionHost } from "./common/storage/rds-with-bastion-host";
import * as path from "path";
import { IsolatedFunction } from "./common/lambda/isolated-function";

export class DatabaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /*
     * Using the custom construct we created in lib/common/storage/rds-with-bastion-host.ts
     * we can create a VPC with a bastion host and an isolated RDS cluster with this one construct
     */
    const dbInfra = new RdsWithBastionHost(this, "rds-with-bastion-host", {
      bastionHostInitScriptPath: path.join(
        __dirname,
        "scripts",
        "rds-bastion-host-init.sh"
      ),
      bastionhostKeyPairName: "rds-bastion-host-key-pair",
      dbInstanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.SMALL
      ),
      dbEngine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_2_07_8,
      }),
      dbAdminUser: "myadmin",
      defaultDbName: "mydb",
      dbPort: 3306,
    });

    const crudAPI = new apig.RestApi(this, "crud-api");
    const nameApiResource = crudAPI.root.addResource("name");
    const crudOps = ["post", "get", "put", "delete"];
    let isolatedApiFunction: IsolatedFunction;

    /*
     * Deploy a lambda function and API route for each CRUD operation
     */
    crudOps.forEach((op) => {
      isolatedApiFunction = new IsolatedFunction(
        this,
        `${op}-lambda-function`,
        {
          code: lambda.Code.fromAsset(
            path.join(__dirname, "..", "lambda", "api", op)
          ),
          handler: "index.handler",
          runtime: lambda.Runtime.NODEJS_18_X,
          vpc: dbInfra.dbVpc,
          environment: {
            DB_SECRET_NAME: dbInfra.dbCluster.secret?.secretName || "",
          },
        }
      );
      nameApiResource.addMethod(
        op.toUpperCase(),
        new apig.LambdaIntegration(isolatedApiFunction)
      );
    });
  }
}
