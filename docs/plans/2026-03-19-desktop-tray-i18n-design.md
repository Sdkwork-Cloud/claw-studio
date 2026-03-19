# Desktop Tray IA And Host I18n Design

## Goal

Polish the desktop tray so the recovery action is obvious, the menu structure matches product expectations, and the tray language is resolved at the desktop host level from user preference first and system language second.

## Product Decisions

- `Open Window` stays at the first level so users can immediately recover the hidden app.
- Service controls remain grouped under `Services` because they are operational actions, not navigation.
- Navigation stays grouped under `Open` to keep the first level short and legible.
- `Quit Claw Studio` remains a first-level destructive action because it means the user intentionally wants to stop the parent process and its managed services.

## Language Resolution

- Add a desktop host config field named `language`.
- Supported preference values are `system`, `en`, and `zh`.
- Resolution order is:
  1. explicit host preference from settings
  2. detected OS locale
  3. `en`
- The tray should not depend on webview local storage or page readiness.

## Desktop Integration

- Add a Tauri command that updates the host language preference, persists `config.json`, and refreshes the tray.
- Keep the runtime app store responsible for the effective UI language, but add a `system` preference so settings can intentionally follow OS language.
- Sync that preference from `LanguageManager` so tray labels update immediately after the setting changes.

## Testing

- Rust tests cover tray language resolution and menu information architecture.
- Config tests cover language normalization and public projection.
- Desktop contract tests cover the new bridge command and the settings-to-host sync path.
