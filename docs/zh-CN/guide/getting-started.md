# 快速开始

## 你将要启动什么

这个仓库是 Claw Studio 的分包工作区，包含：

- Web 入口包
- Tauri 桌面入口包
- 共享 Shell 包
- 共享 `business`、`domain`、`infrastructure` 包
- `chat`、`market`、`settings`、`account`、`extensions` 等垂直业务包

## 前置条件

- Node.js
- `pnpm`
- 如果需要运行桌面端，还需要 Rust 与 Tauri 相关依赖

如果你只处理 Web 壳层，Node.js 和 `pnpm` 就足够。

## 安装依赖

```bash
pnpm install
```

## 启动 Web 工作区

```bash
pnpm dev
```

这会启动 `packages/claw-studio-web/server.ts` 中的开发服务器，默认地址是 `http://localhost:3001`。

## 启动桌面应用

```bash
pnpm tauri:dev
```

桌面包会先在 `127.0.0.1:1420` 启动 Vite，再拉起 Tauri 应用。

## 构建目标

```bash
pnpm build
pnpm tauri:build
pnpm docs:build
```

`pnpm build` 构建 Web，`pnpm tauri:build` 构建桌面安装包，`pnpm docs:build` 构建公共文档站。

## 环境变量准备

从根目录 `.env.example` 开始。

重点变量包括：

- `GEMINI_API_KEY`：AI 能力必需
- `VITE_API_BASE_URL`：后端 API 地址
- `VITE_ACCESS_TOKEN`：可选的后端访问令牌
- `VITE_APP_ID`、`VITE_RELEASE_CHANNEL` 等桌面更新配置

桌面端补充示例见 `packages/claw-studio-desktop/.env.example`。

## 下一步

- 阅读 [开发流程](/zh-CN/guide/development) 了解日常工作流
- 阅读 [架构说明](/zh-CN/core/architecture) 再进行分包迁移
- 阅读 [命令参考](/zh-CN/reference/commands) 查找校验与打包脚本
