import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export type VpcProps = ec2.VpcProps;
/*
 * Because the Vpc construct does not create an isolated subnet by default we are
 * explicitly definging the subnet configuration. This is required if we want to enforce that our RDS cluster is deployed
 * in an isolated subnet.
 *
 * One of each PUBLIC, PRIVATE, and PRIVATE_ISOLATED subnets will be created per AZ
 */
export class DatabaseVpc extends ec2.Vpc {
  constructor(scope: Construct, id: string, props?: VpcProps) {
    super(scope, id, {
      ...props,
      subnetConfiguration: [
        {
          cidrMask: 28,
          name: "public-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 28,
          name: "private-with-egress",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: "rds-private-subnet",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
  }
}
