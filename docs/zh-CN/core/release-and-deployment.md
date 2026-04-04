# 发布与部署

## 总览

Claw Studio 现在发布的是统一的 multi-family release，而不是只有桌面端安装包。

当前发布系统会产出：

- `desktop` 桌面安装器与应用包
- `server` 原生 Rust Server 归档
- `container` 面向 Docker 的部署包
- `kubernetes` Helm 兼容部署包
- `web` 浏览器与 docs 静态归档

## 本地校验与打包

```bash
pnpm check:server
pnpm check:automation
pnpm release:plan
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
```

这些命令会把对应产物收集到 `artifacts/release` 中，便于本地审阅或后续统一归并。

本地前置条件说明：

- `pnpm release:package:desktop` 只负责收集已经构建完成的桌面安装器和应用包，需要先执行 `pnpm release:desktop` 或 `pnpm tauri:build`。
- `pnpm release:package:server` 在使用根级本地 wrapper 时，如果缺少原生 Server release 二进制，会先自动补建再归档。
- `pnpm release:package:container` 需要匹配架构的 Linux Server 二进制。根级本地 wrapper 现在会在缺失时先自动补建；在 Windows 上，`pnpm server:build -- --target x86_64-unknown-linux-gnu` 会优先自动桥接到已安装的 WSL 发行版；在 macOS 等非 Linux 主机上，这条回退路径仍然依赖显式准备好的 cross-build toolchain。
- `pnpm release:package:kubernetes` 只打包 chart 与 release values，不依赖本地 Server 二进制。

本地 wrapper 默认把 `release:plan`、`release:package:*` 和 `release:finalize` 指向 `artifacts/release`。GitHub workflow 中仍然使用 `release-assets/` 作为聚合目录；如需覆盖本地默认值，可使用 `SDKWORK_RELEASE_OUTPUT_DIR`、`SDKWORK_RELEASE_ASSETS_DIR`、`SDKWORK_RELEASE_TARGET`、`SDKWORK_RELEASE_PLATFORM`、`SDKWORK_RELEASE_ARCH`、`SDKWORK_RELEASE_ACCELERATOR`、`SDKWORK_RELEASE_IMAGE_REPOSITORY`、`SDKWORK_RELEASE_IMAGE_TAG`、`SDKWORK_RELEASE_IMAGE_DIGEST`、`SDKWORK_RELEASE_TAG`、`SDKWORK_RELEASE_REPOSITORY` 等环境变量。

## GitHub Workflow

发布入口在 `.github/workflows/release.yml`，它会调用 `.github/workflows/release-reusable.yml`。

当前工作流会构建：

- Windows、Linux、macOS 的桌面端产物
- Windows、Linux、macOS 的 Server 归档
- Linux `x64` 与 `arm64` 的 container bundle
- Linux `x64` 与 `arm64` 的 kubernetes bundle
- CPU、NVIDIA CUDA、AMD ROCm 等 accelerator profile
- 最终的 `release-manifest.json` 和 `SHA256SUMS.txt`

## 使用建议

- 选择 `desktop`：本地 GUI 优先安装
- 选择 `server`：Windows / Linux / macOS 上的原生服务端部署
- 选择 `container`：Docker / Compose 环境
- 选择 `kubernetes`：集群环境与 ingress 管理
- 选择 `web`：只需要浏览器静态资源和文档站
