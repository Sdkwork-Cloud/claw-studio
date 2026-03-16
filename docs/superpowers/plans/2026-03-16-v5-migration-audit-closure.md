# V5 Migration Audit Closure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining migration audit gaps so the active workspace, public docs, and verification language all consistently describe the `upgrade/claw-studio-v5`-aligned dual-host architecture.

**Architecture:** Keep the current `web + desktop + shell + feature packages` implementation intact and focus this closure pass on parity evidence, public documentation correctness, and removal of misleading pre-migration wording. Use the existing parity/host/desktop checks as the executable source of truth.

**Tech Stack:** pnpm workspace, React 19, TypeScript, VitePress, Tauri, Node-based contract tests

---

### Task 1: Audit current migration evidence

**Files:**
- Review: `docs/plans/2026-03-15-claw-studio-v5-web-tauri-migration-audit.md`
- Review: `docs/plans/2026-03-15-sdkwork-claw-package-matrix.md`
- Review: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Review: `scripts/check-sdkwork-claw-structure.mjs`

- [ ] Verify the current package matrix and route surface still match the active `sdkwork-claw-*` graph.
- [ ] Confirm the web and desktop hosts still delegate into `@sdkwork/claw-shell`.
- [ ] Confirm active packages do not depend on `@sdkwork/claw-studio-*` packages.

### Task 2: Correct public documentation drift

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/features/overview.md`
- Modify: `docs/zh-CN/features/overview.md`
- Modify: `docs/guide/development.md`
- Modify: `docs/zh-CN/guide/development.md`
- Modify: `docs/reference/commands.md`
- Modify: `docs/zh-CN/reference/commands.md`

- [ ] Replace remaining `v3` parity language with `upgrade/claw-studio-v5`.
- [ ] Ensure public docs describe the active `@sdkwork/claw-*` package names and dual-host architecture.
- [ ] Keep historical plan documents untouched unless they are being used as current migration guidance.

### Task 3: Refresh current migration audit docs

**Files:**
- Modify: `docs/plans/2026-03-15-claw-studio-v5-web-tauri-migration-audit.md`

- [ ] Update the current audit note so it references the active `@sdkwork/claw-*` package names rather than the retired `@sdkwork/claw-studio-*` naming.
- [ ] Keep the document focused on current migration status, not historical intermediate plans.

### Task 4: Re-verify and report remaining gaps

**Files:**
- Verify: `package.json`
- Verify: `scripts/sdkwork-*.test.ts`

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm check:desktop`.
- [ ] Re-scan for `upgrade/claw-studio-v3` references in public docs and for child-package `node_modules`.
