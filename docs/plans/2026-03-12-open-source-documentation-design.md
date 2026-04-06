# Open Source Documentation Design

## Goal

Replace the current broken repository documentation with a polished, English-first open-source documentation system that includes a professional root README, a Chinese README mirror, and a public VitePress site under `docs/`.

## Context

The repository now has a stable package architecture, Tauri desktop support, architecture checks, and parity checks against `upgrade/claw-studio-v3`, but the public documentation does not reflect that work. The current `README.md` is partially garbled and `docs/` only contains internal planning files.

The documentation needs to support two audiences:

- open-source users evaluating Claw Studio
- contributors working inside the workspace package architecture

## Requirements

- Make English the default public language
- Add a complete Simplified Chinese mirror for the main public entry points
- Build the public docs site with VitePress and TypeScript config
- Keep public docs product-first, centered on Claw Studio rather than package internals
- Preserve architecture accuracy:
  - `web/desktop -> shell -> feature/business -> (domain + infrastructure)`
  - root-only cross-package imports
- Keep `docs/plans/` internal and out of public navigation
- Make the result visually polished on desktop and mobile

## Information Architecture

### README Strategy

- `README.md`: primary English overview
- `README.zh-CN.md`: Chinese mirror
- language switch links at the top of both files
- content focus:
  - product overview
  - feature highlights
  - architecture snapshot
  - quick start
  - workspace development commands
  - docs links
  - contribution guidance

### VitePress Strategy

- public docs root: `docs/`
- config: `docs/.vitepress/config.ts`
- theme entry: `docs/.vitepress/theme/index.ts`
- visual styling: `docs/.vitepress/theme/custom.css`
- static assets: `docs/public/*`
- English at site root, Chinese under `docs/zh-CN/`

### Public Documentation Sections

- `guide/`: getting started, installation, development
- `core/`: architecture, workspace packages, desktop runtime
- `features/`: product capability areas mapped to the workspace
- `reference/`: commands, environment variables, checks
- `contributing/`: contributor workflow and package boundary rules

## Design Decisions

### 1. Product-First Framing

The README and homepage should explain what Claw Studio does before explaining how the monorepo is arranged. Package-level detail belongs deeper in the docs.

### 2. Root Docs Instead Of A Separate Site Package

The public site should live in root `docs/` because it matches common open-source expectations, keeps GitHub rendering simple, and allows `docs/plans/` to remain adjacent but excluded from navigation.

### 3. Professional But Lightweight Theme Customization

Use VitePress default theme as the base, then layer a custom brand treatment through CSS and a small TypeScript theme entry. The styling should avoid the generic default purple look and instead present a clean technical product aesthetic.

### 4. Contributor Accuracy Over Marketing Volume

All commands, package names, architecture rules, and Tauri workflows must map to the current repository state. This documentation should be precise first, polished second.

## Acceptance Criteria

- `README.md` is fully rewritten in English and no longer contains encoding issues
- `README.zh-CN.md` mirrors the core content in Chinese
- `docs/` builds successfully with VitePress
- English and Chinese docs have working nav, sidebar, and landing pages
- public docs correctly describe current workspace scripts, package roles, and desktop support
- `docs/plans/` is not exposed in public navigation
