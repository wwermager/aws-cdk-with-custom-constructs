import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";

import { Construct } from "constructs";
import { DatabaseVpc } from "../network/database-vpc";

export interface IsolatedFunctionProps extends lambda.FunctionProps {
  // Expects a VPC that has been created with the DatabaseVpc construct
  readonly vpc: DatabaseVpc;
}

/*
 * Customizing the lambda.Function construct to enforce that any function we deploy is deployed in our custom VPC
 * and that it is in a private subnet.
 */
export class IsolatedFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props: IsolatedFunctionProps) {
    super(scope, id, {
      ...props,
      vpc: props.vpc,
      allowPublicSubnet: false,
      timeout: cdk.Duration.seconds(30),
      allowAllOutbound: false,
    });
  }
}
