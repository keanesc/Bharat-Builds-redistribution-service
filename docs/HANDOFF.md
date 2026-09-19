# Person 1 handoff

## Person 2: frontend

Start from the deployed `ApiUrl` output and create `frontend/.env.local`:

```env
VITE_API_BASE_URL=<ApiUrl>
VITE_DEMO_MODE=false
```

Use the shared types and API contract. The frontend should poll `GET /listings` every five seconds and send `X-Demo-Actor` on every request.

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

## Person 1 deployment checklist

- `npx cdk synth --strict`
- `npx cdk diff`
- `npx cdk deploy`
- seed profiles and listings
- verify `/health`
- verify `GET /listings`
- verify one successful claim
- verify a second claim returns `409`
- confirm CloudWatch logs exist
- send the API URL and table names to the team
