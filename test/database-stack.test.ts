import * as cdk from "aws-cdk-lib";
import { Capture, Match, Template } from "aws-cdk-lib/assertions";
import * as DatabaseStack from "../lib/database-stack";
import { AppConfig } from "../lib/config/app-config";
import {
  DescribeAvailabilityZonesCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";

const config: AppConfig = require("../lib/config/config.json");

const env = {
  account: process.env.AWS_ACCOUNT,
  region: process.env.AWS_REGION,
};

const ec2Client = new EC2Client({ region: process.env.AWS_REGION });

describe("Validate DB Stack", () => {
  const app = new cdk.App();
  const stack = new DatabaseStack.DatabaseStack(app, "database-stack", {
    env,
    config,
  });
  const template = Template.fromStack(stack);

  it("should deploy a VPC", () => {
    template.resourceCountIs("AWS::EC2::VPC", 1);
  });

  it(`should deploy public, private, and isolated subnets in our VPC`, () => {
    const vpc = template.findResources("AWS::EC2::VPC");
    const vpcRef = Object.keys(vpc)[0];

    template.hasResourceProperties("AWS::EC2::Subnet", {
      VpcId: {
        Ref: vpcRef,
      },
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: "aws-cdk:subnet-type",
          Value: "Isolated",
        }),
      ]),
    });
    template.hasResourceProperties("AWS::EC2::Subnet", {
      VpcId: {
        Ref: vpcRef,
      },
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: "aws-cdk:subnet-type",
          Value: "Private",
        }),
      ]),
    });
    template.hasResourceProperties("AWS::EC2::Subnet", {
      VpcId: {
        Ref: vpcRef,
      },
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: "aws-cdk:subnet-type",
          Value: "Public",
        }),
      ]),
    });
  });

  it("should deploy 3 subnets for each availability zone in our region.", async () => {
    const azs = await ec2Client.send(new DescribeAvailabilityZonesCommand({}));
    template.resourceCountIs(
      "AWS::EC2::Subnet",
      azs.AvailabilityZones.length * 3
    );
  });

  it("should deploy two RDS Instances", () => {
    const dbInstances = template.resourceCountIs("AWS::RDS::DBInstance", 2);
  });
});
