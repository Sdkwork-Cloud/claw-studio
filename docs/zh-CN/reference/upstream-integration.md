# 上游运行时集成说明

## 目标

本文记录当前 `claw-studio` 的运行时集成基线，用来替代早期围绕独立 provider router 运行时的设计说明。

## 当前架构

当前桌面端的有效架构如下：

1. Tauri 与 Rust Host 负责安装、生命周期和打包期集成。
2. Hub Installer 负责软件发现、安装记录和受管安装。
3. OpenClaw 是桌面内置能力的主运行时。
4. Claw Studio 通过 OpenClaw 兼容的配置文件和运行时桥接来读写 provider 与 agent 配置。
5. Web Host 与 Desktop Host 继续保持轻量，只消费 package root 暴露的 API。

## 运行时边界

- Rust Host：安装、升级、进程监管、原生命令桥接、事件分发
- Hub Installer：软件注册表、安装元数据、安装进度
- OpenClaw Runtime：运行时行为、配置权威、agent 工作区、provider 配置
- Feature Packages：只负责 UI 与产品流程

## Provider 配置策略

当前 provider 配置已经收敛到 OpenClaw 运行时和设置体系中。
历史 provider 标识仍可能在配置迁移时被兼容清洗，但新的产品逻辑不能再依赖独立 router 运行时，也不能再依赖 router 专属环境变量。

## 上游优先级

当前仍然需要关注的上游项目包括：

- `openclaw`
- `zeroclaw`
- `ironclaw`
- `codex`

其中 OpenClaw 仍然是桌面端第一优先级的受管运行时。其它运行时在 Host、Registry 和产品流程准备完成后，再作为受管或伴生运行时接入。

## 实施规则

- 不要在受版本控制的 `.env*` 文件中重新引入 router 专属环境变量。
- 不要在桌面打包逻辑中重新假设存在独立 router 运行时。
- 历史 provider 迁移兼容逻辑必须集中在共享 helper 中。
- 优先使用 OpenClaw 的配置面和运行时能力，不要回退到分散的包内 mock 协调。

## 备注

- `docs/plans` 和 `docs/superpowers` 中的历史计划仍可能保留旧的 router 方案讨论，它们不代表当前架构结论。
- 当前真实基线以实现代码、契约测试和本文档为准。
