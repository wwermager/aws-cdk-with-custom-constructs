import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cr from "aws-cdk-lib/custom-resources";

import { Construct } from "constructs";
import { RdsWithBastionHost } from "./common/storage/rds-with-bastion-host";
import * as path from "path";
import { IsolatedFunction } from "./common/lambda/isolated-function";
import { randomUUID } from "crypto";

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

    /*
     * Deploy a lambda function that initializes the database by creating a table and inserting 10 rows
     * we'll invoke it with a CustomResource in the next step
     */
    const initDbFunction = new IsolatedFunction(
      this,
      "init-db-lambda-function",
      {
        entry: path.join(
          __dirname,
          "..",
          "lambda",
          "apis",
          "utils",
          "initializeDB.ts"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_18_X,
        vpc: dbInfra.dbVpc,
        environment: {
          DB_SECRET_NAME: dbInfra.dbCluster.secret?.secretName || "",
          TABLE_NAME: "mytable",
        },
      }
    );
    dbInfra.dbCluster.secret?.grantRead(initDbFunction);

    const initDbCustomResource = new cr.AwsCustomResource(
      this,
      "init-db-invoker",
      {
        onUpdate: {
          physicalResourceId: cr.PhysicalResourceId.of(
            "init-db-custom-resource-" + randomUUID()
          ),
          service: "Lambda",
          action: "invoke",
          parameters: {
            FunctionName: `${initDbFunction.functionName}`,
            Payload: '{"update": 2 }',
          },
        },
        // Give resource access to invoke lambda function
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["lambda:InvokeFunction"],
            resources: ["*"],
          }),
        ]),
      }
    );

    // We need to ensure that our lambda function and db cluster is deployed before we invoke the lambda function
    initDbCustomResource.node.addDependency(initDbFunction);
    initDbCustomResource.node.addDependency(dbInfra.dbCluster);

    // Provide network connectivity between lambda and RDS
    dbInfra.dbCluster.connections.allowFrom(
      initDbFunction,
      ec2.Port.tcp(dbInfra.dbCluster.clusterEndpoint.port)
    );

    /*
     * Deploy a lambda function and API route for each CRUD operation
     */
    const crudAPI = new apig.RestApi(this, "crud-api");
    const nameApiResource = crudAPI.root
      .addResource("name")
      .addResource("{id}");
    const crudOps = ["post", "get", "put", "delete"];
    let isolatedApiFunction: IsolatedFunction;

    crudOps.forEach((op) => {
      // Deploy lambda function
      isolatedApiFunction = new IsolatedFunction(
        this,
        `${op}-lambda-function`,
        {
          entry: path.join(__dirname, "..", "lambda", "apis", op, "index.ts"),
          handler: "handler",
          runtime: lambda.Runtime.NODEJS_18_X,
          vpc: dbInfra.dbVpc,
          environment: {
            DB_SECRET_NAME: dbInfra.dbCluster.secret?.secretName || "",
            TABLE_NAME: "mytable",
          },
        }
      );
      dbInfra.dbCluster.secret?.grantRead(isolatedApiFunction);
      // Provide network connectivity between lambdas and RDS
      dbInfra.dbCluster.connections.allowFrom(
        isolatedApiFunction,
        ec2.Port.tcp(dbInfra.dbCluster.clusterEndpoint.port)
      );

      // Add API method and associated lambda integration
      nameApiResource.addMethod(
        op.toUpperCase(),
        new apig.LambdaIntegration(isolatedApiFunction)
      );
    });
  }
}
