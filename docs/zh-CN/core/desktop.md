# 桌面运行时

## 总览

Claw Studio 通过 `@sdkwork/claw-desktop` 提供 Tauri 桌面运行时。它复用共享 Shell 与全部业务功能包，同时叠加原生桥接、更新检查和打包能力。

## 关键路径

- `packages/sdkwork-claw-desktop/src/main.tsx`
- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx`
- `packages/sdkwork-claw-desktop/src/desktop/providers/DesktopProviders.tsx`
- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- `packages/sdkwork-claw-desktop/src-tauri/`

## 启动桌面开发

```bash
pnpm tauri:dev
```

桌面包使用专门的 Vite 命令在 `127.0.0.1:1420` 启动前端，再拉起 Tauri 运行时。

## 构建桌面应用

```bash
pnpm tauri:build
```

常用辅助命令：

```bash
pnpm tauri:info
pnpm tauri:icon
pnpm check:desktop
```

## 环境配置模型

桌面运行时通过基础设施层的类型化环境配置读取以下变量：

- `VITE_API_BASE_URL`
- `VITE_ACCESS_TOKEN`
- `VITE_APP_ID`
- `VITE_RELEASE_CHANNEL`
- `VITE_DISTRIBUTION_ID`
- `VITE_PLATFORM`
- `VITE_TIMEOUT`
- `VITE_ENABLE_STARTUP_UPDATE_CHECK`

这些变量在根 `.env.example` 和 `packages/sdkwork-claw-desktop/.env.example` 中都有说明。

## 桌面端架构要点

- 桌面入口包保持轻量
- 壳层组合仍由 `@sdkwork/claw-shell` 负责
- 更新与配置逻辑通过共享 `infrastructure` 和 `core` 流转
- 原生执行与打包能力位于 `src-tauri`

这种拆分确保桌面端与 Web 端始终共享同一套产品 UI 和业务表面。
