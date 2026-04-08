# 17-能力到API调用矩阵

## 1. 目标

本章把“页面能力”落到“服务与 API 调用链”。目标是让需求、实现、测试、升级回归都能按同一张矩阵核对。

## 2. 总调用图

```text
UI / Feature
  -> Feature Service
  -> Infrastructure Contract
  -> one of:
       /claw/api/v1/*
       /claw/manage/v1/*
       /claw/internal/v1/*
       OpenClaw Gateway (/tools/invoke / WS)
       Local Proxy (/v1/* /v1beta/*)
       Upstream Provider API
```

标准要求：

- 页面不得直接跳过 service 层拼 API。
- 对托管 OpenClaw，模型调用不得跳过 Local Proxy。
- 任一写操作都必须存在读回校验路径。

## 3. 宿主、治理与观测矩阵

| 能力 | 主入口 | 主调用链 | 下游 API/协议 | 验收点 |
| --- | --- | --- | --- | --- |
| 桌面启动与内置 OpenClaw 引导 | Tauri Bootstrap | `configure_openclaw_gateway -> ensure_local_ai_proxy_ready -> project_managed_openclaw_provider` | Gateway + Local Proxy + OpenClaw Config | 启动后 Gateway、Proxy、托管 Provider 三者同时可见 |
| Kernel Center 仪表盘 | `KernelCenter` / `kernelCenterService` | `kernelPlatformService + hostPlatformService + rolloutService + runtimeApi` | `/claw/internal/v1/host-platform`、`/claw/manage/v1/host-endpoints`、`/claw/manage/v1/rollouts*` | 版本、端口、模式、Runtime、Proxy 信息一致 |
| Provider Center 列表/保存/删除 | `ProviderConfigCenter` / `providerConfigCenterService` | `listProviderConfigs/saveProviderConfig/deleteProviderConfig` | Provider Routing Record + Kernel Runtime | 路由变更后 Proxy 运行态同步刷新 |
| Provider 路由测试 | `ProviderConfigCenter` | `testProviderConfigRoute` | Local Proxy Route Test | 测试结果能回显协议、状态与错误 |
| Provider 应用到实例/Agent | `ProviderConfigCenter` | `applyProviderConfig -> createOpenClawLocalProxyProjection -> saveManagedLocalProxyProjection -> saveAgent` | Local Proxy Projection + OpenClaw Config | Agent 主模型/回退模型与投影结果一致 |
| API Settings 请求/消息日志 | `ApiSettings` / `localAiProxyLogsService` | `listRequestLogs/listMessageLogs/getMessageCaptureSettings/updateMessageCaptureSettings` | Local Proxy Logs/Capture | 可分页查询、可开关捕获、可定位路由与模型 |

## 4. 聊天与会话矩阵

| 能力 | 主入口 | 主调用链 | 下游 API/协议 | 验收点 |
| --- | --- | --- | --- | --- |
| 聊天路由解析 | `chatService` + `instanceChatRouteService` | 活动实例 -> 权威实例详情/端点 -> route mode 计算 | 实例 `baseUrl/websocketUrl/gateway` | 路由模式与实例真实 transport 一致 |
| OpenClaw 网关聊天 | Chat Session Store / OpenClaw Chat Gateway Client | `chat.history/send/abort/inject` | Gateway WebSocket / Official Method | 会话连续、流式输出、可中断 |
| 兼容 HTTP 聊天 | `chatService.sendMessageStream` | route endpoint -> OpenAI compatible stream | `/v1/chat/completions` 或兼容 HTTP 路径 | 非 Gateway 实例也可稳定流式聊天 |
| 会话持久化 | `studioConversationService` / `studio` 平台 | `listConversations/putConversation/deleteConversation` | `/claw/api/v1/studio/instances/{id}/conversations`、`/claw/api/v1/studio/conversations/{id}` | 刷新后会话仍一致 |

## 5. 实例目录与生命周期矩阵

| 能力 | 主入口 | 主调用链 | 下游 API/协议 | 验收点 |
| --- | --- | --- | --- | --- |
| 实例列表 | `instanceDirectoryService` / `studio` | `listInstances` | `/claw/api/v1/studio/instances` | 列表状态与侧边栏、命令面板一致 |
| 实例详情骨架 | `instanceService` | `getInstanceDetail` | `/claw/api/v1/studio/instances/{id}/detail` | 详情骨架与工作台初始化一致 |
| 实例生命周期 | `instanceService` | `startInstance/stopInstance/restartInstance/deleteInstance` | `/claw/api/v1/studio/instances/{id}` 与 `:start|stop|restart` | 操作后列表与详情同步刷新 |
| 设为活动实例 | `useInstanceStore` | `setActiveInstanceId` | 本地状态切换，后续读链回到 `studio.getInstanceDetail` | 聊天、市场、工作台共享同一活动实例 |

## 6. Instance Detail 十个分区矩阵

| 分区/动作 | 主服务 | 读链 | 写链 | 验收点 |
| --- | --- | --- | --- | --- |
| `overview` | `instanceWorkbenchService` | `studio.getInstanceDetail + gateway.getConfig/listModels/listAgents` | 只读为主 | 版本、健康、路径、连接信息可追溯 |
| `channels` | `instanceWorkbenchService` / `instanceService` | `gateway.channels.status` | `saveOpenClawChannelConfig/setOpenClawChannelEnabled -> gateway 或 openClawConfigService` | 渠道状态与配置回写一致 |
| `cronTasks` | `instanceWorkbenchService` | `gateway.cron.list/runs` | `add/update/remove/run/status`，Hosted Browser 对应 `/studio/instances/{id}/tasks*` | 任务新增、运行、启停、历史可验证 |
| `llmProviders` | `instanceWorkbenchService` / `instanceService` | `gateway.config.get + models.list` | `updateInstanceLlmProviderConfig` 或托管 Provider 投影链 | Provider、默认模型、推理模型、Embedding 模型一致 |
| 搜索/抓取/策略 | `instanceService` | 配置快照与工作台派生态 | `saveOpenClawWebSearchConfig/saveOpenClawWebFetchConfig/saveOpenClawWebSearchNativeCodexConfig/saveOpenClawXSearchConfig/saveOpenClawAuthCooldownsConfig/saveOpenClawDreamingConfig` | Web Search、Fetch、X Search、Cooldown、Dreaming 可读可写 |
| `agents` | `instanceWorkbenchService` / `instanceService` | `gateway.agents.list` | `saveAgent` 或 Gateway Config Patch | Agent 主模型、回退模型、默认 Agent 一致 |
| `skills` | `instanceWorkbenchService` / `agentSkillManagementService` | `gateway.skills.status` | `gateway.skills.install/update`，卸载回写配置与锁文件 | 技能安装、状态、生效范围一致 |
| `files` | `instanceService` | `gateway.agents.files.list/get` 或工作台快照 | `gateway.agents.files.set` 或 `/studio/instances/{id}/files/{fileId}` | 文件内容可读可写且不会漂移 |
| `memory` | `instanceWorkbenchService` | `gateway.doctor.memory.status/dreamDiary`，必要时 `memory_search/get` | 以运行态为主 | 记忆条目、Dream Diary、来源可信 |
| `tools` | `instanceWorkbenchService` | `gateway.tools.catalog` | 只读为主 | 工具清单、来源、最后使用信息可见 |
| `config` | `instanceService` | `gateway.config.get/schema/openFile` 或 `/studio/instances/{id}/config` | `config.set/patch/apply` 或 Hosted Studio 写接口 | 原始配置、Schema、应用结果一致 |

## 7. ClawHub、技能与生态矩阵

| 能力 | 主入口 | 主调用链 | 下游 API/协议 | 验收点 |
| --- | --- | --- | --- | --- |
| ClawHub 分类/技能/技能包浏览 | `marketService` | `clawHubService.listCategories/listSkills/listPackages` | ClawHub 服务 | 市场数据加载稳定、分类可筛选 |
| 技能安装到实例 | `marketService.installSkill` | `marketService -> agentSkillManagementService.installSkill -> gateway.skills.install` | OpenClaw Gateway | 安装结果、实例技能列表、锁文件一致 |
| 技能包安装 | `marketService.installPackWithSkills` | 逐项技能解析后复用技能安装链 | ClawHub + Gateway | 包内所选技能全部落地到目标实例 |
| 实例内技能卸载 | `mySkillService` | 已装技能解析 -> 配置清理/锁文件更新 | 实例配置 + ClawHub 跟踪元数据 | 卸载后工作台与市场“我的技能”同步 |

## 8. API 选型与实现规则

- 宿主级资源优先走 `/claw/api/v1/*`、`/claw/internal/v1/*`、`/claw/manage/v1/*`。
- 实例运行时细节优先走 Gateway，不把运行控制面塞进 Public API。
- 模型兼容与供应商接入优先走 Local Proxy，不让页面直接碰供应商协议。
- Hosted Browser 必须通过 `WebHostedStudioPlatform` 这类 infrastructure 契约访问 `/claw/api/v1/studio/*`，不允许 feature 包自行拼路径。

## 9. 回归与验收标准

- 每条能力链必须同时具备：读入口、写入口、失败面、日志面、升级后回归点。
- Provider 变更后必须能在 `Provider Center -> Kernel Center -> Instance Detail -> Chat/Task Runtime` 四处读回一致事实。
- OpenClaw 升级后必须复验：实例列表、详情、聊天、Provider 投影、Skill 安装、Local Proxy 请求日志。

## 10. 评估标准

| 评估项 | 合格线 | 领先线 | 当前判断 |
| --- | --- | --- | --- |
| 能力覆盖率 | 主要页面能力都有明确调用链 | 十个分区与治理面全部可映射 | `L4` |
| 读写对称性 | 写后能读回验证 | 每条链都有自动回归与证据留存 | `L3.5` |
| 真相源清晰度 | 能辨认谁是事实源 | 页面、运行态、持久态严格分层 | `L4` |
| 升级稳定性 | 升级后主要能力不失效 | API 矩阵可直接驱动升级回归清单 | `L3.5` |

## 11. 结论

这张矩阵的价值不在“说明系统很复杂”，而在把复杂度压成可核对、可测试、可升级的标准清单。后续任何新能力，只有纳入本矩阵，才算真正进入架构标准体系。

## 12. 2026-04-07 基线审计补充

- 已验证的能力事实：
  - `webStudio.ts` 已提供 `listInstances`、`getInstanceDetail`、会话持久化读写。
  - `channelService.ts` 已提供渠道状态切换、配置保存、配置删除。
  - `marketService.ts` 已提供 `listCategories`、`listSkills`、`listPackages`、`installSkill`、`installPackWithSkills`。
  - `local_ai_proxy.rs` 已覆盖 OpenAI 兼容接口、Anthropic 原生接口、Gemini 原生接口、Ollama 转译、请求日志与路由测试。
- 当前矩阵的主要缺口：
  - 对外 API、管理 API、内部 API、Gateway API、Proxy API 的版本化注册表还需继续工程化。
  - 写链已很多，但“写后读回 + 失败面 + 日志面 + 升级回归面”尚未全部自动化。
  - `Instance Detail`、`Gateway Client`、聊天状态机仍需拆分，避免调用矩阵继续堆叠到大文件。
- 因此 `Step 04` 的目标不是新增接口数量，而是把现有能力统一收口为稳定契约面。
