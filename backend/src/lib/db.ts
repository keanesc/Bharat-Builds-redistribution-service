import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const baseClient = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "ap-south-1"
});

export const db = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: { removeUndefinedValues: true }
});

export const listingsTable = process.env.LISTINGS_TABLE_NAME ?? "rescue-radius-listings-dev";
export const profilesTable = process.env.PROFILES_TABLE_NAME ?? "rescue-radius-profiles-dev";
export const statusIndex = "status-deadline-index";
