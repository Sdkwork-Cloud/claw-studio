# 环境变量

## 配置源头

以根目录 `.env.example` 为起点。Web 与桌面入口包的 `.env.example` 会补充各自运行时的细节说明。

## 核心变量

| 变量 | 是否必需 | 作用 |
| --- | --- | --- |
| `APP_URL` | 取决于部署方式 | 托管环境下的应用地址 |
| `VITE_API_BASE_URL` | 推荐 | 共享后端 API 地址 |
| `VITE_ACCESS_TOKEN` | 可选 | 后端请求与更新检查令牌 |
| `VITE_APP_ID` | 桌面更新需要 | 更新检查接口使用的应用 id |
| `VITE_RELEASE_CHANNEL` | 桌面更新需要 | 更新查询的发布通道 |
| `VITE_DISTRIBUTION_ID` | 桌面分发需要 | 分发清单选择 |
| `VITE_PLATFORM` | 桌面运行时需要 | 当前平台标识 |
| `VITE_TIMEOUT` | 可选 | 共享 HTTP 超时 |
| `VITE_ENABLE_STARTUP_UPDATE_CHECK` | 可选 | 是否在桌面启动时执行更新检查 |

## 实践建议

- 不要提交任何密钥
- 新增变量时同步更新 `.env.example`
- 在相关包和公共文档中记录新变量
- 桌面端变量应与分发和更新流程保持一致
- AI 生成功能现在依赖活动的 OpenClaw 兼容实例与 Provider Center 配置，而不是浏览器侧 Gemini 密钥

## 相关文件

- `./.env.example`
- `./packages/sdkwork-claw-web/.env.example`
- `./packages/sdkwork-claw-desktop/.env.example`
