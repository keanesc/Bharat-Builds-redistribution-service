# Anirudh — Person 3: Backend, Shared Types, Fixtures, Seed, and Tests

## Mission

Own routine backend/API behavior and the shared verification layer around Keane’s high-risk implementation. Keep types, fixtures, seed behavior, and automated tests aligned so the domain is safe to integrate and the demo is repeatable.

## Owned Areas

- `../backend/src/domain/distance.ts` — distance calculations used by availability queries.
- `../backend/src/handlers/{listings,dashboard,health}.ts` — routine API behavior, availability, and metrics.
- `../backend/src/handlers/notifications.ts` when added — notification event generation and payload behavior.
- `../backend/src/seed.ts` and `../fixtures/demo.json` — repeatable demo data.
- `../shared/src/` — API routes and TypeScript types consumed by backend and frontend.
- `../backend/src/**/*.test.ts` — automated backend/domain verification.

The current backend implements listing creation/filtering, conditional claims, actor-guarded status routes, expiry filtering, dashboard aggregation, Haversine distance, and a responder-ranking helper. Keane owns concurrency-sensitive claims, lifecycle, matching, and DynamoDB primitives; Anirudh owns routine listing/query/API behavior plus contracts, fixtures, seed behavior, and tests.

## Exclusive Edit Boundary

Anirudh is the only owner of `../shared/`, `../fixtures/`, `../backend/src/seed.ts`, `../backend/src/domain/distance.ts`, `../backend/src/handlers/listings.ts`, `../backend/src/handlers/dashboard.ts`, `../backend/src/handlers/health.ts`, any notification-event handler, and backend test files. Keane owns the high-risk backend files listed in `KEANE.md`; do not edit those files to resolve a failing test. Do not edit `../frontend/` or `../infra/`; publish contract or fixture changes and hand them off instead.

## Work Checklist

- [ ] Implement listing validation/persistence, availability queries, radius filtering, and query-time expiry filtering in the owned routine handlers.
- [ ] Implement dashboard metric calculation/API, notification event generation, and secondary API slices such as search, history, photos, and approvals.
- [ ] Keep `../shared/src/types.ts`, `../shared/src/api-contracts.ts`, and `API.md` synchronized with both owners’ implementations; publish the contract for Nikhil to consume rather than editing frontend code.
- [ ] Keep `fixtures/demo.json` within the 10 km Bengaluru demo story, including near-expiry and incompatible-capacity examples.
- [ ] Keep `backend/src/handlers/health.ts` and shared error/route definitions stable for deployment.
- [ ] Add focused tests for listing validation, radius/query expiry, 409 conflicts, claim-time expiry, actor authorization, status history, dashboard calculations, and seed determinism; report high-risk implementation failures to Keane.

## Dependencies and Handoffs

- **To Nikhil:** provide shared types, route/method definitions, request and response examples, status values, and error payloads before UI integration.
- **To Keane:** provide shared types, route/error definitions, fixture/seed prerequisites, and claim/lifecycle smoke-test cases before high-risk backend changes are merged.
- **From Nikhil:** receive request/response mismatch reports with concrete reproduction details; patch shared types yourself and route complex backend fixes to Keane.
- **From Keane:** receive deployed responses, conditional-write failures, table/index errors, and CloudWatch references; turn confirmed contract issues into shared-type, routine-handler, or test updates.

## Definition of Done

`npm run typecheck` and `npm test` pass, the shared API contract matches both backend slices, seeded data can be loaded repeatedly, all P0 backend acceptance cases have automated or documented smoke coverage, and evidence is recorded in [`FEATURE-CHECKLIST.md`](FEATURE-CHECKLIST.md).

## Useful Commands

```bash
npm run typecheck
npm test
npm run seed
npm --workspace backend run test
```
