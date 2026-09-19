# RescueRadius

Expiry-aware surplus-food dispatch for Bengaluru. This repository contains the Ship It MVP for the Bharat Builds hackathon.

## Architecture

```text
Amplify Hosting
      ↓
API Gateway HTTP API
      ↓
Lambda
      ↓
DynamoDB
      ↓
CloudWatch
```

The MVP uses seeded demo actors, five-second polling, and Haversine distance calculations. Cognito, AppSync, SNS, Amazon Location, and AI are intentionally deferred.

## Prerequisites

- Node.js 20+
- npm
- AWS CLI v2
- AWS CDK v2, installed through the repository dependencies
- An AWS account or hackathon credits

Configure AWS credentials:

```bash
aws configure --profile rescue-radius
export AWS_PROFILE=rescue-radius
export AWS_REGION=ap-south-1
export RESCUE_RADIUS_REGION=ap-south-1
aws sts get-caller-identity
```

Bootstrap CDK once per account and region:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap aws://${ACCOUNT_ID}/ap-south-1
```

## Install and validate

From the repository root:

```bash
npm install
npm run typecheck
npm test
```

## Deploy the backend

```bash
npm run cdk:synth
npm run cdk:diff
npm run cdk:deploy
```

Copy the `ApiUrl`, `ListingsTableName`, and `ProfilesTableName` outputs.

## Seed demo data

Set the table names from the CDK outputs:

```bash
export LISTINGS_TABLE_NAME=rescue-radius-listings
export PROFILES_TABLE_NAME=rescue-radius-profiles
npm run seed
```

The seed is deterministic and can be run repeatedly. Listing timestamps are generated relative to the current time so the demo data remains usable.

## Run the frontend

Create `frontend/.env.local`:

```env
VITE_API_BASE_URL=https://your-api-id.execute-api.ap-south-1.amazonaws.com
VITE_DEMO_MODE=false
```

Then run:

```bash
npm --workspace frontend run dev
```

For offline UI work, use:

```env
VITE_DEMO_MODE=true
```

## API smoke tests

```bash
API_URL="https://your-api-id.execute-api.ap-south-1.amazonaws.com"

curl "$API_URL/health"
curl "$API_URL/listings?latitude=12.9352&longitude=77.6245&radiusKm=10"
```

Create a listing:

```bash
curl -X POST "$API_URL/listings" \
  -H 'content-type: application/json' \
  -H 'x-demo-actor: restaurant-001' \
  -d '{
    "restaurantId":"restaurant-001",
    "restaurantName":"Koramangala Kitchen",
    "foodDescription":"Packed rice and dal meals",
    "quantityMeals":20,
    "foodCategory":"VEG",
    "latitude":12.9352,
    "longitude":77.6245,
    "packedAt":"2026-09-19T12:00:00Z",
    "pickupDeadline":"2026-09-19T13:00:00Z"
  }'
```

Claim a listing:

```bash
curl -X POST "$API_URL/listings/listing-001/claim" \
  -H 'x-demo-actor: responder-001'
```

The second claim attempt should return `409 Conflict`.

## Team handoff

- Person 1 owns `infra/` and deployment.
- Person 2 owns `frontend/` and Amplify Hosting.
- Person 3 owns `backend/`, `shared/`, `fixtures/`, and tests.

The API contract is documented in [docs/API.md](docs/API.md). The complete product requirements are in [docs/PRD-RescueRadius.md](docs/PRD-RescueRadius.md).

## Cleanup

The CDK stack uses disposable hackathon resources. To remove it after the event:

```bash
npx cdk destroy
```

Do not run cleanup until the demo, video, and submission are complete.
