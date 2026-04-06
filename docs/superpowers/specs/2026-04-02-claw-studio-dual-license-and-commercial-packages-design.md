# Claw Studio Dual License And Commercial Packages Design

## Goal

Introduce a clear dual-license repository posture for Claw Studio:

- open source use remains under `AGPL-3.0-only`
- closed-source or non-AGPL commercial use is handled through a separate commercial license
- repository-facing documentation explains purchase paths, package tiers, and community onboarding

## Constraints

- The existing `LICENSE` file already contains the standard GNU Affero General Public License v3.0 text and must remain unmodified.
- AGPL itself does not prohibit commercial use, so the repository cannot truthfully claim that "AGPL forbids all commercial use".
- The documentation must therefore describe a dual-license model instead of a modified AGPL.
- The repository currently has no real community QR code assets for Feishu, WeChat, QQ, or Sdkwork Chat, so the first implementation must use explicit placeholders and replacement guidance.
- The root workspace has unrelated in-progress changes, so this work must stay isolated to documentation and static asset files.

## User-Approved Direction

The approved direction is:

1. keep the open-source license as standard AGPLv3
2. add a commercial licensing document
3. publish public pricing tiers in the README
4. update both `README.md` and `README.zh-CN.md`
5. add a README-facing community QR code section using placeholder assets for later replacement

## File Design

### `LICENSE`

Keep the current AGPLv3 license text unchanged.

### `LICENSE-COMMERCIAL.md`

Add a repository-level commercial licensing policy that:

- states the project is available under dual licensing
- explains when AGPL is sufficient
- explains when a separate commercial license is required
- defines that final commercial rights are granted by a signed order or contract
- points readers to the README purchase plans

This file is intentionally a policy and licensing notice, not a bespoke executable legal contract template.

### `README.md`

Keep the current English project overview, then add short, scan-friendly sections for:

- `License`
- `Commercial Use`
- `Commercial Plans`
- `Purchase Process`
- `Community`

The English README should be a concise gateway and link to the Chinese README for the full package description.

### `README.zh-CN.md`

Replace the current Chinese README with a complete Chinese commercial/open-source entry page that includes:

- project summary
- architecture snapshot
- quick start
- commands
- dual license explanation
- commercial use boundary table
- multi-tier package pricing
- purchase process
- FAQ
- community QR code section

### `docs/public/community/*.svg`

Add four placeholder QR code assets:

- `feishu-qr-placeholder.svg`
- `wechat-qr-placeholder.svg`
- `qq-qr-placeholder.svg`
- `sdkwork-chat-qr-placeholder.svg`

Each asset should visually communicate that the repository still needs the real QR code to be dropped in later.

## Commercial Boundary Design

The wording must distinguish between:

- users who can comply with AGPL obligations
- users who want commercial rights beyond AGPL

The repository will present the following guidance:

- AGPL is available for open-source, research, evaluation, and other use cases where the user is willing to comply with AGPL obligations
- a commercial license is required for closed-source productization, OEM, white-label redistribution, customer delivery, or any deployment model where the user does not want to satisfy AGPL obligations
- if a prospect is unsure whether AGPL compliance is workable for their scenario, they should contact SdkWork before production use

This avoids the inaccurate statement that AGPL itself bans all commercial use while still supporting the intended business funnel.

## Package Design

Public package tiers should be simple, monotonic, and easy to compare:

1. `个人开发者商业授权`
   `¥2,999 / 年`
   Single developer or very small studio use, one product, one production line.

2. `团队商业授权`
   `¥12,800 / 年`
   Small teams building one commercial project with limited environments.

3. `企业商业授权`
   `¥49,800 / 年`
   Mature business deployment with more seats, production environments, and higher support priority.

4. `OEM / 白标 / 再分发授权`
   `¥159,000 / 年起`
   Redistribution, embedding, white-label delivery, and customer-facing packaging.

5. `私有定制与源码护航`
   `¥299,000 / 年起`
   Strategic accounts needing custom development, SLA, and ongoing engineering support.

The README must note that prices are reference prices and that taxes, contract scope, and special procurement requirements are handled in the signed order.

## Community Onboarding Design

The community section must:

- explicitly label every QR code as a placeholder until replaced
- avoid implying that a real community channel is already publicly available if the asset is not present
- make replacement mechanics obvious to repository maintainers

The recommended layout is a simple four-card grid rendered by Markdown images and short descriptions.

## Verification Plan

Verification for this documentation-only change is lightweight:

- inspect the modified Markdown files for consistency and valid relative links
- confirm the new SVG files exist at the referenced paths
- confirm the new commercial licensing file is linked from both README files

## Out Of Scope

- generating real QR codes
- drafting final customer contract templates
- changing application UI, splash screens, or in-product legal notices
- adding automated legal compliance tooling
