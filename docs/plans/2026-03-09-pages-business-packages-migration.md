# Pages 业务分包迁移清单

## 目标
- 将原 `web/src/pages/*` 业务模块全部迁入独立分包。
- 每个业务分包均具备 `components/pages/services` 目录结构。
- 保持原有路由路径、页面样式与交互行为一致。

## 分包映射
- `pages/apps` -> `@sdkwork/claw-studio-apps`
- `pages/channels` -> `@sdkwork/claw-studio-channels`
- `pages/chat` -> `@sdkwork/claw-studio-chat`
- `pages/claw-center` -> `@sdkwork/claw-studio-claw-center`
- `pages/community` -> `@sdkwork/claw-studio-community`
- `pages/devices` -> `@sdkwork/claw-studio-devices`
- `pages/docs` -> `@sdkwork/claw-studio-docs`
- `pages/github` -> `@sdkwork/claw-studio-github`
- `pages/huggingface` -> `@sdkwork/claw-studio-huggingface`
- `pages/install` -> `@sdkwork/claw-studio-install`
- `pages/instances` -> `@sdkwork/claw-studio-instances`
- `pages/market` -> `@sdkwork/claw-studio-market`
- `pages/settings` -> `@sdkwork/claw-studio-settings`
- `pages/tasks` -> `@sdkwork/claw-studio-tasks`

## 迁移策略
- 页面源码迁移到各业务包 `src/pages/<module>`。
- 各业务包按需提供本地桥接：
  - `src/services/*` -> re-export 到 `@sdkwork/claw-studio-business/services/*`
  - `src/store/*` -> re-export 到 `@sdkwork/claw-studio-business/stores/*`
  - `src/types.ts` -> re-export 到 `@sdkwork/claw-studio-domain`
- `web` 包的 `AppRoutes` 改为直接从业务包导入页面组件。

## 验证
- `pnpm lint` 通过
- `pnpm build` 通过
