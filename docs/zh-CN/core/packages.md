# 分包布局

## 工作区结构

仓库是标准的 `pnpm` workspace，所有包位于 `packages/*`。

## 应用与运行时包

| 包名 | 职责 |
| --- | --- |
| `@sdkwork/claw-web` | Web 入口应用与开发服务器 |
| `@sdkwork/claw-desktop` | Tauri 桌面入口、原生桥接与打包脚本 |
| `@sdkwork/claw-shell` | 路由、布局、Provider、侧边栏、命令面板、壳层组合 |
| `@sdkwork/claw-distribution` | 桌面分发清单与分发元数据 Provider |

## 共享核心包

| 包名 | 职责 |
| --- | --- |
| `@sdkwork/claw-core` | 共享 store、hooks 与跨业务编排 |
| `@sdkwork/claw-types` | 类型、DTO 与共享领域模型 |
| `@sdkwork/claw-infrastructure` | 环境、HTTP、i18n、更新客户端与平台辅助能力 |
| `@sdkwork/claw-ui` | 业务包可复用的共享 UI 原语 |

## 业务功能包

当前工作区的业务包包括：

- `@sdkwork/claw-account`
- `@sdkwork/claw-apps`
- `@sdkwork/claw-channels`
- `@sdkwork/claw-chat`
- `@sdkwork/claw-center`
- `@sdkwork/claw-community`
- `@sdkwork/claw-devices`
- `@sdkwork/claw-docs`
- `@sdkwork/claw-extensions`
- `@sdkwork/claw-github`
- `@sdkwork/claw-huggingface`
- `@sdkwork/claw-install`
- `@sdkwork/claw-instances`
- `@sdkwork/claw-market`
- `@sdkwork/claw-settings`
- `@sdkwork/claw-tasks`

每个功能包至少要具备：

```text
src/components
src/pages
src/services
```

## 包边界原则

- 入口包依赖 shell 与共享层
- 功能包可以依赖 `core`、`types`、`infrastructure`、`ui`
- 功能包之间不应互相导入内部实现
- 包根导出是架构契约的一部分

## 相关但独立的包族

仓库中也包含 `packages/cc-switch`，但它有独立文档体系，也不属于 Claw Studio 主工作区的执行主线。这里的公共文档仍然以 Claw Studio 主工作区为主线。
