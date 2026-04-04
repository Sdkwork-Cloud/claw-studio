# Claw Server 运行时参考

本文记录当前 `packages/sdkwork-claw-server` 已经落地的服务端运行时基线。此阶段的重点不再只是“能启动一个 Rust Web Server”，而是开始把它打磨成可运维、可配置、可持续演进的 server shell。

## 目标

当前 server 运行时已经具备这些基础能力：

1. 启动原生 Axum Web Server。
2. 在 `/claw/*` 下挂载健康检查、public discovery、openapi、internal、manage 等原生路由族。
3. 直接托管浏览器前端静态资源，而不是维护第二套前端。
4. 通过原生 Rust 路由提供 rollout 与 node-session 控制面能力。
5. 支持 `run`、`print-config` 与 `service print-manifest` 三个原生命令。
6. 支持通过 `--config` 指向 JSON 配置文件。
7. 支持端口冲突时自动回退到可用端口。

## 原生命令

当前 Rust 入口已经提供真实 CLI：

```bash
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- run
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- print-config
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service print-manifest --platform linux
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service status
```

当前命令语义：

- `run` 是默认命令，因此直接执行 `cargo run --manifest-path ...` 或打包后的 `claw-server` 二进制时，会默认进入 server 启动流程。
- `print-config` 会打印当前生效配置，方便排查配置来源与优先级问题。
- `service print-manifest --platform <linux|macos|windows>` 会输出可移植的服务清单元数据，以及对应平台的 `systemd`、`launchd` 或 `windowsService` 单元内容。
- `service install`、`service start`、`service stop`、`service restart` 与 `service status` 会直接驱动当前平台的服务管理器，并继续复用同一套运行时配置解析逻辑。
- `--config <path>` 用于指定 JSON 配置文件。
- `--host <value>` 与 `--port <value>` 可同时覆盖 `run`、`print-config` 与所有 `service *` 子命令的解析结果。

## 服务清单投影

当前这一轮产品化先聚焦“统一生成服务清单”，还没有进入真正的 install / start / stop / restart 生命周期控制。现在已经支持：

```bash
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service print-manifest --platform linux
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service print-manifest --platform macos
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service print-manifest --platform windows
```

当前语义说明：

- Linux 输出 `systemd` 语义，目标单元路径为 `/etc/systemd/system/claw-server.service`
- macOS 输出 `launchd` 语义，目标单元路径为 `/Library/LaunchDaemons/ai.sdkwork.claw.server.plist`
- Windows 输出 `windowsService` 语义，配套 manifest 路径为 `<CLAW_SERVER_DATA_DIR>/service/windows-service.json`
- 输出中会包含生效后的可执行文件路径、配置文件路径、运行参数、环境变量、工作目录、日志路径以及 runtime config 快照
- 如果没有显式提供 `--config` 或 `CLAW_SERVER_CONFIG`，则服务清单会默认把配置文件路径投影为 `<CLAW_SERVER_DATA_DIR>/claw-server.config.json`

## 服务生命周期命令

当前已经支持：

```bash
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service install
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service start
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service stop
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service restart
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service status
```

当前语义说明：

- Linux 通过 `systemctl` 管理 system service，并写入 `/etc/systemd/system/claw-server.service`
- macOS 通过 `launchctl` 管理 system domain，并写入 `/Library/LaunchDaemons/ai.sdkwork.claw.server.plist`
- Windows 通过 `sc.exe` 管理服务，并继续使用 `<CLAW_SERVER_DATA_DIR>/service/windows-service.json` 作为配套 manifest
- `service install` 会先落盘解析后的 `claw-server.config.json`，再写入服务单元，最后执行最小必要的 enable 或 register 命令
- `service status` 即使服务未启动、未加载或未安装，也会输出结构化 JSON，而不是直接崩溃退出
- 这些命令当前要求操作者具备平台服务管理器所要求的权限

## 环境变量

当前 server shell 支持以下环境变量：

```bash
CLAW_SERVER_CONFIG=
CLAW_SERVER_HOST=127.0.0.1
CLAW_SERVER_PORT=18797
CLAW_SERVER_DATA_DIR=.claw-server
CLAW_SERVER_STATE_STORE_DRIVER=sqlite
CLAW_SERVER_STATE_STORE_SQLITE_PATH=
CLAW_SERVER_STATE_STORE_POSTGRES_URL=
CLAW_SERVER_STATE_STORE_POSTGRES_SCHEMA=
CLAW_SERVER_WEB_DIST=../sdkwork-claw-web/dist
CLAW_SERVER_MANAGE_USERNAME=
CLAW_SERVER_MANAGE_PASSWORD=
CLAW_SERVER_INTERNAL_USERNAME=
CLAW_SERVER_INTERNAL_PASSWORD=
CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false
```

当前优先级规则：

- 配置优先级为 `CLI 覆盖 -> 配置文件 -> 环境变量 -> 内置默认值`。
- `CLAW_SERVER_CONFIG` 用于给 `claw-server` 指定 JSON 配置文件。
- 当 `service print-manifest` 未显式提供配置文件时，会默认投影到 `<CLAW_SERVER_DATA_DIR>/claw-server.config.json`，便于后续安装器或打包流程写入稳定配置。
- `service install`、`service start`、`service stop`、`service restart` 与 `service status` 也会复用同一套优先级，不会额外引入第二套 service 配置解析逻辑。
- `CLAW_SERVER_HOST` 默认是 `127.0.0.1`，保持 loopback-first。
- `CLAW_SERVER_PORT` 默认是 `18797`。
- `CLAW_SERVER_STATE_STORE_DRIVER` 当前支持 `json-file` 与 `sqlite`。
- `CLAW_SERVER_INTERNAL_*` 未单独配置时，会回退复用 manage 凭据。
- 当 `CLAW_SERVER_HOST` 不是 loopback 时，现在必须配置 control-plane Basic Auth；只有显式设置 `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=true` 才允许在可信环境里跳过该保护。
- `CLAW_SERVER_STATE_STORE_DRIVER=postgres` 当前会直接失败，并明确提示 PostgreSQL 还只是 metadata-only 投影，不是可激活的运行时驱动。

## 启动行为

当前启动流程如下：

1. 解析 CLI 命令，默认进入 `run`。
2. 解析生效配置。
3. 按 `CLI -> 配置文件 -> 环境变量 -> 默认值` 合成最终运行时配置。
4. 尝试绑定 requested port。
5. 如果 requested port 被占用，则自动回退到一个可用的 active port。
6. 基于最终运行配置构建 `ServerState`。
7. 挂载 Axum Router 并开始提供服务。

当前端口治理语义：

- `requested port` 表示操作者希望绑定的端口。
- `active port` 表示当前进程最终实际监听的端口。
- 当 `requested port` 可用时，`active port` 与其一致。
- 当 `requested port` 被占用时，server 会自动切换到新的 `active port`，而不是直接启动失败。
- 启动日志会明确区分 `requested port` 与 `active port`。
- `service print-manifest` 也会复用同一套配置解析结果，因此不会再出现单独一套 service 配置推导逻辑。
- `service install` 到 `service status` 也会继续复用同一套解析结果，保证 CLI、manifest 和 service lifecycle 的配置来源完全一致。

## 发布打包说明

当前与 server 运行时直接相关的发布命令包括：

```bash
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
```

说明：

- `pnpm release:package:server` 在使用根级本地 wrapper 时，如果缺少原生 Server 二进制，会先自动补建再继续归档。
- `pnpm release:package:container` 需要匹配目标架构的 Linux Server 二进制。根级本地 wrapper 现在会在缺失时先自动补建；在 Windows 上，如果存在可用的 WSL 发行版，`pnpm server:build -- --target x86_64-unknown-linux-gnu` 会自动桥接到 WSL；在其他非 Linux 主机上，这条回退路径仍然依赖显式准备好的 cross-build 工具链。
- `pnpm release:package:kubernetes` 只会打包 Helm chart 与 release values，不要求本地先构建 Server 二进制。

## 当前边界

当前已经实现：

- 原生 `/claw/*` 控制面路由族
- public discovery 与 OpenAPI 发布
- internal node-session 运行时
- manage rollout 读取、preview 与 start
- `run / print-config / service print-manifest / service install / start / stop / restart / status` 原生命令面
- `CLAW_SERVER_CONFIG` 配置文件入口
- `systemd / launchd / windowsService` 的服务清单投影
- 面向 `systemd / launchd / windowsService` 的基础 service 生命周期控制
- 浏览器管理端通过 `GET /claw/manage/v1/service` 与 `POST /claw/manage/v1/service:start` 等接口复用同一套原生 Rust service control plane
- 请求端口与实际端口的基础治理
- host-platform `stateStore` 投影中的 `projectionMode` 标准，用来明确区分真实运行时驱动条目与 metadata-only 占位条目

当前尚未实现：

- 面向 systemd / launchd / Windows Service 的统一安装控制层
- 更完整的 `/claw/api/v1/*` 对外产品 API
- 将 requested port / active port 全量投影到前端设置中心与运行时状态页
