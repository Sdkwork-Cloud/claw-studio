# 分包布局

## 工作区结构

仓库是标准的 `pnpm` workspace，所有包位于 `packages/*`。

## 应用与运行时包

| 包名 | 职责 |
| --- | --- |
| `@sdkwork/claw-studio-web` | Web 入口应用与开发服务器 |
| `@sdkwork/claw-studio-desktop` | Tauri 桌面入口、原生桥接与打包脚本 |
| `@sdkwork/claw-studio-shell` | 路由、布局、Provider、侧边栏、命令面板、壳层组合 |
| `@sdkwork/claw-studio-distribution` | 桌面分发清单与分发元数据 Provider |

## 共享核心包

| 包名 | 职责 |
| --- | --- |
| `@sdkwork/claw-studio-business` | 共享 store、hooks 与跨业务编排 |
| `@sdkwork/claw-studio-domain` | 类型、DTO 与共享领域模型 |
| `@sdkwork/claw-studio-infrastructure` | 环境、HTTP、i18n、更新客户端与平台辅助能力 |
| `@sdkwork/claw-studio-shared-ui` | 业务包可复用的共享 UI 原语 |

## 业务功能包

当前工作区的业务包包括：

- `@sdkwork/claw-studio-account`
- `@sdkwork/claw-studio-apps`
- `@sdkwork/claw-studio-channels`
- `@sdkwork/claw-studio-chat`
- `@sdkwork/claw-studio-claw-center`
- `@sdkwork/claw-studio-community`
- `@sdkwork/claw-studio-devices`
- `@sdkwork/claw-studio-docs`
- `@sdkwork/claw-studio-extensions`
- `@sdkwork/claw-studio-github`
- `@sdkwork/claw-studio-huggingface`
- `@sdkwork/claw-studio-install`
- `@sdkwork/claw-studio-instances`
- `@sdkwork/claw-studio-market`
- `@sdkwork/claw-studio-settings`
- `@sdkwork/claw-studio-tasks`

每个功能包至少要具备：

```text
src/components
src/pages
src/services
```

## 包边界原则

- 入口包依赖 shell 与共享层
- 功能包可以依赖 `business`、`domain`、`infrastructure`、`shared-ui`
- 功能包之间不应互相导入内部实现
- 包根导出是架构契约的一部分

## 相关但独立的包族

仓库中也包含 `packages/cc-switch`，但它有独立文档体系。这里的公共文档仍然以 Claw Studio 主工作区为主线。
