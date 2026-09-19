# Repository Guidelines

## Project Structure & Module Organization

RescueRadius is a TypeScript npm-workspaces monorepo:

- `frontend/` contains the React/Vite user interface and API client.
- `backend/` contains Lambda handlers, domain logic, DynamoDB access, and demo seeding.
- `shared/` contains types and API route constants used by both application layers.
- `infra/` contains the AWS CDK stack and deployment entrypoint.
- `fixtures/demo.json` contains deterministic demo profiles and listings.
- `docs/` contains the API contract, product requirements, and team handoff notes.

Keep business rules in `backend/src/domain/`; keep AWS wiring in handlers and `backend/src/lib/`.

## Build, Test, and Development Commands

Run commands from the repository root after `npm install` (Node.js 20+):

```bash
npm run typecheck                 # Type-check every workspace
npm test                          # Run backend tests
npm run build                     # Build/check all workspaces
npm --workspace frontend run dev  # Start the Vite development server
npm run cdk:synth                 # Validate the CDK template
npm run cdk:diff                  # Review infrastructure changes
npm run cdk:deploy                # Deploy the AWS stack
npm run seed                      # Seed configured DynamoDB tables
```

Use `frontend/.env.local` for local frontend settings; set `VITE_DEMO_MODE=true` for offline UI work. Never commit `.env` files or credentials.

## Coding Style & Naming Conventions

Use strict TypeScript with two-space indentation, semicolons, double-quoted strings, and explicit types where they improve clarity. Use `camelCase` for variables/functions, `PascalCase` for React components and types, and `UPPER_SNAKE_CASE` for constants. Use descriptive kebab-free filenames such as `matching.ts`, `status.test.ts`, and `rescue-radius-stack.ts`. No formatter or linter is configured; keep changes consistent with nearby code and run `npm run typecheck`.

## Testing Guidelines

Backend tests use Node’s built-in `node:test` runner through `tsx`; name files `*.test.ts` beside the domain module under test. Cover expiry filtering, distance/matching behavior, status transitions, and atomic claim conflicts. Run `npm test` before submitting; there is currently no enforced coverage threshold.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects (for example, `Add claim conflict handling`). Keep commits focused. Pull requests should explain the user-facing or infrastructure change, list validation commands, link the relevant issue or task when available, and include screenshots or API examples for UI/API changes. Call out AWS resource or environment-variable changes explicitly.

## Security & Configuration Tips

Treat `X-Demo-Actor` as demo-only identity. Do not present it as production authentication. Review IAM, DynamoDB, and CDK changes carefully, and verify `cdk diff` before deployment.
