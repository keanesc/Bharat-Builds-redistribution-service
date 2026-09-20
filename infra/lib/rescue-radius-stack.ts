import * as path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import { aws_apigatewayv2 as apigatewayv2, aws_apigatewayv2_integrations as integrations, aws_dynamodb as dynamodb, aws_iam as iam, aws_logs as logs, aws_lambda as lambda, aws_lambda_nodejs as nodejs } from "aws-cdk-lib";
import { Construct } from "constructs";

export class RescueRadiusStack extends cdk.Stack {
  public constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const listingsTable = new dynamodb.Table(this, "ListingsTable", {
      tableName: "rescue-radius-listings",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    listingsTable.addGlobalSecondaryIndex({
      indexName: "status-deadline-index",
      partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "pickupDeadline", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    const profilesTable = new dynamodb.Table(this, "ProfilesTable", {
      tableName: "rescue-radius-profiles",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const commonFunctionProps: Omit<nodejs.NodejsFunctionProps, "entry"> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling: {
        minify: false,
        sourceMap: true,
        target: "node22"
      },
      environment: {
        LISTINGS_TABLE_NAME: listingsTable.tableName,
        PROFILES_TABLE_NAME: profilesTable.tableName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1"
      }
    };

    const currentDirectory = dirname(fileURLToPath(import.meta.url));
    const backendHandlers = path.join(currentDirectory, "../../backend/src/handlers");
    const health = new nodejs.NodejsFunction(this, "HealthFunction", {
      ...commonFunctionProps,
      functionName: "rescue-radius-health",
      entry: path.join(backendHandlers, "health.ts")
    });
    const listings = new nodejs.NodejsFunction(this, "ListingsFunction", {
      ...commonFunctionProps,
      functionName: "rescue-radius-listings",
      entry: path.join(backendHandlers, "listings.ts")
    });
    const claims = new nodejs.NodejsFunction(this, "ClaimsFunction", {
      ...commonFunctionProps,
      functionName: "rescue-radius-claims",
      entry: path.join(backendHandlers, "claims.ts")
    });
    const status = new nodejs.NodejsFunction(this, "StatusFunction", {
      ...commonFunctionProps,
      functionName: "rescue-radius-status",
      entry: path.join(backendHandlers, "status.ts")
    });
    const dashboard = new nodejs.NodejsFunction(this, "DashboardFunction", {
      ...commonFunctionProps,
      functionName: "rescue-radius-dashboard",
      entry: path.join(backendHandlers, "dashboard.ts")
    });
    const profiles = new nodejs.NodejsFunction(this, "ProfilesFunction", {
      ...commonFunctionProps,
      functionName: "rescue-radius-profiles",
      entry: path.join(backendHandlers, "profiles.ts")
    });
    const notifications = new nodejs.NodejsFunction(this, "NotificationsFunction", {
      ...commonFunctionProps,
      functionName: "rescue-radius-notifications",
      entry: path.join(backendHandlers, "notifications.ts")
    });

    // Keep each Lambda role scoped to the DynamoDB operations its handler uses.
    // Health is intentionally data-free and receives no DynamoDB permissions.
    listings.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Scan"],
      resources: [listingsTable.tableArn]
    }));
    listings.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [`${listingsTable.tableArn}/index/status-deadline-index`]
    }));
    claims.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [listingsTable.tableArn]
    }));
    status.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [listingsTable.tableArn]
    }));
    dashboard.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan"],
      resources: [listingsTable.tableArn]
    }));
    profiles.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem", "dynamodb:Scan"],
      resources: [profilesTable.tableArn]
    }));

    for (const fn of [health, listings, claims, status, dashboard, profiles, notifications]) {
      new logs.LogGroup(this, `${fn.node.id}LogGroup`, {
        logGroupName: `/aws/lambda/${fn.functionName}`,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      });
    }

    const api = new apigatewayv2.HttpApi(this, "HttpApi", {
      apiName: "rescue-radius-api",
      corsPreflight: {
        allowHeaders: ["content-type", "x-demo-actor"],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowOrigins: ["*"]
      }
    });

    api.addRoutes({
      path: "/health",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("HealthIntegration", health)
    });
    api.addRoutes({
      path: "/listings",
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("ListingsIntegration", listings)
    });
    api.addRoutes({
      path: "/listings/mine",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("MyListingsIntegration", listings)
    });
    api.addRoutes({
      path: "/listings/{id}",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("ListingByIdIntegration", listings)
    });
    api.addRoutes({
      path: "/listings/{id}/claim",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("ClaimIntegration", claims)
    });
    for (const action of ["cancel", "pickup", "deliver"]) {
      api.addRoutes({
        path: `/listings/{id}/${action}`,
        methods: [apigatewayv2.HttpMethod.POST],
        integration: new integrations.HttpLambdaIntegration(`${action}Integration`, status)
      });
    }
    api.addRoutes({
      path: "/dashboard/impact",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("DashboardIntegration", dashboard)
    });
    api.addRoutes({
      path: "/profiles",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("ProfilesIntegration", profiles)
    });
    api.addRoutes({
      path: "/profiles/{id}",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("ProfileByIdIntegration", profiles)
    });
    api.addRoutes({
      path: "/notifications/events",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("NotificationsIntegration", notifications)
    });

    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "ListingsTableName", { value: listingsTable.tableName });
    new cdk.CfnOutput(this, "ProfilesTableName", { value: profilesTable.tableName });
  }
}
