---
layout: home

hero:
  name: Claw Studio
  text: 面向 Web 与桌面端的分包工作区。
  tagline: 共享应用壳层、垂直业务分包、根级导入约束，以及与 v3 产品基线对齐的 Tauri 运行时。
  image:
    src: /logo.svg
    alt: Claw Studio
  actions:
    - theme: brand
      text: 快速开始
      link: /zh-CN/guide/getting-started
    - theme: alt
      text: 查看架构
      link: /zh-CN/core/architecture

features:
  - title: 共享产品 Shell
    details: Web 入口包和桌面运行时共用同一套应用壳层，不重复维护路由和布局逻辑。
  - title: 垂直业务分包
    details: account、chat、market、settings、apps、extensions、community、devices 等模块都通过包根隔离。
  - title: 架构自动校验
    details: 仓库脚本会校验依赖分层、目录结构以及跨包根级导入规则。
  - title: 桌面分发能力
    details: Tauri 打包、运行时 Provider、更新检查和分发元数据都收敛在专门的桌面包中。
  - title: v3 功能对齐
    details: 当前工作区以 upgrade/claw-studio-v3 为功能和界面基线，同时改进可维护性。
  - title: 面向贡献者
    details: 命令、环境变量、分包职责和贡献规则都已经公开文档化。
---

## 为什么采用这种工作区结构

Claw Studio 通过 `pnpm` 工作区组织代码，避免产品规模增长后重新退化为单体前端包。结果是：shell、共享状态、基础设施和业务功能之间的边界都清晰可控。

<div class="site-grid">
  <div class="site-card">
    <h3>入口包保持轻量</h3>
    <p>`@sdkwork/claw-studio-web` 与 `@sdkwork/claw-studio-desktop` 只负责启动应用，不承载业务 store 或功能服务。</p>
  </div>
  <div class="site-card">
    <h3>边界长期稳定</h3>
    <p>跨包导入必须使用包根，这让每个包都可以独立演进，而不会被内部目录结构耦合。</p>
  </div>
  <div class="site-card">
    <h3>桌面端是一级能力</h3>
    <p>同一套产品壳层同时驱动 Tauri 桌面应用，具备原生运行时与打包能力。</p>
  </div>
</div>

## 快速入口

- 从这里开始：[快速开始](/zh-CN/guide/getting-started)
- 理解分层规则：[架构说明](/zh-CN/core/architecture)
- 查看分包职责：[分包布局](/zh-CN/core/packages)
- 运行桌面端流程：[桌面运行时](/zh-CN/core/desktop)
- 查询脚本命令：[命令参考](/zh-CN/reference/commands)
- 遵循仓库规则：[贡献指南](/zh-CN/contributing/)

> 公共 VitePress 文档站与应用内 `@sdkwork/claw-studio-docs` 功能包并存。这里主要承担仓库接入和开源协作说明。
