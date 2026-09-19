#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { RescueRadiusStack } from "../lib/rescue-radius-stack.js";

const app = new cdk.App();
const region = process.env.RESCUE_RADIUS_REGION ?? "ap-south-1";
const account = process.env.CDK_DEFAULT_ACCOUNT;

new RescueRadiusStack(app, "RescueRadiusStack", {
  env: { account, region },
  description: "RescueRadius hackathon serverless backend"
});
