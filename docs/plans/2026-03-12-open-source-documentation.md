# Open Source Documentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a production-quality documentation stack for Claw Studio with an English README, a Chinese README mirror, and a multilingual VitePress site under `docs/`.

**Architecture:** Keep the public documentation product-first at the top level, then route deeper technical material into structured VitePress sections for guide, core architecture, features, reference, and contributing. Implement the site in root `docs/` with a TypeScript config and a lightweight custom theme layer so the docs remain easy to maintain inside the pnpm workspace.

**Tech Stack:** Markdown, VitePress, TypeScript, pnpm workspace, CSS custom properties

---

### Task 1: Rewrite Repository Entry Documentation

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\README.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\README.zh-CN.md`

**Step 1: Write the failing test**

Use the current broken `README.md` as the failing state: it does not describe the project clearly, contains encoding issues, and has no multilingual support.

**Step 2: Run test to verify it fails**

Run: open `README.md`
Expected: broken text, incomplete structure, and no clear open-source onboarding flow.

**Step 3: Write minimal implementation**

Replace the English README with a clean project overview and add a Chinese mirror with language switch links, accurate commands, architecture notes, and documentation links.

**Step 4: Run test to verify it passes**

Run: manually review both README files
Expected: professional structure, no garbled text, and accurate repository guidance.

**Step 5: Commit**

```bash
git add README.md README.zh-CN.md
git commit -m "docs: rewrite repository readme"
```

### Task 2: Add VitePress Tooling And Root Scripts

**Files:**
- Modify: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\package.json`

**Step 1: Write the failing test**

Treat missing docs scripts and dependencies as the failing condition.

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd docs:build`
Expected: FAIL because no docs script exists yet.

**Step 3: Write minimal implementation**

Add VitePress as a root dev dependency and create `docs:dev`, `docs:build`, and `docs:preview` scripts.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd docs:build`
Expected: the command resolves and proceeds to VitePress build once site files exist.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "docs: add vitepress tooling"
```

### Task 3: Build The VitePress Site Shell

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\.vitepress\config.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\.vitepress\theme\index.ts`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\.vitepress\theme\custom.css`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\public\logo.svg`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\public\social-card.svg`

**Step 1: Write the failing test**

The failing state is the absence of a public docs site, theme, locale navigation, or static assets.

**Step 2: Run test to verify it fails**

Run: `pnpm.cmd docs:build`
Expected: FAIL until `.vitepress` config and entry pages exist.

**Step 3: Write minimal implementation**

Create the VitePress config, localized navigation, custom theme entry, and restrained visual brand styling suitable for a polished open-source project.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd docs:build`
Expected: the docs site compiles with the custom theme and locale structure.

**Step 5: Commit**

```bash
git add docs/.vitepress docs/public
git commit -m "docs: scaffold vitepress site"
```

### Task 4: Author The English Public Docs

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\index.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\guide\getting-started.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\guide\development.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\core\architecture.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\core\packages.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\core\desktop.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\features\overview.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\reference\commands.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\reference\environment.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\contributing\index.md`

**Step 1: Write the failing test**

The failing condition is that public docs content does not exist for the approved information architecture.

**Step 2: Run test to verify it fails**

Run: inspect `docs/`
Expected: only internal planning files are present.

**Step 3: Write minimal implementation**

Author the English docs pages with accurate commands, architecture boundaries, feature summaries, Tauri desktop notes, and contribution rules.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd docs:build`
Expected: English navigation and sidebar pages render without broken links.

**Step 5: Commit**

```bash
git add docs/index.md docs/guide docs/core docs/features docs/reference docs/contributing
git commit -m "docs: add english documentation site content"
```

### Task 5: Add Simplified Chinese Mirrors

**Files:**
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\zh-CN\index.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\zh-CN\guide\getting-started.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\zh-CN\guide\development.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\zh-CN\core\architecture.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\zh-CN\core\packages.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\zh-CN\core\desktop.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\zh-CN\features\overview.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\zh-CN\reference\commands.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\zh-CN\reference\environment.md`
- Create: `D:\javasource\spring-ai-plus\spring-ai-plus-business\apps\claw-studio\docs\zh-CN\contributing\index.md`

**Step 1: Write the failing test**

The failing condition is lack of localized site content for Chinese readers.

**Step 2: Run test to verify it fails**

Run: inspect `docs/zh-CN`
Expected: the locale tree does not exist.

**Step 3: Write minimal implementation**

Mirror the core public docs structure in Simplified Chinese while keeping commands, paths, and package names identical to the English source.

**Step 4: Run test to verify it passes**

Run: `pnpm.cmd docs:build`
Expected: Chinese locale pages build successfully and appear in the locale switcher.

**Step 5: Commit**

```bash
git add docs/zh-CN
git commit -m "docs: add chinese documentation site content"
```

### Task 6: Verify And Publish The Documentation Stack

**Files:**
- No code changes expected

**Step 1: Run docs verification**

Run:

- `pnpm.cmd install`
- `pnpm.cmd docs:build`

Expected: PASS

**Step 2: Run repository verification**

Run:

- `pnpm.cmd lint`
- `pnpm.cmd build`

Expected: PASS

**Step 3: Commit**

```bash
git add .
git commit -m "docs: add multilingual open source documentation"
```
