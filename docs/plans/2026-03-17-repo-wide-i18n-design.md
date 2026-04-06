# Repo-Wide I18n Retrofit Design

**Problem**

The workspace has a partial i18n migration. `@sdkwork/claw-i18n` exists, but a duplicate i18n implementation also exists in `@sdkwork/claw-infrastructure`, many component/page files still hardcode UI copy, settings still expose an unsupported `ja` language option, and the web host does not feed request language into the runtime. This leaves the application in a mixed state where some screens translate, some do not, and language selection is not fully coherent.

**Goals**

- Make `@sdkwork/claw-i18n` the single source of truth for locale resources and runtime language behavior.
- Remove all Chinese literals and Chinese comments from source files outside locale resource files.
- Replace hardcoded user-facing strings in package components/pages with translation keys.
- Support request-aware language selection in the web host and a stable default language policy.
- Add guardrails so future hardcoded UI text and unsupported locale drift are caught automatically.

**Non-Goals**

- Add a third production-ready locale. The current `ja` option is incomplete and will be removed from the runtime surface for correctness.
- Translate backend seed data and free-form mock content that is intentionally domain data rather than UI chrome unless it is rendered as first-party UI copy owned by the app.

**Approaches Considered**

1. Patch each page independently with more `t()` calls.
   This is fast but preserves duplicate i18n implementations and inconsistent language resolution.

2. Unify the i18n core first, then migrate UI copy package by package.
   This gives one runtime contract, one locale registry, deterministic default language handling, and a clean base for the full retrofit.

3. Move to lazy-loaded, per-package namespaces now.
   This is attractive long term, but it adds complexity and migration overhead that is not required to finish the current retrofit.

**Selected Approach**

Use approach 2.

## Architecture

### Single i18n Runtime

`@sdkwork/claw-i18n` becomes the only package that owns:

- supported locale list
- default locale
- locale normalization
- translation resources
- browser detection order
- helpers for reading and writing the active locale

`@sdkwork/claw-infrastructure` will stop owning a duplicate resource bundle. Any compatibility surface that still needs an i18n export should re-export from `@sdkwork/claw-i18n`.

### Language Resolution

Language resolution will use this precedence:

1. explicit app preference stored in the persisted app store
2. `lang` query parameter
3. locale cookie set by the web host
4. browser language detector sources
5. configured default locale

The default locale will be `en`. Chinese remains a supported runtime locale via `zh`. The incomplete `ja` option will be removed from the public settings UI and the `Language` union type.

### Request-Aware Web Runtime

The Express host will parse the incoming `Accept-Language` header, normalize it to a supported locale, set a stable locale cookie, and emit a matching `Content-Language` response header. The client runtime will then read the same cookie through the existing browser language detector chain. This keeps the SPA request-aware without introducing an SSR rewrite.

### UI Copy Migration

All user-facing strings in components/pages will move behind translation keys. This includes:

- page headings
- empty states
- placeholders
- buttons
- toasts
- modal titles
- command palette labels
- settings labels
- route placeholder content
- docs navigation chrome

Large docs page bodies and long-form first-party instructional content will also be translated if they are rendered directly from app source.

### Guardrails

Add focused automated checks for:

- supported locale contract
- no duplicate i18n resource ownership
- no Chinese source literals outside locale resource files
- no unsupported language options in settings or store types

## Data Flow

1. Incoming web request hits locale middleware.
2. Middleware resolves supported locale from `Accept-Language`, sets cookie and `Content-Language`.
3. App boot calls `ensureI18n()`.
4. `ensureI18n()` resolves the active locale using the shared precedence chain.
5. The persisted app store initializes with the same normalized locale.
6. UI components render only translated strings.
7. Changing the language updates i18n, the app store, and the document language attribute in one place.

## Error Handling

- Unsupported locale inputs fall back to `en`.
- Missing translation keys fall back to the English resource value.
- Locale middleware never blocks page rendering; it only normalizes and annotates the request.

## Testing Strategy

- Add or extend i18n contract tests around supported locales and resource ownership.
- Add regression checks for locale normalization and request-language resolution.
- Run workspace lint and build after the migration.
- Run targeted tests for any packages where behavior changes are introduced.

## Risks

- The largest risk is missing hardcoded copy in long-form docs and marketplace/chat/settings surfaces.
- Removing `ja` changes the public settings surface, but keeping an unsupported option would be a correctness bug.
- Some service-owned mock content may blur the line between domain data and UI copy; those cases will be handled pragmatically and consistently.
