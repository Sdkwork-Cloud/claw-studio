# OpenClaw 升级流程

本文档描述如何将项目中的 OpenClaw 运行时升级到新版本。

## 升级步骤

### 1. 更新版本配置

编辑 `config/openclaw-release.json`，将 `stableVersion` 修改为目标版本号：

```json
{
  "stableVersion": "<新版本号>",
  "nodeVersion": "<对应 Node 版本>",
  "packageName": "openclaw",
  "runtimeSupplementalPackages": [
    "@buape/carbon@<对应版本>"
  ]
}
```

> **注意**: 如果 `runtimeSupplementalPackages` 中存在 `0.x.x` 版本的依赖，构建时会收到
> 不稳定版本警告。请在上游发布稳定版本后及时更新。

### 2. 更新 Desktop 端 Rust 测试 fixtures

如果升级涉及 Rust 端测试数据的版本号变更，需要同步更新以下文件中的硬编码版本号：

- `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

搜索旧版本号并替换为新版本号。

### 3. 更新测试文件

以下测试文件中硬编码了版本号，需要同步更新：

- `scripts/prepare-openclaw-runtime.test.mjs`
- `scripts/verify-desktop-openclaw-release-assets.test.mjs`
- `scripts/openclaw-upgrade-readiness.test.mjs`
- `scripts/openclaw-release-contract.test.mjs`

### 4. 重新准备运行时资源

```bash
# 在项目根目录执行
pnpm dev
# 或仅准备运行时
node scripts/prepare-openclaw-runtime.mjs
```

脚本会自动：
- 下载新版本的 OpenClaw 包和 Node 运行时
- 安装补充依赖（如 `@buape/carbon`）
- 校验完整性并写入 manifest

### 5. 验证构建

```bash
# 运行 lint 检查
pnpm lint

# 运行构建
pnpm build

# 运行 Desktop 端构建（如适用）
pnpm tauri:build
```

### 6. 清理旧版本残留

升级后，以下位置可能残留旧版本文件，需要清理：

| 位置 | 说明 |
|------|------|
| 根目录 `openclaw-*.tgz` | 旧版下载包，已被 `.gitignore` 排除，可手动删除 |
| `.codex-tools/` | 开发工具目录，已被 `.gitignore` 排除 |
| `packages/sdkwork-claw-web/*.db` | 旧版数据库文件，已被 `.gitignore` 排除，可安全删除 |
| `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/` | 运行时资源目录，重新准备后会自动更新 |

## 版本命名规则

- `stableVersion`: 遵循 `YYYY.M.P` 格式（如 `2026.4.9`）
- `runtimeSupplementalPackages`: 使用 npm 包全名 + 精确版本（如 `@buape/carbon@0.0.0-beta-20260327000044`）

## 环境变量覆盖

可通过以下环境变量临时覆盖配置：

| 环境变量 | 作用 | 默认值 |
|---------|------|--------|
| `OPENCLAW_VERSION` | 覆盖 OpenClaw 版本 | `config/openclaw-release.json` 中的 `stableVersion` |
| `OPENCLAW_NODE_VERSION` | 覆盖 Node 版本 | `config/openclaw-release.json` 中的 `nodeVersion` |
| `OPENCLAW_PACKAGE_NAME` | 覆盖包名 | `config/openclaw-release.json` 中的 `packageName` |

## 常见问题

### Q: 构建时出现 "unstable version" 警告？

`@buape/carbon` 当前使用 `0.0.0-beta` 预发布版本。这是已知的上游限制，不影响功能。
等上游发布 `>=1.0.0` 稳定版后更新 `config/openclaw-release.json` 即可消除警告。

### Q: 升级后 Desktop 端启动失败？

确保运行 `pnpm tauri:dev` 前已重新准备运行时资源。检查 `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json`
中的版本号是否与 `config/openclaw-release.json` 一致。

### Q: 如何回退版本？

将 `config/openclaw-release.json` 中的 `stableVersion` 改回旧版本号，重新执行步骤 4-5。
