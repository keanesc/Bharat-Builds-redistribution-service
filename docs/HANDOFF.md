# Person 1 handoff

## 2026-09-20 frontend integration pass

- Merged `origin/nikhil-frontend` into `keane-development` and replaced the prototype presentation with role-focused restaurant, responder, and admin views.
- Added the approved `GET /listings/mine` route. Restaurants receive their own listings; responders receive assigned work; admin actors receive `403 FORBIDDEN`.
- The personal-listings read model uses a paginated table scan for hackathon scale. The listings Lambda now has `dynamodb:Scan` in addition to its existing table operations.
- Frontend live and demo adapters now share whole-listing claim, terminal cancellation, actor-owned pickup/delivery, and availability-only feed semantics.
- Added frontend unit/component tests. Repository typecheck, backend tests, frontend tests, production build, and visual role-flow checks pass locally.
- The new route is represented in CDK but has not been deployed in this pass. Deployed-mode personal history requires a standard reviewed CDK deployment before final two-browser acceptance.

## 2026-09-19 Keane work pass

This pass took five bounded items: expose the existing profile handler, expose the existing notification-event handler, verify pickup confirmation behavior, verify pickup AWS wiring, and audit AWS deployment readiness.

Completed locally:

- Added dedicated profile and notification Lambdas to CDK.
- Added `GET /profiles`, `GET /profiles/{id}`, and `POST /notifications/events`; the synthesized API now has 12 routes.
- Granted the profile Lambda only `dynamodb:GetItem` and `dynamodb:Scan` on the profiles table. The notification Lambda has no DynamoDB grant.
- Added explicit one-week CloudWatch log groups for both Lambdas; the stack now has seven Lambda log groups.
- Verified actor-header pickup confirmation: the claiming actor can atomically move `CLAIMED` to `PICKED_UP`, one actor/timestamp history event is appended, and invalid state or actor returns `409 STATUS_CONFLICT`.
- `npm run typecheck`, `npm test`, `npx cdk synth --strict -o /tmp/rescue-radius-cdk.out`, and `git diff --check` pass.

Scope caveats:

- Pickup confirmation is the agreed demo actor-header action. OTP/QR confirmation is not implemented and must not be claimed as complete PRD-level OTP/QR support.
- Notification events are accepted and observable in CloudWatch, but lifecycle handlers do not emit them and there is no email, SMS, push, or in-app delivery channel yet.

## 2026-09-19 deployment record

The user explicitly authorized use of the configured root CLI identity after the non-root guardrail was raised. Account `089685042676` was bootstrapped in `ap-south-1`; strict synthesis and the full CDK diff were reviewed before a standard CloudFormation deployment. No hotswap or express mode was used.

Deployment outputs:

```text
ApiUrl=https://jyq8vxcxa2.execute-api.ap-south-1.amazonaws.com
ListingsTableName=rescue-radius-listings
ProfilesTableName=rescue-radius-profiles
```

The diff contained the expected 12 routes, two DynamoDB tables, `status-deadline-index`, seven Lambdas and log groups, and operation-scoped DynamoDB permissions. Wildcard CORS, fixed names, seven-day retention, public demo identity, and `DESTROY` policies remain hackathon-only risks.

The deployed tables were seeded with 3 responder profiles and 8 listings. Re-run the verified smoke suite with:

```bash
cd docs
AWS_PROFILE=default AWS_REGION=ap-south-1 \
  API_URL=https://jyq8vxcxa2.execute-api.ap-south-1.amazonaws.com \
  ./scripts/verify-deployed-api.sh
```

The live suite passed on 2026-09-19. It created listing `6347f883-b36d-43dc-be87-eef56ff949a7`, produced one concurrent claim winner and one `409 CLAIM_CONFLICT`, completed pickup and delivery, cancelled separate listing `cbf93504-6dac-4d82-9805-2272cdc4f771`, verified dashboard metrics, found all seven log groups, and observed post-run logs for health, listings, claims, status, and dashboard.

## Person 2: frontend

Create `frontend/.env.local` using the deployed output:

```env
VITE_API_BASE_URL=https://jyq8vxcxa2.execute-api.ap-south-1.amazonaws.com
VITE_DEMO_MODE=false
```

Use the shared types and API contract. The frontend should poll `GET /listings` every five seconds and send `X-Demo-Actor` on every request.

The deployed API is live and the API smoke suite passes. The profile routes are deployed; notification delivery remains a deferred integration.

For UI-only work, set `VITE_DEMO_MODE=true`.

## Person 3: backend and operations

Backend business logic belongs under `backend/src/domain/`. Seed data is in `fixtures/demo.json`.

Use these commands:

```bash
npm run typecheck
npm test
npm run seed
```

The key backend acceptance cases are:

1. only available, non-expired listings are returned;
2. a second claim receives `409 Conflict`;
3. cancelled listings can be returned to availability only if the workflow explicitly supports reassignment;
4. pickup and delivery require the claiming actor;
5. dashboard counts are calculated from listing status and history.

Anirudh follow-up: update `API.md` so profile and notification routes are described as CDK-wired but not yet deployed. Keep the notification limitation explicit: the endpoint logs a validated event, but claim/cancel/pickup flows do not emit events and no end-user delivery channel exists.

## Person 1 deployment checklist

- [x] `npx cdk synth --strict` using a temporary output directory
- [x] bootstrap account `089685042676` in `ap-south-1`
- [x] `npx cdk diff` and review the full changeset
- [x] `npx cdk deploy`
- [x] seed profiles and listings
- [x] verify `/health`
- [x] verify `GET /listings`
- verify `GET /profiles` and `GET /profiles/{id}`
- [x] verify one successful claim
- [x] verify a second claim returns `409`
- [x] verify pickup and delivery with the claiming actor
- verify `POST /notifications/events` reaches its CloudWatch log group
- [x] confirm CloudWatch logs exist and invoked groups receive records
- [x] record the API URL and table names for the team

## Keane to Anirudh: high-risk backend test request

Please add focused backend tests in Anirudh's owned test files for:

1. matching eligibility at the radius, capacity, food-preference, verification, expiry, and travel-window boundaries;
2. deterministic matching with an injected current time and travel speed;
3. two concurrent claims producing exactly one success and one `409 CLAIM_CONFLICT`;
4. rejection of a claim at or after the pickup deadline;
5. rejection of pickup, delivery, or cancellation by an actor other than `claimedBy`;
6. successful claim, pickup, delivery, and cancellation appending the expected actor and timestamp to `statusHistory`.

Keane will address failures in the owned matching, status, claim, or DynamoDB files rather than changing Anirudh's tests.

## Deployment and security guardrails

- Do not deploy with the currently active root AWS identity. Configure and verify a named, non-root `rescue-radius` profile for `ap-south-1` first.
- Run strict synthesis and review `cdk diff` before deployment; do not use hotswap or express deployment modes.
- Wildcard CORS, fixed table names, seven-day log retention, and `DESTROY` removal policies are hackathon-only choices and must not be represented as production-safe defaults.
