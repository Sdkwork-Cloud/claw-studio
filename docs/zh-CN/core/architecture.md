# 架构说明

## 依赖方向

Claw Studio 采用严格的依赖流向：

```text
web/desktop -> shell -> feature/business -> (domain + infrastructure)
feature -> shared-ui
```

这个规则的目标是让入口包保持轻量、功能包保持可迁移，同时防止不相关业务之间出现隐式耦合。

## 各层职责

### Web 与 Desktop

- 负责启动运行时
- 挂载共享 Shell
- 处理平台特有集成

它们不应该持有业务 store、功能服务或页面逻辑。

### Shell

`@sdkwork/claw-studio-shell` 负责组合层能力：

- router
- layouts
- providers
- sidebar
- command palette
- 全局壳层交互

Shell 负责组装功能包导出，不应该重新演化成承载业务服务的新单体。

### Business

`@sdkwork/claw-studio-business` 承载跨功能共享的状态和编排能力，例如全局 store 与共享 hooks，但不应该成为功能私有服务的堆放处。

### Domain 与 Infrastructure

- `domain`：纯共享模型和类型
- `infrastructure`：环境读取、HTTP 客户端、i18n 启动、平台适配、更新辅助能力

### Feature Packages

业务包必须自带 `components`、`pages`、`services` 目录，例如：

- `@sdkwork/claw-studio-chat`
- `@sdkwork/claw-studio-market`
- `@sdkwork/claw-studio-settings`
- `@sdkwork/claw-studio-account`
- `@sdkwork/claw-studio-extensions`

## 根级导入规则

跨包导入必须指向包根：

```ts
import { Settings } from '@sdkwork/claw-studio-settings';
```

仓库会拒绝任何直接伸入其他包内部文件的导入方式。

## 仓库内置校验

架构校验脚本会验证：

- 必需目录结构
- 允许的依赖方向
- 跨包根级导入规则
- 包导出形态
- Web 壳层边界

显式执行：

```bash
pnpm check:arch
```

## 为什么这很重要

当前工作区是从 `upgrade/claw-studio-v3` 迁移而来，后者仍然是功能和界面的参考基线。新的分包架构在保持产品一致性的同时，显著提升了后续维护和演进的可控性。
