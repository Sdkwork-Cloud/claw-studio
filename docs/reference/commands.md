# Commands

## Workspace Commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install workspace dependencies |
| `pnpm dev` | Start the web development server |
| `pnpm build` | Build the web package |
| `pnpm preview` | Preview the built web package |
| `pnpm lint` | Run TypeScript, architecture, and parity checks |
| `pnpm clean` | Clean the web package build output |

## Architecture And Parity

| Command | Purpose |
| --- | --- |
| `pnpm check:arch` | Validate package boundaries, structure, and root-only imports |
| `pnpm check:parity` | Run focused parity checks against critical `upgrade/claw-studio-v5` behavior |
| `pnpm sync:features` | Sync feature package wiring helpers maintained by repository scripts |

## Desktop Commands

| Command | Purpose |
| --- | --- |
| `pnpm tauri:dev` | Run the desktop shell and launch Tauri |
| `pnpm tauri:build` | Build desktop installers and bundles |
| `pnpm tauri:icon` | Regenerate desktop app icons from the source asset |
| `pnpm tauri:info` | Print Tauri environment information |
| `pnpm check:desktop` | Validate desktop runtime and command contracts |

## Documentation Commands

| Command | Purpose |
| --- | --- |
| `pnpm docs:dev` | Start the VitePress docs server |
| `pnpm docs:build` | Build the VitePress docs site |
| `pnpm docs:preview` | Preview the built VitePress site |

## Filtered Package Commands

Use pnpm filters to target one package:

```bash
pnpm --filter @sdkwork/claw-web build
pnpm --filter @sdkwork/claw-desktop tauri:info
pnpm --filter @sdkwork/claw-market lint
```
