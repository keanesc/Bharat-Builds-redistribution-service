# Keane — Person 1: Infrastructure, Deployment, and High-Risk Backend

## Mission

Own the high-risk integration path from concurrency-sensitive domain behavior through AWS deployment. Keep the CDK stack reproducible, make deployment outputs clear to the team, and prove the deployed API works before frontend integration is declared complete.

## Owned Areas

- `../infra/` — CDK app, stack, routes, Lambda configuration, tables, indexes, outputs.
- `../backend/src/domain/{matching,status}.ts` — responder ranking, claims, expiry-at-claim, and lifecycle rules.
- `../backend/src/handlers/{claims,status}.ts` — concurrency-sensitive API behavior and actor-guarded transitions.
- `../backend/src/lib/db.ts` — DynamoDB reads, writes, conditional updates, and index access.
- `../.env.example` — documented AWS and API configuration names.
- Deployment verification and CloudWatch inspection.

The current stack already defines API Gateway HTTP API, five Lambda functions, two DynamoDB tables, the `status-deadline-index` GSI, log groups, and `ApiUrl`/table-name outputs. It is a hackathon stack with `DESTROY` removal policies; do not present it as production infrastructure.

## Exclusive Edit Boundary

Keane is the only owner of `../infra/`, deployment/environment documentation, hosting infrastructure configuration, CloudWatch verification, deployed-environment evidence, and the high-risk backend files listed above. Do not edit `../frontend/`, `../shared/`, `../fixtures/`, `../backend/src/seed.ts`, `../backend/src/handlers/health.ts`, `../backend/src/handlers/listings.ts`, `../backend/src/handlers/dashboard.ts`, `../backend/src/domain/distance.ts`, or Anirudh’s backend test files. If a high-risk change needs a shared type or fixture, request that artifact from Anirudh.

## Work Checklist

- [ ] Confirm the AWS profile, account, region (`ap-south-1`), and CDK bootstrap target.
- [ ] Implement and verify responder matching, atomic claims, claim-time expiry protection, lifecycle history, actor authorization, and pickup/delivery state in the owned backend files.
- [ ] Keep high-risk writes atomic and actor-guarded; preserve the documented API errors and status history while changing backend behavior.
- [ ] Run `npm run cdk:synth` and review that every handler route is present.
- [ ] Run `npm run cdk:diff`; inspect IAM grants, CORS, table names, log retention, and removal policies.
- [ ] Deploy with `npm run cdk:deploy` and record `ApiUrl`, `ListingsTableName`, and `ProfilesTableName`.
- [ ] Share the API URL and table names with Nikhil; share deployed route, table, index, and log findings with Anirudh without committing credentials or `.env` files.
- [ ] Seed the deployed tables with `npm run seed` after exporting the two table-name variables.
- [ ] Verify `/health`, filtered `GET /listings`, listing creation, one successful claim, and a second claim returning `409 Conflict`.
- [ ] Verify pickup/delivery routes, concurrent claims, and CloudWatch logs; Anirudh owns dashboard and notification behavior checks.

## Dependencies and Handoffs

- **To Nikhil:** provide `ApiUrl`, required frontend environment values, CORS result, and hosted-frontend configuration details.
- **To Anirudh:** provide deployed route failures, table/index requirements, CloudWatch log references, and smoke-test responses; request routine handler, contract, fixture, seed, or test changes through an explicit handoff.
- **From Anirudh:** receive shared types, API route/error definitions, environment variable names, fixture/seed prerequisites, and test cases before high-risk backend changes or deployment.
- **From Nikhil:** receive the exact frontend URL and build configuration needed for CORS or hosted integration checks.

## Definition of Done

The high-risk backend behavior is implemented and tested with Anirudh’s test/fixture handoffs, deployment is reproducible from a clean checkout, `cdk synth --strict` and `cdk diff` are reviewed, seeded data is visible through the API, the smoke-test results are recorded in [`FEATURE-CHECKLIST.md`](FEATURE-CHECKLIST.md), and the team has the exact outputs and frontend configuration values.

## Useful Commands

```bash
npm install
npm run typecheck
npm run cdk:synth
npm run cdk:diff
npm run cdk:deploy
npm run seed
```

Use `npx cdk destroy` only after the demo and submission are finished.
