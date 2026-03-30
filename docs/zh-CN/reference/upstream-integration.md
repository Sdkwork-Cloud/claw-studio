# 上游运行时集成方案

## 目标

本文沉淀 `claw-studio` 对以下上游项目的内置集成结论：

- `openclaw`
- `zeroclaw`
- `ironclaw`
- `codex`
- `sdkwork-api-router`

当前优先级按“桌面内置优先，同时以 API Router 作为共享控制面”来设计。

## 源码快照

本文基于 2026-03-19 检查的以下上游修订：

- `openclaw`: `009a10bce20a11c6b8af7c55b17b5cb60a8b0d4a`
- `zeroclaw`: `2e48cbf7c3093aa1aa18350e1eeca8c290daa5e2`
- `ironclaw`: `b9e5acf66e44fcb7e38c795cbdf96ea0ded553cf`
- `codex`: `70cdb17703a4310b7173642e011f7534d2b2624f`
- `sdkwork-api-router`: `3bd86733d2f8604194496c6978d70c30e0d0a14e`

本地分析克隆位于 `.codex-tools/vendor-analysis/`。

## 当前 Claw Studio 基线

当前桌面端已经具备正确的原生骨架：

- Rust/Tauri 安装命令，支持从 registry 安装并发出进度事件
- `managed`、`partial`、`opaque` 三种安装控制级别
- `windows`、`macos`、`ubuntu`、`wsl` 和容器偏好等运行时平台路由
- API Router 安装服务已经能为 Codex、Claude Code、OpenCode、OpenClaw、Gemini 写入客户端配置

当前最重要的本地缺口：

- `packages/sdkwork-claw-apirouter/src/services/apiRouterService.ts` 仍然是 mock
- `packages/sdkwork-claw-extensions/src/services/extensionService.ts` 仍然是 mock
- vendored Hub Installer registry 之前把 `zeroclaw` 和 `ironclaw` 当成 `pnpm` 工具，并且指向过期 fork

## 总体原则

- 保持 `@sdkwork/claw-web` 和 `@sdkwork/claw-desktop` 足够薄，运行时治理继续放在共享基础设施与 Tauri Rust Host 中
- 只要上游存在真实 Rust/native runtime，就优先由 Rust 侧做父进程监管
- 优先复用上游公开支持的协议和安装入口，不走反向工程式私有耦合
- 把安装、进程监管、配置写入、迁移、升级拆成独立层次处理
- 兼容性判断优先依赖能力探测和安装来源，不只看版本号

## 分上游策略

## OpenClaw

`openclaw` 本质上是 Node/TypeScript 优先的 CLI/Gateway。入口是 `openclaw.mjs`，并暴露了较大的 plugin SDK 面；它自己的更新流程也围绕 CLI、channel、doctor 和 JSON 输出展开。

推荐策略：

- 作为外部受管运行时集成
- 由 Rust 负责 Node 版本、安装路径、进程生命周期、日志和配置桥接
- 不做深度 Rust in-process 嵌入
- 优先走文件、CLI、HTTP 或进程桥接，而不是内部包耦合

## ZeroClaw

`zeroclaw` 是 Rust-first。它提供原生二进制、trait-driven runtime 抽象，以及显式的 OpenClaw 迁移能力。官方安装脚本也已经表现出“预编译优先，源码和 Docker 兜底”的思路。

推荐策略：

- 作为 Rust-native companion runtime 集成
- 在平台支持成熟时优先使用官方 release binary
- 在 Windows 等场景优先保留 source install 作为稳定可控的 managed fallback
- 数据迁移尽量复用上游 `migrate openclaw`

## IronClaw

`ironclaw` 同样是 Rust-first，但比 ZeroClaw 更重，包含 WASM/MCP 扩展体系、OpenClaw 导入能力，以及由 `cargo-dist` 驱动的发布管线。

推荐策略：

- 作为 Rust-native companion runtime 集成
- 面向终端用户优先选择官方 release installer 或 archive
- 面向开发和受控环境保留 source install 作为 managed fallback
- 它的扩展体系保持在外部运行时边界，不直接摊平进 `claw-studio` 包内

## Codex

维护中的 Codex 核心实现已经是 Rust。JavaScript CLI 只是平台二进制的 launcher。最强的官方集成入口是 `codex app-server`，它通过 stdio 或实验性 websocket 提供 JSON-RPC 协议。

推荐策略：

- 安装层优先使用官方 native 分发，开发态才考虑 source build
- 交互层优先走 `codex app-server` 的 stdio JSON-RPC
- 把 Codex 当成协议驱动的工具运行时，而不是只能读写文本的 CLI

## SDKWork API Router

`sdkwork-api-router` 才是本地 provider 控制面和数据面的正确承载者。它已经明确支持 standalone server mode、desktop-oriented embedded mode、loopback trust boundary、SQLite 本地持久化和 OS keyring secrets。

推荐策略：

- 把 API Router 作为本地共享控制面
- 尽快用真实后端替换当前 `sdkwork-claw-apirouter` 的 mock 服务
- 优先让桌面内置 provider 路由先统一收口，再谈更多前端侧 provider 逻辑

## 目标架构

推荐的桌面优先架构为：

1. Tauri / Rust Host
2. Hub Installer Registry 与安装记录
3. 进程监管与协议桥接
4. 内置 `sdkwork-api-router`
5. 外部受管运行时：OpenClaw、ZeroClaw、IronClaw、Codex
6. 薄 UI 包，通过 package root API 消费能力

分层职责：

- Rust Host：安装、升级、监管、迁移、备份、协议桥接
- API Router：provider 路由、凭据、健康检查、extension runtime、loopback API
- 外部运行时：各自上游 CLI / Gateway / Agent 能力
- 前端包：只做 UI，不拥有运行时

## 升级与同步策略

不要靠临时手工更新，建议做成 channel-aware 的同步流程。

推荐流程：

1. 跟踪上游 tag、release、installer 变化和 migration note
2. 刷新 vendored analysis clone 或 pinned metadata
3. 为每个上游版本生成兼容矩阵
4. 校验 install、`--version`、healthcheck 和一个最小功能动作
5. 验证通过后再更新 Hub Installer 的默认 profile

建议为每个运行时记录以下兼容元数据：

- upstream repo URL
- pinned commit 或 release tag
- 安装来源，例如 `source`、`release`、`script`、`global-user`
- 配置格式版本
- 迁移能力标识
- 产品内升级允许的最低支持版本

## 向后兼容策略

- 保留旧 registry name 作为兼容别名，即使其底层实现已经调整
- 持续保留 `managed`、`partial`、`opaque` 三种控制级别
- 升级前先识别安装来源，再决定如何接管
- 每个 managed runtime 都保留一个可回滚的稳定版本
- 迁移前先做能力探测，确认上游支持后再执行
- 每次 managed upgrade 前都备份 config、data 和 install record

## 当前仓库应立即修正的点

- ZeroClaw / IronClaw 的 registry 条目要切回官方 upstream URL，而不是过期 fork
- 不再把 ZeroClaw / IronClaw 对外呈现为 `pnpm`-first 工具
- OpenClaw 继续作为 Node-managed 的例外项处理
- `sdkwork-claw-apirouter` 和 `sdkwork-claw-extensions` 要从 mock 接到真实后端
- 第一条真正打通的内置链路应优先选择 `API Router + Codex app-server + OpenClaw managed runtime`

## 分阶段推进建议

## Phase 1

- 修正 registry 元数据和默认安装策略
- 将真实 API Router backend 接入前端
- 在桌面 UI 暴露安装来源与运行时健康状态

## Phase 2

- 接入 Codex `app-server` 的进程监管与 JSON-RPC 桥接
- 接入 OpenClaw 的 managed install 和 lifecycle control
- 持久化 runtime inventory 和 compatibility metadata

## Phase 3

- 接入 ZeroClaw 的 managed source/release 集成
- 接入 IronClaw 的 managed source/release 集成
- 增加 OpenClaw 迁移与导入 UX

## Phase 4

- 增加自动化 upstream sync 与兼容性验证
- 增加 managed runtime 回滚与 staged rollout
- 在 UI 中增加破坏性升级前的升级建议与兼容风险提示

## 备注

- 本文是集成策略，不代表当前 Hub Installer manifest 格式已经可以一比一镜像所有上游 installer 细节
- 当上游各平台打包能力不一致时，先落最可靠的 managed 路径，再补平台特定的 release 快速路径
