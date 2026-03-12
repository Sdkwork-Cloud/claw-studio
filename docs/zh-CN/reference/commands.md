# 命令参考

## 工作区命令

| 命令 | 作用 |
| --- | --- |
| `pnpm install` | 安装工作区依赖 |
| `pnpm dev` | 启动 Web 开发服务器 |
| `pnpm build` | 构建 Web 包 |
| `pnpm preview` | 预览 Web 构建产物 |
| `pnpm lint` | 执行 TypeScript、架构与 parity 校验 |
| `pnpm clean` | 清理 Web 包构建产物 |

## 架构与对齐校验

| 命令 | 作用 |
| --- | --- |
| `pnpm check:arch` | 校验分包边界、目录结构与根级导入 |
| `pnpm check:parity` | 校验关键功能与 v3 基线的一致性 |
| `pnpm sync:features` | 同步仓库维护的功能包接线脚本 |

## 桌面端命令

| 命令 | 作用 |
| --- | --- |
| `pnpm tauri:dev` | 启动桌面壳层并拉起 Tauri |
| `pnpm tauri:build` | 构建桌面安装包与分发产物 |
| `pnpm tauri:icon` | 从源图标重新生成桌面图标资源 |
| `pnpm tauri:info` | 输出 Tauri 环境信息 |
| `pnpm check:desktop` | 校验桌面运行时与命令契约 |

## 文档命令

| 命令 | 作用 |
| --- | --- |
| `pnpm docs:dev` | 启动 VitePress 文档站 |
| `pnpm docs:build` | 构建 VitePress 文档站 |
| `pnpm docs:preview` | 预览 VitePress 构建结果 |

## 过滤到单个包执行

通过 pnpm filter 可以只针对某个包执行命令：

```bash
pnpm --filter @sdkwork/claw-studio-web build
pnpm --filter @sdkwork/claw-studio-desktop tauri:info
pnpm --filter @sdkwork/claw-studio-market lint
```
