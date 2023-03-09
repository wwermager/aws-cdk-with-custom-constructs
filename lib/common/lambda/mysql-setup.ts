import { IsolatedFunction } from "./isolated-function";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cr from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";
import { DatabaseVpc } from "../network/database-vpc";
import { Construct } from "constructs";
import { AuroraMysqlWithBastionHost } from "../storage/aurora-mysql-with-bastion-host";
import assert = require("assert");

export interface MysqlInitializationFunctionProps {
  // Datbase cluster to initialize
  readonly dbInfra: AuroraMysqlWithBastionHost;
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
        vpc: props.dbInfra.dbCluster.vpc as DatabaseVpc,
        securityGroups: [props.dbInfra.securityGroup],
        environment: {
          DB_SECRET_NAME: props.dbInfra.dbCluster.secret?.secretArn || "",
          TABLE_NAME: props.dbTableName,
        },
      }
    );

    assert(
      props.dbInfra.dbCluster.secret,
      "Secret was not created for DB Cluster"
    );

    props.dbInfra.dbCluster.secret.grantRead(initDbFunction);

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
            "init-db-custom-resource" // If we were to make this unique on each deployment it would run everytime (e.g. append a randomUUID)
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
    initDbCustomResource.node.addDependency(props.dbInfra);
    initDbCustomResource.node.addDependency(initDbFunction);
  }
}
