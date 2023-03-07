import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from "aws-cdk-lib";

import { Construct } from "constructs";
import * as path from "path";

export interface IsolatedFunctionProps extends lambda.FunctionProps {
  readonly vpc: ec2.Vpc;
}

/*
 * This is a construct which modifies the default behavior of the aws-lambda-nodejs.NodejsFunction construct,
 * here we are enforcing that the lambda function is deployed in a VPC in a private subnet.
 */
export class IsolatedFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props: IsolatedFunctionProps) {
    super(scope, id, {
      ...props,
      vpc: props.vpc,
      allowPublicSubnet: false,
      timeout: cdk.Duration.seconds(30),
    });
  }
}
