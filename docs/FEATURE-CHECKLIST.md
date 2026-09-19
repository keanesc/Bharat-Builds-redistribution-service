# RescueRadius Feature Checklist

Use this tracker during implementation and integration. Every row has exactly one accountable owner. Status values are `Not started`, `In progress`, `Partial`, `Done`, or `Blocked`. Add evidence in the final column: PR link, command output, API response, CloudWatch log reference, or screenshot.

Owners: [Keane](KEANE.md) owns infrastructure, deployment, and high-risk backend behavior; [Nikhil](NIKHIL.md) owns frontend and hosting configuration; [Anirudh](ANIRUDH.md) owns routine backend/API behavior, shared types, fixtures, seed code, and tests. Dependencies are handoffs, not shared edit ownership.

## P0 MVP Features

| Feature slice | PRD | Owner | Depends on | Status | Acceptance criteria | Evidence |
|---|---|---|---|---|---|---|
| Demo actor contract and header handling | FR-001 | Anirudh | None | Partial | `X-Demo-Actor` is required where documented and demo actor IDs/types are shared; production authentication remains out of scope. | TODO: API/error test |
| Demo role selector and role views | FR-001 | Nikhil | Anirudh’s actor IDs and role types | Partial | Restaurant, responder, and admin demo views select the correct actor without redefining shared types. | TODO: role-flow screenshot |
| Create-listing API validation and persistence | FR-002 | Anirudh | Anirudh’s shared request types; Keane’s DynamoDB primitives | Partial | Valid requests persist an `AVAILABLE` listing with location, quantity, category, packed time, deadline, and status history. | TODO: API response |
| Restaurant listing form and UX | FR-002 | Nikhil | Anirudh’s request contract | Partial | The form validates quantity/deadline, shows the safe-surplus acknowledgement, publishes, and refreshes the listing. | TODO: UI screenshot |
| Deployed create-listing smoke check | FR-002 | Keane | Anirudh’s route; Anirudh’s shared types and Nikhil’s request example | In progress | The deployed POST route accepts a valid request and returns the documented listing shape. | TODO: curl output |
| Available-listing query, radius, and expiry filtering | FR-003 | Anirudh | Anirudh’s shared listing types and fixtures; Keane’s DynamoDB primitives | Done | The API returns only available, non-expired listings within the requested radius and sorts by pickup deadline. | TODO: backend test |
| Polling and live listing feed | FR-003 | Nikhil | Anirudh’s list response; Anirudh’s shared types | Partial | The frontend refreshes every five seconds and displays the current available feed without inventing response fields. | TODO: two-session evidence |
| Deployed availability smoke check | FR-003 | Keane | Anirudh’s API and seeded data | In progress | Deployed `GET /listings` returns usable seeded records for the demo coordinates. | TODO: curl output |
| Map/list relationship visualization | FR-003 | Nikhil | Anirudh’s coordinates and radius response | Partial | Every returned listing has clear radius context; the deterministic demo visualization is labelled as such if real map tiles are not used. | TODO: frontend screenshot |
| Matching and responder ranking rules | FR-004 | Keane | Anirudh’s responder fixture shape and shared types | Partial | Ranking filters verified responders, capacity, food preference, and radius, then applies the documented remaining-time/distance behavior. | `matching.ts`: configurable deterministic clock/radius/travel speed and safe-window filtering; typecheck and manual boundary check passed 2026-09-19. Automated test requested in `HANDOFF.md`. |
| Matching data presentation/filter controls | FR-004 | Nikhil | Keane’s ranking/filter contract; Anirudh’s shared types | Not started | The responder view exposes the supported matching factors without implementing duplicate ranking logic. | TODO |
| Atomic claim conditional update | FR-005 | Keane | Anirudh’s shared claim types | Done | Exactly one concurrent claim succeeds; a later claim returns `409 Conflict`. | TODO: handler test |
| Claim-conflict and refresh UI | FR-005 | Nikhil | Keane’s 409 error shape; Anirudh’s shared types | Partial | A stale claim failure is shown clearly and the list refreshes without losing the current session state. | TODO: UI screenshot |
| Deployed concurrent-claim smoke check | FR-005 | Keane | Keane’s claim route; Anirudh’s seeded listing | In progress | Two actors attempting the same deployed claim produce one success and one `409 Conflict`. | TODO: curl output |
| Lifecycle transitions and status history | FR-006 | Keane | Anirudh’s shared status types | Partial | Backend records actor/timestamp history for claim, pickup, delivery, cancellation, and any supported reassignment. | Conditional updates and history append audited 2026-09-19; actor/history tests requested in `HANDOFF.md`; deployed response pending. |
| Status action controls | FR-006 | Nikhil | Keane’s transition routes and actor rules; Anirudh’s shared status types | Not started | The correct role sees supported pickup, delivery, and cancellation actions and receives clear conflict errors. | TODO |
| Deployed lifecycle route verification | FR-006 | Keane | Keane’s status routes; Anirudh’s shared status types | In progress | Deployed pickup, delivery, and cancellation routes produce documented responses and CloudWatch records. | TODO |
| Query-time expiry filtering | FR-007 | Anirudh | Anirudh’s listing query; expiry fixtures | Done | Expired listings are excluded from availability queries and sorted results. | TODO: expiry test |
| Claim-time stale/expiry protection | FR-007 | Keane | Keane’s conditional-write path; Anirudh’s expiry contract and tests | Done | Expired listings cannot be claimed even when the frontend has stale data. | TODO: claim test |
| Expired/stale listing UI behavior | FR-007 | Nikhil | Anirudh’s filtering response; Keane’s claim conflict response; Anirudh’s shared types | Partial | Expired items cannot be claimed and stale data results in a refresh/error state. | TODO |
| Pickup confirmation API and state | FR-008 | Keane | Anirudh’s shared confirmation types | Not started | The agreed MVP confirmation method records `PICKED_UP` and appends actor/timestamp history. | TODO |
| Pickup confirmation UI | FR-008 | Nikhil | Keane’s confirmation contract; Anirudh’s shared types | Not started | The responder/restaurant flow exposes the agreed confirmation action and displays success/failure. | TODO |
| Pickup confirmation AWS configuration | FR-008 | Keane | Anirudh’s confirmation contract | Not started | Any required API, storage, or notification resource is represented in CDK and verified before use. | TODO |
| Notification delivery infrastructure | FR-009 | Keane | Anirudh’s event list and target recipients | Not started | The selected delivery channel is configured and observable, or the deferred-MVP limitation is recorded. | TODO |
| Notification event generation and API behavior | FR-009 | Anirudh | Anirudh’s shared event types; Keane’s delivery channel contract | Not started | Claim, cancellation, near-expiry, pickup, and failure events emit the documented payloads. | TODO |
| In-app notification presentation | FR-009 | Nikhil | Anirudh’s event/response shape | Not started | Relevant users can see notification state in the UI if in-app notifications are included in the MVP. | TODO |
| Impact metrics API | FR-010 | Anirudh | Anirudh’s shared metric types and fixtures; Keane’s lifecycle responses | Partial | `/dashboard/impact` returns listed, claimed, picked-up, delivered, expired, claim-time, and pickup-success metrics accurately. | TODO: API response |
| Admin impact dashboard UI | FR-010 | Nikhil | Anirudh’s dashboard response and shared metric types | Not started | Admin view renders all documented impact metrics and handles loading/error/empty states. | TODO: dashboard screenshot |

## P1 Features

| Feature slice | PRD | Owner | Depends on | Status | Acceptance criteria | Evidence |
|---|---|---|---|---|---|---|
| Search/filter query contract | P1 | Anirudh | Anirudh’s shared query types | Not started | Supported neighbourhood, food, quantity, or time filters are documented and validated by the API. | TODO |
| Search/filter controls | P1 | Nikhil | Anirudh’s query contract and shared types | Not started | Users can apply supported filters without duplicating backend filtering rules. | TODO |
| Restaurant donation-history API | P1 | Anirudh | Anirudh’s shared history types | Not started | An authenticated/demo restaurant can retrieve its listing history and statuses. | TODO |
| Restaurant donation-history UI | P1 | Nikhil | Anirudh’s history response and shared types | Not started | Restaurant view renders previous listings, statuses, and empty/error states. | TODO |
| Responder capacity and profile data | P1 | Anirudh | Fixture format | Partial | Seeded responder capacity and preferences remain typed, validated, and available to matching logic. | TODO: fixture/test |
| Responder profile UI | P1 | Nikhil | Anirudh’s profile response | Not started | Responder can view or edit the supported capacity/profile fields. | TODO |
| Photo storage resources | P1 | Keane | Anirudh’s photo field contract | Not started | Optional image storage and access permissions are configured without exposing unrelated buckets. | TODO |
| Photo upload API/data support | P1 | Anirudh | Anirudh’s shared photo field type; Keane’s storage output | Not started | Listing contract accepts and persists the approved optional photo reference. | TODO |
| Photo upload/display UI | P1 | Nikhil | Anirudh’s photo field and Keane’s storage URL | Not started | Restaurant can attach an optional photo and responders can view it safely. | TODO |
| Share link UI | P1 | Nikhil | Existing listing identity route | Not started | A listing can be shared through a stable, safe link or the feature is explicitly deferred. | TODO |
| Admin approval data/rules | P1 | Anirudh | Anirudh’s shared role/profile types | Not started | Approval state and verification rules are represented in the backend or the seeded limitation is documented. | TODO |
| Admin approval UI | P1 | Nikhil | Anirudh’s approval contract and shared types | Not started | Admin can review and change supported approval states. | TODO |

## AWS and Integration Readiness

| Requirement slice | Owner | Depends on | Status | Acceptance criteria | Evidence |
|---|---|---|---|---|---|
| CDK synthesis | Keane | Anirudh’s handler entrypoints | Done | `npm run cdk:synth` / `npx cdk synth --strict` succeeds from a clean checkout. | `npx cdk synth --strict --output /tmp/rescue-radius-cdk-final` passed 2026-09-19; verified 9 routes, 5 log groups, 2 tables, GSI, and 3 outputs. |
| Infrastructure diff review | Keane | Current API/table contract | Blocked | `npm run cdk:diff` is reviewed for IAM, CORS, tables, indexes, logs, and destructive policies. | Named non-root `rescue-radius` AWS profile is not configured; active root identity is intentionally not used. |
| Deployed API outputs | Keane | Successful CDK deployment | Not started | API URL and table names are recorded and shared without credentials. | TODO |
| Fixture and seed implementation | Anirudh | Shared types and fixture file | Done | `npm run seed` can load responders and listings with usable relative timestamps. | TODO: code/test output |
| Deployed seed execution | Keane | Anirudh’s seed implementation and table outputs | Blocked | Deployed tables contain repeatable demo profiles and listings. | Awaiting a non-root `rescue-radius` profile, deployment outputs, and successful deployment; no seed execution has been claimed. |
| API smoke-test runbook and execution | Keane | Anirudh’s API contract and deployed outputs | In progress | Health, list, create, claim conflict, status, and dashboard routes are verified against AWS. | TODO |
| Frontend deployed-mode configuration | Nikhil | Keane’s `ApiUrl` and CORS result | Not started | Hosted frontend uses the deployed API URL and `VITE_DEMO_MODE=false`. | TODO: hosted URL |
| Frontend hosting resources | Keane | Nikhil’s build command and environment names | Not started | Hosting resource/configuration serves the built frontend and exposes only required runtime values. | TODO |
| End-to-end runbook and execution | Keane | Nikhil’s hosted URL and Anirudh’s seeded/API flow | Not started | A seeded listing is created, claimed, picked up, delivered, and reflected in the dashboard. | TODO: run record |

## Quality Gates

| Gate | Owner | Depends on | Status | Acceptance criteria | Evidence |
|---|---|---|---|---|---|
| Repository TypeScript validation | Anirudh | Nikhil and Keane workspace changes | Done | `npm run typecheck` passes for every workspace. | TODO: command output |
| Backend automated tests | Anirudh | Backend/shared implementation | Partial | `npm test` covers claim conflicts, expiry, authorization, status history, filtering, dashboard calculations, and seed determinism. | TODO: test output |
| Frontend build validation | Nikhil | Frontend implementation and shared types | Not started | `npm --workspace frontend run build` succeeds with the documented configuration shape. | TODO |
| API contract publication | Anirudh | Backend behavior | In progress | `API.md`, shared types, handlers, and route/error examples agree before Nikhil integrates. | TODO: review link |
| Security/configuration review | Keane | Current CDK and environment changes | Partial | No credentials are committed; demo identity is labelled non-production; CDK permissions and public CORS are reviewed. | Synth review 2026-09-19: health has no DynamoDB policy; listings can query only `status-deadline-index`; mutation/dashboard handlers have operation-scoped listing-table access; no profile-table grants. Wildcard CORS and `DESTROY` policies are recorded as hackathon-only in `HANDOFF.md`; diff pending. |
