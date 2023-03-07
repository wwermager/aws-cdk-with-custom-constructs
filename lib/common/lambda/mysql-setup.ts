import { IsolatedFunction } from "./isolated-function";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cr from "aws-cdk-lib/custom-resources";
import { randomUUID } from "crypto";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { DatabaseVpc } from "../network/database-vpc";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

export interface MysqlInitializationFunctionProps {
  // Datbase cluster to initialize
  readonly dbCluster: rds.DatabaseCluster;
  // Expects a VPC that has been created with the DatabaseVpc construct
  readonly vpc: DatabaseVpc;
  // Directory containing the lambda function code
  readonly lambdaDirectory: string;
  // Name of the lambda function handler
  readonly defaultHandler: string;
  // Name of the table to create and populate
  readonly dbTableName: string;
}
/*
 * Simple construct that deploys a lambda responsible for initializing the database with a table and some data. It
 * then uses an AwsCustomResource to invoke the lambda function.
 */
export class MysqlSetup extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: MysqlInitializationFunctionProps
  ) {
    super(scope, id);
    /*
     * Deploy and invoke a lambda function that initializes the database by creating a table and inserting 10 rows
     * we'll invoke it with a CustomResource in the next step
     */
    const initDbFunction = new IsolatedFunction(
      this,
      "init-db-lambda-function",
      {
        code: lambda.Code.fromAsset(props.lambdaDirectory),
        handler: props.defaultHandler,
        runtime: lambda.Runtime.NODEJS_18_X,
        vpc: props.vpc,
        environment: {
          DB_SECRET_NAME: props.dbCluster.secret?.secretName || "",
          TABLE_NAME: props.dbTableName,
        },
      }
    );
    props.dbCluster.secret?.grantRead(initDbFunction);

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

    // In the case of custom resources, we need to explicitly define the AWS resources our function is dependent on
    initDbCustomResource.node.addDependency(initDbFunction);
    initDbCustomResource.node.addDependency(props.dbCluster);

    // Provide network connectivity between our initialization lambda function and the RDS cluster
    initDbFunction.connections.allowFrom(
      props.dbCluster.connections,
      ec2.Port.tcp(props.dbCluster.clusterEndpoint.port)
    );
  }
}
