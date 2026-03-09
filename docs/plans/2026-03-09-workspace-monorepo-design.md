# Claw Studio Workspace Monorepo 设计说明

## 目标
- 按 `architect/architect-standard-react+tauri.md` 执行分包改造。
- 使用 `pnpm workspace` 管理多包，统一 `@sdkwork/claw-studio-xxx` 命名。
- 保持现有功能、路由、样式与 UI 结构不变。

## 方案对比

### 方案 A（推荐）：应用包 + 分层能力包
- `packages/claw-studio-web`：UI 应用（pages/components/router/application）
- `packages/claw-studio-domain`：领域实体与类型
- `packages/claw-studio-infrastructure`：平台适配、HTTP 客户端
- `packages/claw-studio-business`：services/stores/hooks
- 优点：分层边界清晰、耦合低、改造风险可控、可渐进演进
- 风险：需要一次性调整 workspace 与导入路径

### 方案 B：仅抽离公共能力包，应用留根目录
- 根目录继续承载应用，新增 domain/business 包
- 优点：迁移成本较低
- 风险：根目录兼具“应用+工作区”，边界仍不够清晰

### 方案 C：全量重建为 apps/ + packages/ 双层结构
- 新建 apps 目录并全量迁移，包层再细分
- 优点：结构最“教科书”
- 风险：改造规模最大、回归风险高

## 采用方案
- 采用方案 A：全部包放 `packages/`，应用也以包形式存在，保证一致命名与统一发布/构建范式。

## 依赖方向
- `claw-studio-web` -> `claw-studio-business` -> (`claw-studio-domain`, `claw-studio-infrastructure`)
- `claw-studio-infrastructure` 与 `claw-studio-domain` 不反向依赖上层。

## 验证标准
- `pnpm lint`、`pnpm build` 在 workspace 根执行通过。
- 页面访问路径与交互行为保持一致。
