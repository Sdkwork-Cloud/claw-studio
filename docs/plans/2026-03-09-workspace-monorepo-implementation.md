# Claw Studio Workspace Monorepo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将现有单包工程改造为 `pnpm workspace` 分包架构，采用 `@sdkwork/claw-studio-xxx` 命名并保持功能/界面一致。

**Architecture:** 构建四类包：Web 应用包、Domain 包、Infrastructure 包、Business 包。通过兼容导出减少页面层改动，确保迁移期间可运行。

**Tech Stack:** pnpm workspace, React 19, TypeScript 5, Vite 6, Zustand, Express

---

### Task 1: 建立 workspace 根配置
- 新建根 `package.json`（workspace 编排）
- 更新 `pnpm-workspace.yaml`（包含 `packages/*`）
- 新建 `tsconfig.base.json`（共享 TS 基础配置）

### Task 2: 创建分包骨架
- 创建 `@sdkwork/claw-studio-web`
- 创建 `@sdkwork/claw-studio-domain`
- 创建 `@sdkwork/claw-studio-infrastructure`
- 创建 `@sdkwork/claw-studio-business`
- 每个包补齐 `package.json`、`tsconfig.json`、`src/index.ts`

### Task 3: 迁移与重定向
- 将当前应用文件迁入 `claw-studio-web`
- 迁移 `domain/infrastructure/business` 目录到对应包
- 更新应用导入与兼容导出，避免页面与样式回归

### Task 4: 依赖与命令标准化
- 在 web/business 包声明 workspace 依赖
- 根脚本使用 `pnpm --filter @sdkwork/claw-studio-web ...`
- 保留开发、构建、类型检查命令

### Task 5: 验证与文档
- 执行 `pnpm install`
- 执行 `pnpm lint`
- 执行 `pnpm build`
- 输出迁移映射与分层依赖关系说明
