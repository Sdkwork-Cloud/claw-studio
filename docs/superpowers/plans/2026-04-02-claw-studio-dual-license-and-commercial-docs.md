# Claw Studio Dual License And Commercial Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dual-license documentation package for Claw Studio with commercial package pricing and placeholder community QR codes.

**Architecture:** Keep the legal base simple by retaining the standard AGPL license text, then layer a separate commercial licensing policy and README-facing purchase documentation on top. Use lightweight static SVG placeholders for community QR assets so the repo can ship now and accept real codes later without README changes.

**Tech Stack:** Markdown, static SVG assets, repository root docs

---

### Task 1: Add the commercial licensing policy

**Files:**
- Create: `LICENSE-COMMERCIAL.md`
- Reference: `LICENSE`
- Reference: `docs/superpowers/specs/2026-04-02-claw-studio-dual-license-and-commercial-packages-design.md`

- [ ] **Step 1: Draft the commercial licensing policy**

Write sections for dual licensing, AGPL usage, commercial-license-required scenarios, ordering note, and contact guidance.

- [ ] **Step 2: Review wording against the AGPL constraint**

Check that no sentence falsely states that AGPL itself prohibits every commercial use.

- [ ] **Step 3: Save the final Markdown document**

Ensure the file name is exactly `LICENSE-COMMERCIAL.md` and uses repository-relative links only where needed.

### Task 2: Add placeholder community QR assets

**Files:**
- Create: `docs/public/community/feishu-qr-placeholder.svg`
- Create: `docs/public/community/wechat-qr-placeholder.svg`
- Create: `docs/public/community/qq-qr-placeholder.svg`
- Create: `docs/public/community/sdkwork-chat-qr-placeholder.svg`

- [ ] **Step 1: Create a reusable placeholder layout**

Design a simple SVG structure with a border, title, placeholder icon blocks, and replacement guidance text.

- [ ] **Step 2: Materialize four channel-specific variants**

Change only the visible title and file name per channel.

- [ ] **Step 3: Verify the file names match the README references**

Confirm the paths are stable and human-readable.

### Task 3: Update the English README gateway

**Files:**
- Modify: `README.md`
- Reference: `LICENSE-COMMERCIAL.md`
- Reference: `README.zh-CN.md`
- Reference: `docs/public/community/feishu-qr-placeholder.svg`
- Reference: `docs/public/community/wechat-qr-placeholder.svg`
- Reference: `docs/public/community/qq-qr-placeholder.svg`
- Reference: `docs/public/community/sdkwork-chat-qr-placeholder.svg`

- [ ] **Step 1: Add a concise dual-license section**

Explain AGPL plus commercial licensing in short English prose.

- [ ] **Step 2: Add a brief commercial package summary**

List the public package names and price points with one-line descriptions.

- [ ] **Step 3: Add purchase and community sections**

Link readers to the Chinese README for the full commercial policy and show the placeholder QR assets.

### Task 4: Rewrite the Chinese README as the full commercial entry page

**Files:**
- Modify: `README.zh-CN.md`
- Reference: `LICENSE`
- Reference: `LICENSE-COMMERCIAL.md`

- [ ] **Step 1: Write the Chinese project overview and quick-start sections**

Preserve the repository basics so the README remains useful to contributors.

- [ ] **Step 2: Add dual-license, commercial-boundary, and package-pricing sections**

Include the public pricing matrix and purchase flow.

- [ ] **Step 3: Add FAQ and community QR placeholder sections**

Explain the placeholder status and how maintainers should replace the assets later.

### Task 5: Verify the documentation package

**Files:**
- Inspect: `README.md`
- Inspect: `README.zh-CN.md`
- Inspect: `LICENSE-COMMERCIAL.md`
- Inspect: `docs/public/community/feishu-qr-placeholder.svg`
- Inspect: `docs/public/community/wechat-qr-placeholder.svg`
- Inspect: `docs/public/community/qq-qr-placeholder.svg`
- Inspect: `docs/public/community/sdkwork-chat-qr-placeholder.svg`

- [ ] **Step 1: Inspect Markdown links**

Check that all new relative links point to existing files.

- [ ] **Step 2: Inspect the changed file list**

Confirm the change stays limited to documentation and static assets.

- [ ] **Step 3: Capture the verification outcome**

Record whether additional validation commands were needed or whether manual inspection was sufficient for this documentation-only change.
