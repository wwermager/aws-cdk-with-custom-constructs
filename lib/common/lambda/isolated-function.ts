import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from "aws-cdk-lib";

import { Construct } from "constructs";

export interface IsolatedFunctionProps extends nodejs.NodejsFunctionProps {
  readonly vpc: ec2.Vpc;
}

/*
 * This is a construct which modifies the default behavior of the aws-lambda-nodejs.NodejsFunction construct,
 * here we are enforcing that the lambda function is deployed in a VPC in a private subnet.
 * Additionally we are standardizing how we build our deployment artifacts.
 */
export class IsolatedFunction extends nodejs.NodejsFunction {
  constructor(scope: Construct, id: string, props: IsolatedFunctionProps) {
    super(scope, id, {
      ...props,
      vpc: props.vpc,
      allowPublicSubnet: false,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: true, // minify code, defaults to false
        sourceMap: true, // include source map, defaults to false
        sourceMapMode: nodejs.SourceMapMode.INLINE, // defaults to SourceMapMode.DEFAULT
        sourcesContent: false, // do not include original source into source map, defaults to true
        target: "es2020", // target environment for the generated JavaScript code
      },
    });
  }
}
