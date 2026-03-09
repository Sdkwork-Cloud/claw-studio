# Claw Studio Local Tauri Packaging Workflow Design

## Goal
- Standardize the desktop entry around `@sdkwork/claw-studio-desktop` as the only Tauri runtime package.
- Expose root workspace commands that match the Tauri v2 CLI flow: `tauri:dev`, `tauri:build`, `tauri:icon`, and `tauri:info`.
- Preserve the current React shell, feature-package boundaries, and existing UI layout.
- Add only the minimum Rust layering needed to support a real local desktop build without mixing business logic into `src-tauri`.

## Current State
- The workspace already contains `@sdkwork/claw-studio-desktop`, but its package scripts are still Vite-only.
- `src-tauri/` exists, but `bootstrap.rs` is effectively an empty builder and there is no stable command surface.
- The root workspace does not yet provide a standard desktop command entry.
- `.gitignore` covers Node and Rust outputs, but it does not yet cover Python virtual environments and cache directories.

## Options Considered

### Option A: Root workspace proxies to the desktop package
- Add root `tauri:*` scripts that delegate to `@sdkwork/claw-studio-desktop`.
- Keep all Tauri CLI usage and Rust coupling inside the desktop package.
- Recommended because it preserves the package boundary and makes later regional or updater expansion straightforward.

### Option B: Execute `cargo` and `tauri` directly from the workspace root
- This reduces one layer of indirection.
- Rejected because it leaks Rust and Tauri details into the monorepo root and weakens the application boundary.

### Option C: Keep the desktop package as a plain Vite app
- Lowest short-term effort.
- Rejected because it does not produce a standard Tauri workflow and cannot serve as a stable desktop foundation.

## Final Design

### Script Model
- Root `package.json` will expose:
  - `tauri:dev`
  - `tauri:build`
  - `tauri:icon`
  - `tauri:info`
- Each root script will call the desktop package via `pnpm --filter @sdkwork/claw-studio-desktop run ...`.
- `packages/claw-studio-desktop/package.json` will own the real Tauri commands and the `@tauri-apps/cli` dependency.
- `web` remains a browser launcher only and does not participate in desktop packaging.

### Rust Layering
- `src/main.rs`: process entry only.
- `src/lib.rs`: module assembly and `run()`.
- `src/app/`: builder composition, plugin registration, invoke wiring.
- `src/commands/`: front-end callable commands only.
- `src/state/`: shared app state such as build/runtime metadata.
- `src/platform/`: low-level platform helpers for OS and path concerns.

### Minimum Native Surface
- Add one command, `app_info`, to prove the invoke path is stable.
- `app_info` returns static desktop metadata such as app name, version, and target platform.
- Frontend access remains behind `packages/claw-studio-desktop/src/desktop/tauriBridge.ts` so page modules never bind directly to command names.

### Repository Hygiene
- Extend `.gitignore` with:
  - `.venv/`, `venv/`, `env/`
  - `__pycache__/`, `*.pyc`, `*.pyo`
  - `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`
  - `.cache/`, `*.pid`, `*.seed`
- Keep `architect/`, `docs/plans/`, `src-tauri/icons/`, and `.env.example` tracked.

### Verification
- `pnpm lint`
- `pnpm check:desktop`
- `pnpm tauri:info`
- `pnpm tauri:build`
- Success means the workspace still respects its package boundaries, the desktop package resolves a real Tauri CLI workflow, and the app can build an installer or native bundle locally.

## Out of Scope
- Auto-updater integration.
- `cn` / `global` distribution packaging policies.
- Managed Node.js, Python, `pnpm`, or `pip` runtime installation.
- Business UI rewrites or any layout/style adjustments.
