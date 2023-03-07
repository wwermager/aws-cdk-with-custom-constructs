import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { IsolatedFunction } from "./common/lambda/isolated-function";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { DatabaseVpc } from "./common/network/database-vpc";
import { AppConfig } from "./config/app-config";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as sm from "aws-cdk-lib/aws-secretsmanager";

export interface ApiStackProps extends cdk.StackProps {
  // VPC that RDS Cluster will be deployed in
  vpc: DatabaseVpc;
  // Application configuration
  config: AppConfig;
  // RDS Cluster Secret
  rdsSecret: sm.ISecret;
  // Connections object for RDS Cluster - used to add rules to the security group
  rdsConnections: ec2.Connections;
}
/*
 * Here we are deploying a REST API with 4 endpoints (POST, GET, PUT, DELETE) and a lambda function for each endpoint.
 * Additionally, we're using the secret and connections details passed to this class to configure access to RDS
 */
export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const CRUD_OPERATIONS = ["post", "get", "put", "delete"];

    // Create base REST API and name/{id} resource
    const crudAPI = new apig.RestApi(this, "crud-api");
    const nameApiResource = crudAPI.root
      .addResource("name")
      .addResource("{id}");

    CRUD_OPERATIONS.forEach((operation) => {
      // Create a new lambda function for each operation
      const isolatedApiFunction = new IsolatedFunction(
        this,
        `${operation}-lambda-function`,
        {
          handler: props.config.defaultHandler,
          code: lambda.Code.fromAsset(
            path.join(__dirname, props.config.lambdaApisDirectory, operation)
          ),
          runtime: lambda.Runtime.NODEJS_18_X,
          vpc: props.vpc,
          environment: {
            DB_SECRET_NAME: props.config.dbSecretName,
            TABLE_NAME: props.config.dbTableName,
          },
        }
      );

      // Create a new method for each operation and tie it to the lambda function
      nameApiResource.addMethod(
        operation.toUpperCase(),
        new apig.LambdaIntegration(isolatedApiFunction)
      );

      // Give lambda access to the RDS Cluster secret and allow it to connect to the database
      props.rdsSecret.grantRead(isolatedApiFunction);
      isolatedApiFunction.connections.allowTo(
        props.rdsConnections,
        ec2.Port.tcp(props.config.dbPort)
      );
    });
  }
}
