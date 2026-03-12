---
layout: home

hero:
  name: Claw Studio
  text: A package-first workspace for web and desktop.
  tagline: Shared shell, vertical feature packages, root-only imports, and a Tauri runtime aligned to the v3 product baseline.
  image:
    src: /logo.svg
    alt: Claw Studio
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Explore Architecture
      link: /core/architecture

features:
  - title: Shared Product Shell
    details: One application shell serves the web entry package and the desktop runtime without duplicating route and layout logic.
  - title: Vertical Feature Packages
    details: Account, chat, market, settings, apps, extensions, community, devices, and more stay isolated behind package roots.
  - title: Architecture Enforcement
    details: Repository checks validate layering, required package structure, and root-only cross-package imports.
  - title: Desktop Distribution
    details: Tauri packaging, runtime providers, update checks, and distribution metadata live in dedicated desktop packages.
  - title: v3 Parity
    details: The workspace tracks the functionality and UI surface of upgrade/claw-studio-v3 while improving maintainability.
  - title: Contributor Ready
    details: Commands, environment variables, package roles, and contribution rules are documented for everyday development.
---

## Why This Workspace

Claw Studio is organized as a `pnpm` workspace so product growth does not collapse into a single application package. The result is a clear split between shell, shared business state, infrastructure, and business feature packages.

<div class="site-grid">
  <div class="site-card">
    <h3>Thin Entry Packages</h3>
    <p>`@sdkwork/claw-studio-web` and `@sdkwork/claw-studio-desktop` bootstrap the app. They do not own business stores or feature-local services.</p>
  </div>
  <div class="site-card">
    <h3>Stable Boundaries</h3>
    <p>Cross-package imports must use package roots. This keeps packages replaceable and prevents coupling to internal file layouts.</p>
  </div>
  <div class="site-card">
    <h3>Desktop Included</h3>
    <p>The same product shell also powers a Tauri desktop application with native runtime and packaging support.</p>
  </div>
</div>

## Quick Links

- Start here: [Getting Started](/guide/getting-started)
- Understand the layering: [Architecture](/core/architecture)
- Inspect package roles: [Packages](/core/packages)
- Run desktop flows: [Desktop Runtime](/core/desktop)
- Find scripts fast: [Commands Reference](/reference/commands)
- Follow repository rules: [Contributing](/contributing/)

> The public VitePress site complements the in-app `@sdkwork/claw-studio-docs` package. Use this site for repository onboarding and contributor guidance.
