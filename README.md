# Claw Studio Workspace

基于 `pnpm workspace` 的分包架构工程，遵循 `architect/architect-standard-react+tauri.md` 的分层与低耦合标准。

## Workspace 包结构

```text
packages/
├─ claw-studio-web             (@sdkwork/claw-studio-web)
├─ claw-studio-domain          (@sdkwork/claw-studio-domain)
├─ claw-studio-infrastructure  (@sdkwork/claw-studio-infrastructure)
├─ claw-studio-shared-ui       (@sdkwork/claw-studio-shared-ui)
├─ claw-studio-business        (@sdkwork/claw-studio-business)
├─ claw-studio-apps            (@sdkwork/claw-studio-apps)
├─ claw-studio-channels        (@sdkwork/claw-studio-channels)
├─ claw-studio-chat            (@sdkwork/claw-studio-chat)
├─ claw-studio-claw-center     (@sdkwork/claw-studio-claw-center)
├─ claw-studio-community       (@sdkwork/claw-studio-community)
├─ claw-studio-devices         (@sdkwork/claw-studio-devices)
├─ claw-studio-docs            (@sdkwork/claw-studio-docs)
├─ claw-studio-github          (@sdkwork/claw-studio-github)
├─ claw-studio-huggingface     (@sdkwork/claw-studio-huggingface)
├─ claw-studio-install         (@sdkwork/claw-studio-install)
├─ claw-studio-instances       (@sdkwork/claw-studio-instances)
├─ claw-studio-market          (@sdkwork/claw-studio-market)
├─ claw-studio-settings        (@sdkwork/claw-studio-settings)
└─ claw-studio-tasks           (@sdkwork/claw-studio-tasks)
```

## 依赖方向（严格）

`web -> feature/business -> (domain + infrastructure)`

`feature -> shared-ui`（仅复用通用 UI，不允许业务反向依赖）

- `domain`：实体与核心类型
- `infrastructure`：平台适配与底层能力（HTTP/平台 API）
- `business`：services/stores/hooks 业务能力
- `feature packages`：每个业务域独立分包（均包含 `components/pages/services`）
- `web`：应用壳层（路由组装、全局布局、应用入口）
- `web` 不直接导入 `domain/infrastructure`，统一通过 `business/feature/shared-ui` 组合。

## 开发命令（根目录）

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
pnpm preview
pnpm check:arch
pnpm sync:features
```

上述命令由根脚本转发到 `@sdkwork/claw-studio-web` 包执行。
- `pnpm check:arch`：校验跨包依赖边界，防止反向依赖和跨业务包耦合。
- `pnpm check:arch`：校验跨包依赖边界，并强制每个业务包具备 `src/components`、`src/pages`、`src/services` 结构。
- `pnpm check:arch`：同时强制 `web` 作为壳层不得出现 `src/services`、`src/store`、`src/hooks`、`src/platform*` 的业务实现文件。
- `pnpm sync:features`：按源码导入同步业务包最小依赖并刷新包导出索引。

## 分包命名规范

所有内部包统一使用：

`@sdkwork/claw-studio-xxx`

- 必须使用 `@sdkwork` 作用域
- 必须使用 `kebab-case`
- 新包应明确层级职责，避免跨层反向依赖

## 迁移说明

详细改造过程见：

- `docs/plans/2026-03-09-workspace-monorepo-design.md`
- `docs/plans/2026-03-09-workspace-monorepo-implementation.md`
