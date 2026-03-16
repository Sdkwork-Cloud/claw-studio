# 功能总览

## 产品表面

当前工作区在职责拆分为业务包的同时，保持与 `upgrade/claw-studio-v5` 一致的产品表面，并通过共享 Shell 同时服务 Web 与桌面端。

## Workspace 分组

- `auth`：认证入口与登录流程
- `chat`：AI 对话体验
- `channels`：Provider 与渠道视图
- `tasks`：定时任务能力
- `account`：账户相关页面

## Ecosystem 分组

- `apps`：应用商店视图
- `market`：ClawHub 与技能详情
- `extensions`：扩展与技能包管理
- `community`：社区帖子与交互流程
- `github`：GitHub 仓库视图
- `huggingface`：Hugging Face 模型视图

## Setup 分组

- `install`：安装流程
- `instances`：实例管理
- `devices`：设备管理
- `claw-center`：Claw Center 页面

## 支撑性功能区域

- `settings`：应用配置
- `docs`：应用内文档页面

## 为什么按功能拆包

每个功能包都拥有自己的 pages、components 和 services。这样业务逻辑会始终贴近其服务的 UI 表面，不会再次把 `shell` 或 `business` 变成新的大杂烩。

## 对齐目标

迁移的目标是与 `upgrade/claw-studio-v5` 在功能和界面上保持一致。分包提炼是维护性优化，而不是产品重设计。
