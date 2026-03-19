# 2026-03-17 I18n Localization Design

## Context
- The community and devices pages still render literal strings such as "Post not found", "Power", and other button/placeholder copy even though `react-i18next` is available.
- `scripts/check-i18n-contract.mjs` enforces that every visual string flows through `t(...)`, but we cannot edit the existing locale JSONs (`en.json`, `zh.json`) per the task constraint.

## Goals
1. Eliminate every static UI string and placeholder in `CommunityPostDetail.tsx`, `NewPost.tsx`, and `Devices.tsx` by routing them through `t(...)`.
2. Ensure confirm/toast text, placeholder text, headings, badges, and any small labels (e.g., "Power", "v") emit through translation helpers.
3. Maintain the existing translation namespaces (`community.*`, `devices.*`, `common.*`) and supply default English copy through `defaultValue` when the locale JSON lacks the key.
4. Keep the experience identical while ensuring `node scripts/check-i18n-contract.mjs` passes.

## Approach
1. **CommunityPostDetail.tsx**
   - Inject `const { t } = useTranslation()` and replace literal text nodes (`Post not found`, `Back to Community`, `Comments`, `Add to the discussion…`, `Reply`, `ME`, `views`, `Follow`, button labels/placeholder) with `t('community.postDetail.*', { defaultValue: '...' })`.
   - Use `t('common.goBack')`/`t('common.back')` where general keys already exist to avoid redundant fallbacks when possible.
   - Optionally hoist any repeated copy into a local `const copy` object for clarity.

2. **Devices.tsx**
   - Add translation wrappers for the small remaining literals (`Power`, the version prefix `v`), while keeping the existing banner/modal copy that already uses `t`.
   - Ensure `confirm(...)` calls already reference `t`, so no change there.
   - Inject `defaultValue` strings for any new `devices.page.*` keys to keep the UI stable without editing locale JSONs.

3. **Validation**
   - After refactoring, run `node scripts/check-i18n-contract.mjs` (and optionally `pnpm lint`) to confirm no static UI copy remains.
   - Keep translation keys organized per namespace so future locale updates can simply add the keys without touching components.

## Next Steps
1. Update the two target pages with the translation calls described above.
2. Run the contract check.
3. Document any remaining assumptions (e.g., new translation keys rely on defaultValue until locale JSONs are updated) in the final summary.
