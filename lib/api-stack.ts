import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { IsolatedFunction } from "./common/lambda/isolated-function";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { DatabaseVpc } from "./common/network/database-vpc";
import { AppConfig } from "./config/app-config";
import { AuroraMysqlWithBastionHost } from "./common/storage/aurora-mysql-with-bastion-host";

export interface ApiStackProps extends cdk.StackProps {
  // Database Infrastructure - gives us reference to vpc, security groups, and secret
  dbInfra: AuroraMysqlWithBastionHost;
  // Application configuration
  config: AppConfig;
}
/*
 * Here we are deploying a REST API with 4 endpoints (POST, GET, PUT, DELETE) and a lambda function for each endpoint.
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

    /*
     * Currently deploying the entire lambda/apis directory as a single asset for each lambda function. This was due to an
     * issue where only the init function in the database stack was getting its dependencies bundled even though the api/ops
     * directories included their own node_modules. The ideal solution would be to leverage the NodejsFunction construct
     */
    CRUD_OPERATIONS.forEach((operation) => {
      // Create a new lambda function for each operation
      const isolatedApiFunction = new IsolatedFunction(
        this,
        `${operation}-lambda-function`,
        {
          handler: `${operation}/${props.config.defaultHandler}`,
          code: lambda.Code.fromAsset(
            path.join(__dirname, props.config.lambdaApisDirectory)
          ),
          securityGroups: [props.dbInfra.securityGroup],
          runtime: lambda.Runtime.NODEJS_18_X,
          vpc: props.dbInfra.dbCluster.vpc as DatabaseVpc,
          environment: {
            DB_SECRET_NAME:
              props.dbInfra.dbCluster.secret?.secretName ||
              "SECRET_NAME_NOT_FOUND",
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
      props.dbInfra.dbCluster.secret?.grantRead(isolatedApiFunction);
    });
  }
}
