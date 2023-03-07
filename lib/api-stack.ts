import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { IsolatedFunction } from "./common/lambda/isolated-function";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { RdsWithBastionHost } from "./common/storage/rds-with-bastion-host";
import * as path from "path";

export interface ApiStackProps extends cdk.StackProps {
  readonly dbInfra: RdsWithBastionHost;
}

/*
 * This stack highlights the power of being able to deploy multiple pieces of infrastructure using a simple
 * foreach loop.
 *
 * Here we are deploying a REST API with 4 endpoints (POST, GET, PUT, DELETE) and a lambda function for each endpoint.
 */
export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const CRUD_OPERATIONS = ["post", "get", "put", "delete"];

    const crudAPI = new apig.RestApi(this, "crud-api");
    const nameApiResource = crudAPI.root
      .addResource("name")
      .addResource("{id}");

    let isolatedApiFunction: IsolatedFunction;

    CRUD_OPERATIONS.forEach((operation) => {
      // Deploy lambda function
      isolatedApiFunction = new IsolatedFunction(
        this,
        `${operation}-lambda-function`,
        {
          handler: "index.handler",
          code: lambda.Code.fromAsset(
            path.join(__dirname, "..", "lambda", "apis", operation)
          ),
          runtime: lambda.Runtime.NODEJS_18_X,
          vpc: props.dbInfra.dbVpc,
          environment: {
            DB_SECRET_NAME: props.dbInfra.dbCluster.secret?.secretName || "",
            TABLE_NAME: "mytable",
          },
        }
      );

      // Allow lambda function access to read DB secret
      props.dbInfra.dbCluster.secret?.grantRead(isolatedApiFunction);

      // Provide network connectivity between lambdas and RDS
      props.dbInfra.dbCluster.connections.allowFrom(
        isolatedApiFunction,
        ec2.Port.tcp(props.dbInfra.dbCluster.clusterEndpoint.port)
      );

      // Add API method and associated lambda integration
      nameApiResource.addMethod(
        operation.toUpperCase(),
        new apig.LambdaIntegration(isolatedApiFunction)
      );
    });
  }
}
