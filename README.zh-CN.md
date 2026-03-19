# Claw Studio

[English](./README.md)

Claw Studio 是面向现代 Claw Studio 应用、共享浏览器 Shell 与 Tauri 桌面运行时的分包工作区。当前实现以 `upgrade/claw-studio-v5` 为功能基线，并已经重组为可维护的业务分包结构，通过根级导入和架构校验约束长期演进。

本仓库的主线是 Claw Studio 产品本身。仓库内也包含 `packages/cc-switch` 这一独立包族，但这里的主要脚本、架构和文档都以 Claw Studio 为中心。

## 亮点

- Web 与桌面端共享同一套应用壳层
- 采用垂直业务分包，覆盖 chat、apps、market、settings、devices、account、extensions、community 等模块
- 仓库内置严格的分层依赖与根级导入校验
- 提供 Tauri 桌面运行时、更新能力与分发基础设施
- 面向用户与贡献者提供完整的多语言文档

## 架构快照

```text
web/desktop -> shell -> feature -> (core + infrastructure + types + ui)
shell -> (core + i18n + ui + feature)
```

核心包职责：

- `@sdkwork/claw-web`：可运行的 Web 应用与 Vite 宿主
- `@sdkwork/claw-desktop`：Tauri 桌面入口与原生桥接
- `@sdkwork/claw-shell`：路由、布局、Provider、侧边栏、命令面板
- `@sdkwork/claw-core`：共享 store 与跨业务编排
- `@sdkwork/claw-types`：纯类型与共享领域模型
- `@sdkwork/claw-infrastructure`：环境配置、HTTP、i18n 与平台适配
- `@sdkwork/claw-*`：垂直业务包，例如 `chat`、`market`、`settings`、`account`、`extensions`

仓库禁止跨包子路径导入。请使用 `@sdkwork/claw-market` 这样的包根导入方式，而不是 `@sdkwork/claw-market/src/...`。

## 快速开始

```bash
pnpm install
pnpm dev
```

默认 Web 开发服务器通过 Vite 启动 `@sdkwork/claw-web`，地址为 `http://localhost:3001`。

桌面开发与打包命令：

```bash
pnpm tauri:dev
pnpm tauri:build
```

## 常用命令

```bash
pnpm dev           # 启动 Web Shell
pnpm build         # 构建 Web 包
pnpm lint          # TypeScript + 架构 + parity 校验
pnpm check:arch    # 验证分包边界与根级导入
pnpm check:parity  # 校验关键功能与 v5 基线一致
pnpm check:desktop # 校验桌面平台基础能力
pnpm docs:dev      # 启动 VitePress 文档站
pnpm docs:build    # 构建 VitePress 文档站
```

也可以通过 pnpm filter 直接执行包级脚本，例如：

```bash
pnpm --filter @sdkwork/claw-web build
pnpm --filter @sdkwork/claw-desktop tauri:info
```

## 环境变量

从 [`.env.example`](./.env.example) 开始。最关键的变量包括：

- `GEMINI_API_KEY`：Gemini AI 能力必需
- `VITE_API_BASE_URL`：类型化客户端与桌面更新能力使用的后端地址
- `VITE_ACCESS_TOKEN`：可选的后端访问令牌
- `VITE_APP_ID`、`VITE_RELEASE_CHANNEL`、`VITE_DISTRIBUTION_ID`、`VITE_PLATFORM`、`VITE_TIMEOUT`：桌面运行时与更新配置

桌面端示例可参考 [`packages/sdkwork-claw-desktop/.env.example`](./packages/sdkwork-claw-desktop/.env.example)。

## 文档

- [快速开始](./docs/guide/getting-started.md)
- [开发指南](./docs/guide/development.md)
- [架构说明](./docs/core/architecture.md)
- [分包布局](./docs/core/packages.md)
- [桌面运行时](./docs/core/desktop.md)
- [命令参考](./docs/reference/commands.md)
- [贡献指南](./docs/contributing/index.md)

仓库内也保留了 `@sdkwork/claw-docs` 这个应用内文档功能包。`docs/` 下的 VitePress 站点则是面向 GitHub 和开源协作者的公共项目文档。

## 贡献

提交信息遵循 Conventional Commits，例如 `feat:`、`fix:`、`refactor:`、`docs:`。发起 Pull Request 前请至少执行：

```bash
pnpm lint
pnpm build
pnpm docs:build
```

PR 应包含简明说明、影响包列表、验证命令，以及涉及界面变更时的截图。
