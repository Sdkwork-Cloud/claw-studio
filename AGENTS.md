# Repository Guidelines

## Project Structure & Module Organization
- This repo is a `pnpm workspace` with packages under `packages/*`.
- `packages/claw-studio-web` (`@sdkwork/claw-studio-web`) is the runnable app: `src/pages`, `src/components`, `src/application`, `server.ts`.
- `packages/claw-studio-domain` contains domain entities and shared types.
- `packages/claw-studio-infrastructure` contains platform adapters and low-level HTTP helpers.
- `packages/claw-studio-business` contains services, Zustand stores, and business hooks.
- Business pages are split into feature packages such as `@sdkwork/claw-studio-market`, `@sdkwork/claw-studio-settings`, `@sdkwork/claw-studio-chat`, etc.
- Each feature package must keep `src/components`, `src/pages`, and `src/services` as the minimum module boundary.
- Keep dependency direction strict: `web -> feature/business -> (domain + infrastructure)` and `feature -> shared-ui`.
- Treat `@sdkwork/claw-studio-web` as an application shell only: route/layout/provider/shell components. Do not place business `services/store/hooks` implementations in `web/src`.

## Build, Test, and Development Commands
- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: run the web package dev server (`tsx server.ts`, default `http://localhost:3001`).
- `pnpm lint`: TypeScript checks for the web package (`tsc --noEmit`).
- `pnpm build`: production build for `@sdkwork/claw-studio-web`.
- `pnpm preview`: preview built assets.
- `pnpm --filter @sdkwork/claw-studio-web <script>`: run package-scoped scripts directly.

## Coding Style & Naming Conventions
- Use TypeScript and React function components with hooks.
- Follow existing style: 2-space indentation, semicolons, and grouped imports.
- Components/pages use `PascalCase.tsx`; services/utilities use `camelCase.ts`.
- Store hooks follow `useXStore.ts` naming.
- Internal package names must use `@sdkwork/claw-studio-xxx` (kebab-case, scoped).

## Testing Guidelines
- No dedicated unit-test runner is configured yet.
- Before PRs, run `pnpm lint` and `pnpm build` at workspace root.
- Add tests as `*.test.ts` / `*.test.tsx` when introducing logic-heavy behavior.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Keep commits scoped to one package or one architectural concern.
- PRs should include: summary, affected packages, verification commands, and UI screenshots when relevant.

## Security & Configuration Tips
- Never commit secrets; use local env files and update `.env.example` when adding variables.
- `GEMINI_API_KEY` is required for AI endpoints; document new required env vars per package.
