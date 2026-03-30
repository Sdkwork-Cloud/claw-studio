# Claw Studio Header Account And Membership Entry Design

## Goal

Upgrade the top-right header into a professional account workbench without breaking the existing growth path:

- Keep the current `升级 VIP` modal as the fast purchase entry.
- Add a top-header avatar dropdown as the primary personal workspace entry.
- Preserve `下载 App`, but change it to open the external mobile download page in the browser.
- Reduce duplication between the sidebar account control and the header account control.

## Current State

- [`AppHeader.tsx`](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-shell/src/components/AppHeader.tsx) already renders search, mobile download, points/VIP entry, and desktop window controls.
- [`Sidebar.tsx`](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-shell/src/components/Sidebar.tsx) already contains an authenticated user card and a minimal dropdown for profile settings and logout.
- [`PointsHeaderEntry.tsx`](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-points/src/components/PointsHeaderEntry.tsx) already owns the `升级 VIP` modal and points quick panel.
- [`Settings.tsx`](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-settings/src/Settings.tsx) already exposes `account`, `feedback`, and other settings tabs.
- [`Points.tsx`](D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-points/src/pages/Points.tsx) already shows current membership, points balance, recharge, and upgrade actions, so it can serve as the current member center surface without inventing a second page.

## Decision

Adopt a dual-entry membership design with a unified top-right account workbench:

1. Keep `升级 VIP` in the header as the high-conversion quick action that opens the existing modal.
2. Add a dedicated avatar dropdown in the header that becomes the primary account entry for authenticated users.
3. Route `会员中心` and `积分中心` into the existing `/points` domain, but differentiate the landing intent with a query parameter so the page can emphasize either membership or wallet context.
4. Keep the sidebar user control, but demote it from “primary account menu” to a secondary access point so the header becomes the authoritative account surface.
5. Replace the in-app mobile guide action with an external browser jump to `https://clawstudio.sdkwork.com/download/app/mobile`.

## Header Interaction Model

The header trailing area should read from left to right as:

1. `下载 App`
2. `升级 VIP`
3. `积分`
4. `用户头像`
5. `窗口控制`

This separates intent cleanly:

- `下载 App` is a distribution action.
- `升级 VIP` and `积分` are commerce/value actions.
- `用户头像` is the personal workspace and account action center.
- `窗口控制` remains a native shell affordance.

## Avatar Menu Design

### Top Summary Card

The menu opens with a compact identity summary card:

- avatar
- display name
- email
- current membership badge such as `Free`, `VIP`, or `Plus`
- points balance summary

This card is not decorative. It establishes identity and current account state before presenting actions.

### Primary Actions

The first menu section should contain:

- `会员中心`
- `积分中心`
- `用户信息`
- `设置`
- `反馈`

These are the high-value account flows and should stay above all secondary actions.

### Secondary Actions

The final section should contain:

- `帮助文档`
- `退出登录`

Secondary actions are visually separated to reduce accidental clicks and keep the first section focused on productive tasks.

## Navigation Design

Because the repo already has mature points and settings surfaces, avoid inventing duplicate routes.

- `会员中心` -> `/points?view=membership`
- `积分中心` -> `/points?view=wallet`
- `用户信息` -> `/settings?tab=account`
- `设置` -> `/settings`
- `反馈` -> `/settings?tab=feedback`
- `帮助文档` -> `/docs`
- `退出登录` -> sign out, then redirect to `/login`

The `/points` page should read the optional `view` query and bias the initial emphasis:

- `membership`: emphasize current plan, benefits, and upgrade state
- `wallet`: emphasize balance, recharge, and transaction history

The page remains one route, but gains a more precise entry contract.

## Auth States

### Authenticated

- `下载 App` opens the external URL in the system browser.
- `升级 VIP` opens the existing upgrade modal.
- `积分` opens the current points quick panel.
- `头像` opens the full account workbench dropdown.

### Guest

- `下载 App` still opens the external URL.
- `升级 VIP` remains visible to preserve conversion, but purchase confirmation still requires login.
- `积分` may stay hidden or degrade to a guest-safe state instead of showing an empty wallet action.
- `头像` becomes a guest entry with:
  - `登录 / 注册`
  - `设置`
  - `帮助文档`

Guest behavior must not expose broken authenticated-only flows.

## Sidebar Role Change

The sidebar account control should no longer compete with the header account workbench.

- Keep it available as a secondary access point.
- Simplify it so it does not need to own every account action.
- Reuse the same account menu action definitions where possible to avoid drift between header and sidebar behavior.

## Component Boundaries

- `sdkwork-claw-shell`
  - own the header avatar trigger, dropdown shell, and navigation orchestration
- `sdkwork-claw-points`
  - keep ownership of VIP upgrade and recharge dialogs
  - accept a `view` query on the points page to bias the landing context
- `sdkwork-claw-settings`
  - continue owning account and feedback surfaces
- `sdkwork-claw-core`
  - provide user identity and auth state through the existing auth store

Avoid duplicating points/VIP/order logic in shell components.

## Error Handling

- External browser open should fail safely and fall back to `window.open` semantics on web.
- If account data is partially unavailable, the avatar menu still opens using session profile fallback from the existing auth store.
- If a user signs out while the menu is open, the menu closes immediately and the app redirects to login.

## Testing And Verification

- Add focused tests for any new pure navigation helpers or menu item builders.
- Manually verify:
  - authenticated header layout
  - guest header layout
  - `升级 VIP` still opens the existing modal
  - `下载 App` opens the external URL
  - avatar menu routes to `会员中心`, `积分中心`, `用户信息`, `设置`, `反馈`, and `帮助文档`
  - sidebar account entry no longer conflicts with the header as the primary account surface

## Success Criteria

- The top header exposes a professional avatar-driven account menu.
- The VIP upgrade modal remains the fast purchase path.
- Membership and wallet flows are reachable from both quick actions and the avatar menu without duplicate pages.
- The mobile app entry opens the official external download URL.
- Header and sidebar account actions share a coherent hierarchy instead of competing for the same role.
