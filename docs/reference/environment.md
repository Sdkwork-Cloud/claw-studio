# Environment

## Source Of Truth

Start from the root `.env.example`. Package-level `.env.example` files add runtime-specific detail for web and desktop entry packages.

## Core Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Runtime-dependent | Host URL used by hosted deployments |
| `VITE_API_BASE_URL` | Recommended | Shared backend API base URL |
| `VITE_ACCESS_TOKEN` | Optional | Bearer token for backend requests and update checks |
| `VITE_APP_ID` | Desktop updates | Backend app id used by update checks |
| `VITE_RELEASE_CHANNEL` | Desktop updates | Release channel for update queries |
| `VITE_DISTRIBUTION_ID` | Desktop distribution | Distribution manifest selection |
| `VITE_PLATFORM` | Desktop runtime | Force or describe the current platform |
| `VITE_TIMEOUT` | Optional | Shared HTTP timeout |
| `VITE_ENABLE_STARTUP_UPDATE_CHECK` | Optional | Enable update checks during desktop startup |

## Practical Guidance

- never commit secrets
- update `.env.example` when adding a new variable
- document new variables in the relevant package and public docs
- keep desktop-specific values consistent with the distribution and update flow
- AI generation now depends on an active OpenClaw-compatible instance plus Provider Center configuration, not a browser-side Gemini key

## Related Files

- `./.env.example`
- `./packages/sdkwork-claw-web/.env.example`
- `./packages/sdkwork-claw-desktop/.env.example`
