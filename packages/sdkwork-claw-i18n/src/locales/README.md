# Locale Layout

This directory is split by language and top-level translation domain.

- Put English strings in `en/<domain>.json`.
- Put Simplified Chinese strings in `zh/<domain>.json`.
- Keep the top-level domain names aligned between both languages.
- Update `en/index.ts` and `zh/index.ts` only when a new top-level domain is introduced.
- Run `pnpm --filter @sdkwork/claw-i18n sync:locales` after editing split locale files so the compatibility bundles in `en.json` and `zh.json` stay in sync for legacy readers and contract tests.

Examples:

- `providerCenter` strings live in `en/providerCenter.json` and `zh/providerCenter.json`.
- `settings` strings live in `en/settings.json` and `zh/settings.json`.

This structure keeps each feature area small, reduces merge conflicts, and avoids rewriting giant locale files during parallel work.
