import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { DatabaseVpc } from "./common/network/database-vpc";

/*
 * Deploying our custom VPC construct as part of its own stack to make it easier to reuse without the worry of cyclic
 * references
 */
export class VpcStack extends cdk.Stack {
  readonly vpc: DatabaseVpc;
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new DatabaseVpc(this, "DatabaseVpc");
  }
}
