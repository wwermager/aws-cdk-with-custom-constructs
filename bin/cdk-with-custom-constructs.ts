#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DatabaseStack } from "../lib/database-stack";
import { ApiStack } from "../lib/api-stack";
import { AppConfig } from "../lib/config/app-config";

const config: AppConfig = require("../lib/config/config.json");

const app = new cdk.App();
/*
 * Configuration for the environment in which we want to deploy our stacks. If environment configs are different between
 * stacks it is likely there will be additional configuration that is needed.
 */
const env = {
  account: process.env.AWS_ACCOUNT,
  region: process.env.AWS_REGION,
};

// Core DB Infrastructure and Setup
const dbStack = new DatabaseStack(app, "DatabaseStack", {
  env,
  config,
});

// Lambda Backed API Stack - CRUD APIs
new ApiStack(app, "ApiStack", {
  env,
  config,
  dbInfra: dbStack.dbInfra,
});
