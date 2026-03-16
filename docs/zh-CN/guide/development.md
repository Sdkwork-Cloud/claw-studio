# 开发流程

## 日常工作流

仓库的常规开发循环是：

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
```

如果修改了文档，也要执行：

```bash
pnpm docs:build
```

## 校验命令

仓库校验是分层设计的：

- `pnpm lint`：Web 包 TypeScript 校验 + 架构边界校验 + parity 校验
- `pnpm build`：Web 包生产构建
- `pnpm check:arch`：目录结构、依赖分层和根级导入校验
- `pnpm check:parity`：关键功能与 `upgrade/claw-studio-v5` 基线的一致性校验
- `pnpm check:desktop`：桌面平台与 Tauri 命令契约校验

## 包级执行

如果只想针对某个包执行脚本，可以使用 pnpm filter：

```bash
pnpm --filter @sdkwork/claw-web build
pnpm --filter @sdkwork/claw-desktop tauri:info
pnpm --filter @sdkwork/claw-market lint
```

## 关键规则

### 入口包必须保持轻量

`@sdkwork/claw-web` 是应用入口，不应该继续吸收 store、hooks 或业务服务。`@sdkwork/claw-desktop` 也遵循同样原则。

### 跨包导入必须使用包根

正确方式：

```ts
import { Market } from '@sdkwork/claw-market';
```

错误方式：

```ts
import { Market } from '@sdkwork/claw-market/src/pages/market/Market';
```

### 功能逻辑留在功能包

功能页面、组件和服务应该留在对应业务包中。只有当逻辑被多个功能真实复用时，才提升到 `core`。

## 文档流程

- 仓库入口信息变化时，更新 `README.md` 或 `README.zh-CN.md`
- 公共项目文档变化时，更新 `docs/`
- 设计与实施计划继续放在 `docs/plans/`

## 发起 PR 之前

请执行能够证明结果的命令：

```bash
pnpm lint
pnpm build
pnpm docs:build
```

如果改动涉及桌面端，还应执行 `pnpm check:desktop` 和相关 Tauri 命令。
