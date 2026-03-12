# 贡献指南

## 提交风格

使用 Conventional Commits：

- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`

尽量让每次提交只聚焦一个包或一个架构关注点。

## Pull Request 要求

每个 Pull Request 应包含：

- 简洁的变更说明
- 受影响的包列表
- 已执行的验证命令
- 涉及可视界面变更时的截图

## 分包规则

### 跨包导入只能使用包根

正确方式：

```ts
import { Chat } from '@sdkwork/claw-studio-chat';
```

错误方式：

```ts
import { Chat } from '@sdkwork/claw-studio-chat/src/pages/chat/Chat';
```

### 保持 Shell 和入口层干净

- `@sdkwork/claw-studio-web` 应始终是入口壳层
- `@sdkwork/claw-studio-desktop` 应始终是桌面入口壳层
- `@sdkwork/claw-studio-shell` 负责组合路由与全局 UX，不承载功能私有服务

### 尊重功能归属

功能私有的页面、组件和服务应位于对应业务包中。只有真正跨多个功能复用的逻辑才应进入 `business`。

## 提交前验证

至少执行：

```bash
pnpm lint
pnpm build
pnpm docs:build
```

如果改动涉及桌面能力，还应执行：

```bash
pnpm check:desktop
```

## 文档改动约定

- 仓库入口信息变化时更新 `README.md` 与 `README.zh-CN.md`
- 公共项目文档更新在 `docs/`
- 设计与实施计划继续存放在 `docs/plans/`
