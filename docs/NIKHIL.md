# Nikhil — Person 2: Frontend and Hosting

## Mission

Turn the existing React/Vite shell into a reliable restaurant-to-responder workflow against either the deployed API or the local demo adapter. Preserve the shared API contract, make failure states visible, and provide a reachable hosted build when infrastructure is ready.

## Owned Areas

- `../frontend/src/App.tsx` — role views, listing workflow, loading and error states.
- `../frontend/src/api.ts` and `../frontend/src/mock.ts` — API and demo-mode behavior.
- `../frontend/src/styles.css` and `../frontend/vite.config.ts` — presentation and build configuration.
- Frontend hosting configuration and runtime environment values.

The current UI already has a role selector, five-second polling, a basic restaurant create form, a responder claim button, a placeholder 10 km map panel, and demo/API modes. It does not yet expose pickup/delivery controls or the impact dashboard, and the map is visual-only rather than a geographic map.

## Exclusive Edit Boundary

Nikhil is the only owner of `../frontend/` and frontend hosting configuration, including React components, API-client usage, styles, Vite settings, and frontend environment documentation. Do not edit `../backend/`, `../shared/`, `../fixtures/`, or `../infra/` to change a contract or deployment resource; request contract changes from Anirudh and complex API behavior changes from Keane.

## Work Checklist

- [ ] Keep `VITE_DEMO_MODE=true` usable for offline UI work and `false` pointed at Keane’s `VITE_API_BASE_URL`.
- [ ] Send `X-Demo-Actor` on every API request and handle non-2xx responses, including claim conflicts, without losing the current list.
- [ ] Complete the restaurant flow: validate positive quantity and deadline, show the safe-surplus acknowledgement, publish, and refresh the listing.
- [ ] Complete the responder flow: show deadline and status clearly, keep expired items out of claimable actions, and refresh after a claim.
- [ ] Add visible pickup, delivery, and cancellation actions where the API contract permits them; enforce the expected role/actor behavior in the UI.
- [ ] Add an admin impact view backed by `GET /dashboard/impact`, including listed, claimed, picked-up, delivered, expired, claim-time, and pickup-success metrics.
- [ ] Make the map/list relationship understandable on desktop and mobile. If the MVP keeps the deterministic visual map, label it honestly as a demo visualization and never imply that pins are live tiles.
- [ ] Add empty, loading, error, expired, claimed-by-someone-else, and successful-action states.
- [ ] Produce a production frontend build and configure the hosting environment with the API URL and demo flag.

## Dependencies and Handoffs

- **From Keane:** receive `ApiUrl`, CORS/hosting results, deployed frontend environment values, and the hosted URL for final checks.
- **From Anirudh:** consume shared types, routine API routes, request fields, dashboard/notification payloads, and fixture shapes; do not duplicate or redefine them in `frontend/`.
- **From Keane:** consume documented claims, matching, lifecycle, status behavior, and error payloads for the high-risk backend slices; do not duplicate domain logic in `frontend/`.
- **To Keane:** provide the exact frontend build command, required environment names, and final hosted URL.
- **To Anirudh:** report response-shape mismatches with a request, response, route, and reproduction step; do not patch backend behavior in the frontend.

## Definition of Done

The app works in both demo and deployed modes, all visible actions map to documented API routes, a second responder sees a clear claim conflict, role-specific views expose the intended MVP flow, the hosted build loads with the correct environment values, and evidence is added to [`FEATURE-CHECKLIST.md`](FEATURE-CHECKLIST.md).

## Useful Commands

```bash
npm --workspace frontend run dev
npm --workspace frontend run build
npm --workspace frontend run typecheck
```

For deployed API testing, create `frontend/.env.local` with `VITE_API_BASE_URL=<ApiUrl>` and `VITE_DEMO_MODE=false`.
