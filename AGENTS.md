# Repository Guidelines

## Project Structure & Module Organization
This repo is a `pnpm` workspace rooted at `packages/*`. `packages/claw-studio-web` is the runnable shell (`server.ts`, `src/App.tsx`, `src/main.tsx`) and should stay limited to routing, layout, providers, and app bootstrap code. Shared layers live in `claw-studio-domain` for entities and shared types, `claw-studio-infrastructure` for HTTP/config/platform adapters, `claw-studio-business` for shared services, hooks, and stores, and `claw-studio-shared-ui` for reusable UI. Feature packages such as `claw-studio-chat`, `claw-studio-market`, and `claw-studio-settings` should keep `src/components`, `src/pages`, and `src/services` as their minimum boundaries. Cross-package APIs must be consumed from the package root only. Do not import from package-internal subpaths after the package name. Respect dependency flow: `web -> feature/business -> (domain + infrastructure)` and `feature -> shared-ui`.

## Build, Test, and Development Commands
- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: start the web app with `tsx server.ts` at `http://localhost:3001`.
- `pnpm lint`: run the web TypeScript check plus `scripts/check-arch-boundaries.mjs`.
- `pnpm build`: create the production bundle for `@sdkwork/claw-studio-web`.
- `pnpm preview`: serve the built app locally.
- `pnpm check:arch`: validate package layering and shell boundaries.
- `pnpm sync:features`: refresh feature package wiring.
- `pnpm tauri:dev` / `pnpm tauri:build`: run desktop development or production builds.

## Coding Style & Naming Conventions
Use TypeScript and React function components with hooks. Follow the existing style: 2-space indentation, semicolons, and grouped imports. Components and pages use `PascalCase.tsx`; services and utilities use `camelCase.ts`; Zustand hooks use `useXStore.ts`. Internal workspace packages must stay scoped as `@sdkwork/claw-studio-xxx` in kebab-case. Do not place business `services`, `stores`, or `hooks` inside `packages/claw-studio-web/src`.

## Testing Guidelines
There is no repo-wide `pnpm test` script or coverage gate yet. Keep logic-heavy tests next to source as `*.test.ts` or `*.test.tsx`, for example `packages/claw-studio-business/src/services/updateService.test.ts`. Before opening a PR, run `pnpm lint` and `pnpm build` from the workspace root. If you add new behavior, include a focused test or a clear manual verification note.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits such as `feat:` and `docs:`. Keep each commit scoped to one package or one architectural concern. PRs should include a short summary, affected packages, verification commands, linked issues, and screenshots for UI changes.

## Security & Configuration Tips
Never commit secrets. Start from `.env.example`; `GEMINI_API_KEY` is required for AI endpoints, and `VITE_ACCESS_TOKEN` is optional for update checks. Document every new environment variable in the relevant package docs or example env file.
