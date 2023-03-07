import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cr from "aws-cdk-lib/custom-resources";

import { Construct } from "constructs";
import { RdsWithBastionHost } from "./common/storage/rds-with-bastion-host";
import * as path from "path";
import { IsolatedFunction } from "./common/lambda/isolated-function";
import { randomUUID } from "crypto";

export class DatabaseStack extends cdk.Stack {
  readonly dbInfra: RdsWithBastionHost;
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /*
     * Using the custom construct we created in lib/common/storage/rds-with-bastion-host.ts
     * we can create a VPC with a bastion host and an isolated RDS cluster with this one construct
     */
    this.dbInfra = new RdsWithBastionHost(this, "rds-with-bastion-host", {
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
     * Deploy and invoke a lambda function that initializes the database by creating a table and inserting 10 rows
     * we'll invoke it with a CustomResource in the next step
     */
    const initDbFunction = new IsolatedFunction(
      this,
      "init-db-lambda-function",
      {
        code: lambda.Code.fromAsset(
          path.join(__dirname, "..", "lambda", "apis", "utils")
        ),
        handler: "initializeDB.handler",
        runtime: lambda.Runtime.NODEJS_18_X,
        vpc: this.dbInfra.dbVpc,
        environment: {
          DB_SECRET_NAME: this.dbInfra.dbCluster.secret?.secretName || "",
          TABLE_NAME: "mytable",
        },
      }
    );
    this.dbInfra.dbCluster.secret?.grantRead(initDbFunction);

    /*
     * AwsCustomResource is useful for doing things with the AWS APIs that are not yet available in Cloudformation or
     * CDK. Anything you might be able to do with the AWS SDK can likely be done with a custom resource. For example, in
     * this case we are using it to invoke a lambda function which connects to our RDS cluster, creates a table, and populates
     * some data.
     */
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
            Payload: "",
          },
        },
        // Give resource access to invoke lambda function
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["lambda:InvokeFunction"],
            resources: [initDbFunction.functionArn],
          }),
        ]),
      }
    );

    // We need to ensure that our lambda function and db cluster is deployed before we invoke the lambda function
    initDbCustomResource.node.addDependency(initDbFunction);
    initDbCustomResource.node.addDependency(this.dbInfra.dbCluster);

    // Provide network connectivity between lambda and RDS
    this.dbInfra.dbCluster.connections.allowFrom(
      initDbFunction,
      ec2.Port.tcp(this.dbInfra.dbCluster.clusterEndpoint.port)
    );
  }
}
