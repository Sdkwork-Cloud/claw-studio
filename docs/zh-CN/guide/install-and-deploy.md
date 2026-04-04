# 安装与部署

## 先选对产物类型

| 产物家族 | 典型输出 | 支持目标 | 适用场景 |
| --- | --- | --- | --- |
| Desktop | 安装器与应用包 | Windows、Linux、macOS | 需要原生桌面应用 |
| Server | 含内置 Web 资源的原生归档包 | Windows、Linux、macOS | 需要独立浏览器管理型服务 |
| Container | 面向 Docker 的部署包 | Linux `x64` 与 `arm64` | 使用 Docker / Compose 部署 |
| Kubernetes | Helm 兼容部署包 | Linux `x64` 与 `arm64` | 部署到 Kubernetes |
| Web | 静态 Web 与 docs 归档 | web | 只需要静态资源 |

## 基于源码的本地安装

### Web

```bash
pnpm install
pnpm dev
```

### 桌面端

```bash
pnpm install
pnpm tauri:dev
```

### Server

```bash
pnpm install
pnpm build
pnpm server:dev
```

当你希望原生 Server 提供当前构建出的浏览器界面时，先执行 `pnpm build` 再执行 `pnpm server:dev`。

## 默认访问入口

| 模式 | 默认或典型入口 |
| --- | --- |
| Web 工作区 | `http://localhost:3001` |
| 桌面端运行时 | 执行 `pnpm tauri:dev` 后打开原生窗口 |
| 原生 Server | 默认 `http://127.0.0.1:18797` |
| Container | 由部署包映射出的宿主端口 |
| Kubernetes | ingress 域名或 service 地址 |

## 桌面端安装说明

### Windows

桌面端发布产物通常会包含 `.exe` 或 `.msi` 等 Windows 安装器格式。

### Linux

桌面端发布产物通常会包含 `.deb`、`.rpm` 和 `.AppImage`。

### macOS

桌面端发布产物通常会包含 `.dmg` 和归档后的 `.app` 包。

## 原生 Server 安装说明

### Server 包结构

打包后的 Server 归档中包含：

- `bin/` 下的 Rust Server 二进制
- `web/dist/` 下的浏览器应用
- `.env.example`
- 启动脚本
- 包内 README

### Windows

```powershell
.\start-claw-server.cmd
```

### Linux 与 macOS

```bash
./start-claw-server.sh
```

启动脚本默认会：

- 将 `CLAW_SERVER_WEB_DIST` 指向包内的 `web/dist`
- 将 `CLAW_SERVER_DATA_DIR` 指向解压目录下的 `.claw-server`

## 安装后验证

### Server

检查 readiness：

```bash
curl http://127.0.0.1:18797/claw/health/ready
```

读取 discovery：

```bash
curl http://127.0.0.1:18797/claw/api/v1/discovery
```

下载 OpenAPI 文档：

```bash
curl http://127.0.0.1:18797/claw/openapi/v1.json
```

### 启用 Basic Auth 的 Server

```bash
curl -u operator:manage-secret \
  http://127.0.0.1:18797/claw/manage/v1/rollouts
```

### Desktop

桌面端启动后，至少完成以下检查：

1. 确认窗口正常拉起
2. 打开关键设置或管理页面
3. 确认 provider 或 host 状态数据能正常加载，没有 bridge 错误

## Docker 部署

以下命令需要在解压后的 bundle 根目录执行。Compose 文件会从 `deploy/profiles/*` 解析环境覆盖项，并把 bundle 根目录作为 Docker build context。

基础部署：

```bash
docker compose -f deploy/docker-compose.yml up -d
```

NVIDIA CUDA 覆盖层：

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.nvidia-cuda.yml up -d
```

AMD ROCm 覆盖层：

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.amd-rocm.yml up -d
```

## Kubernetes 部署

```bash
helm upgrade --install claw-studio ./chart -f values.release.yaml
```

## 打包前校验

```bash
pnpm check:server
pnpm check:automation
pnpm release:plan
```

本地打包前置条件：

- `pnpm release:package:desktop` 只会收集已经生成完成的桌面安装器与应用包，需要先执行 `pnpm release:desktop` 或 `pnpm tauri:build`。
- `pnpm release:package:server` 在使用根级本地 wrapper 时会先自动补建原生 Server release 二进制。
- `pnpm release:package:container` 在使用根级本地 wrapper 时会先自动补建匹配目标架构的 Linux Server 二进制。在 Windows 上，如果已经安装 WSL 发行版，`pnpm server:build -- --target x86_64-unknown-linux-gnu` 会自动通过 WSL 构建；在 macOS 上，这条回退路径仍然需要显式准备对应的 Rust target 与 cross-build toolchain。
- `pnpm release:package:kubernetes` 只打包 chart 与 values 资产，因此不依赖本地先构建 Server 二进制。
- `pnpm release:finalize` 会读取当前 release 资产目录中的 family manifest。本地 wrapper 默认目录是 `artifacts/release`，GitHub workflow 使用的是 `release-assets/`。

## 常见运维操作

### 重启打包后的 Server Bundle

Windows：

```powershell
taskkill /IM sdkwork-claw-server.exe /F
.\start-claw-server.cmd
```

Linux 或 macOS：

```bash
pkill -f sdkwork-claw-server || true
./start-claw-server.sh
```

这些只是 launcher-based 包的直接进程操作示例。如果你把原生 Server 安装为系统服务，请优先使用 `claw-server service start|stop|restart|status`，这样 CLI、浏览器管理和服务清单投影会保持一致。

### 查看 Container 部署状态

```bash
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs --tail=200
```

### 查看 Kubernetes 部署状态

```bash
helm status claw-studio
kubectl get pods
kubectl get svc
```

### 验证浏览器可访问性

优先检查：

- `/claw/health/ready`
- `/claw/api/v1/discovery`
- `/claw/openapi/v1.json`

## 当前服务管理器边界

当前原生 Server 运行时已经内建 `systemd`、`launchd` 和 `Windows Service` 风格的服务生命周期支持。上面的启动脚本仍然适用于非 service 安装，而 `claw-server service *` 是受管服务安装的规范入口。
