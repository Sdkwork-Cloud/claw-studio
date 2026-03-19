# API Router Design

## 背景

当前 shell 已经暴露了 `/api-router` 路由和 sidebar 入口，但实际页面仍然是占位内容。这会带来三个直接问题：

1. 产品层面：用户已经能看到入口，却无法管理 channel 与 Proxy Provider。
2. 架构层面：如果继续把页面直接写进 shell，会破坏既定的 feature package 分层。
3. 演进层面：未来真正的 API Router 一定会连接模型路由、配额、分组、失效治理与接入文档，先天需要独立模块。

## 代码与产品审查结论

### 需要立即修正的结构问题

1. `/api-router` 目前只有 shell 占位路由，没有独立 feature 包，和 `channels / market / tasks` 的模式不一致。
2. `shell` 合约脚本当前把 API Router 固化成 coming soon，这会反向阻止功能落地。
3. 仓库结构检查、parity 脚本、feature bridge 合约尚未把 `sdkwork-claw-apirouter` 纳入治理面。
4. 命令面板与导航文案仍然把 API Router 描述为“预留路由”，和真实产品状态不一致。

### 发现但本次不大动的中期问题

1. `@sdkwork/claw-core` 与 `@sdkwork/claw-shell` 都存在 `Sidebar` 语义，命名容易混淆。
2. 领域类型分布仍不够统一，很多 mock-only 类型停留在 infrastructure 内部，后续应逐步沉淀到 `@sdkwork/claw-types`。
3. 目前 feature contract 体系偏“字符串断言”，足够防回归，但对行为正确性的覆盖仍弱于真正的组件与服务测试。

## 方案对比

### 方案 A：继续在 shell 中直接实现页面

- 优点：改动最少，交付最快。
- 缺点：违反 `shell -> feature` 边界，后续服务、测试、数据模型都会继续堆在 shell。
- 结论：拒绝。

### 方案 B：新增 feature 包，但把全部领域模型留在 feature 内

- 优点：能满足当前页面和服务需求，改动适中。
- 缺点：`channel / proxy provider / group` 是天然可复用的业务实体，未来很可能被设置、聊天、路由策略面复用。
- 结论：可行，但不是最优。

### 方案 C：新增 feature 包，同时把 API Router 领域模型提升到 shared types，并通过 infrastructure mock service 提供统一数据

- 优点：最符合当前分层；页面、服务、mock 数据、契约检查都能长期演进；未来接真实后端时替换成本最低。
- 缺点：一次性改动面更广，需要同步脚本和测试。
- 结论：采用此方案。

## 最终设计

## 模块边界

- 新增 `packages/sdkwork-claw-apirouter`
- `shell` 只负责路由接入与导航导入
- `feature` 自己拥有 `components / pages / services`
- `types` 新增 API Router 领域实体
- `infrastructure` 扩展 `studioMockService`，作为当前统一 mock 后端

## 页面信息架构

页面保持“两栏主结构”：

- 左侧：`channel sidebar`
  - 展示基础模型厂家，例如 OpenAI、Anthropic、Google、xAI、DeepSeek、Qwen、Zhipu
  - 每个 channel 显示描述、provider 数量、健康状态摘要
  - 点击后筛选右侧 Proxy Provider 表格
- 右侧：`proxy provider table`
  - 顶部包含标题、状态摘要、搜索框、可选 group 过滤
  - 主体是表格列表

表格列定义：

1. 名称
2. API KEY
   - 默认脱敏显示
   - 提供一键复制完整 key
3. 分组
   - 行内 `Select`
   - 支持直接切换分组
4. 用量
   - 展示请求量与成本摘要
5. 过期时间
6. 状态
7. 创建时间
8. 操作
   - 使用方法
   - 禁用
   - 编辑
   - 删除

## 核心交互设计

### Channel Sidebar

- 默认选中第一个 channel
- 支持显示 active/warning/disabled 数量
- 显示按 provider 状态聚合的“风险提示”，让左侧不仅是目录，也是导航摘要

### API KEY 交互

- 表格中展示脱敏值
- 点击复制按钮时复制完整 key
- 使用 `toast` 给出成功反馈

### 分组变更

- 使用行内 `Select`
- 变更后立即更新并 toast 提示
- 这是运营后台高频动作，不做弹窗确认

### 使用方法

- 打开说明弹窗
- 内容包括：
  - base URL
  - 鉴权头
  - 推荐模型前缀
  - `curl` 示例
  - 当前分组与 channel

### 编辑

- 打开编辑弹窗
- 可编辑名称、分组、过期时间、备注性 endpoint 文案
- 保持最小必要字段，避免把创建流程一起塞进本次范围

### 禁用

- 行级别直接动作
- 已禁用 provider 不再重复“禁用”，改为“启用”
- 状态列和 sidebar 聚合同步变化

### 删除

- 使用 confirm 做最后保护
- 删除后如果当前 channel 没有 provider，右侧展示空状态

## 数据模型

共享类型建议新增：

- `ApiRouterChannel`
- `ProxyProvider`
- `ProxyProviderGroup`
- `ProxyProviderStatus`
- `ProxyProviderUsage`
- `UpdateProxyProviderDTO`

其中 `ProxyProvider` 至少包含：

- `id`
- `channelId`
- `name`
- `apiKey`
- `groupId`
- `usage`
- `expiresAt`
- `status`
- `createdAt`
- `baseUrl`
- `models`

## 数据流

1. 页面载入后通过 `apiRouterService` 拉取 channels、groups、providers。
2. 左侧选择 channel 后，右侧表格基于 `channelId` 过滤。
3. 行内分组、禁用、编辑、删除通过 mutation 更新。
4. mutation 成功后刷新 query 缓存并同步 sidebar 聚合。

## 为什么这里不引入“顶尖算法”

这次需求本质上是“运营控制台 + 配置管理面”，不是“实时模型路由引擎”。在当前阶段，引入复杂算法不会让用户更快完成任务，反而会增加维护成本。

真正值得在下一阶段引入的领先算法，不在 CRUD 页面，而在未来的路由引擎中：

- 多目标打分：同时考虑成本、延迟、稳定性、配额、失效率
- 配额感知路由：接近过期或额度边界时自动降权
- 带探索项的自适应路由：可用 contextual bandit 或 constrained bandit 做 provider 探索
- 熔断与恢复：基于失败率和恢复窗口做 circuit breaker

本次实现只需要把这些未来能力的承载结构准备好：channel、provider、group、status、usage、expiry、usage method。

## 测试与治理

需要同步补齐：

- `sdkwork-claw-apirouter` feature contract
- `check:parity` 根脚本
- `check-sdkwork-claw-structure.mjs`
- `sdkwork-feature-bridges-contract.test.ts`
- `sdkwork-shell-contract.test.ts`
- `studioMockService` 行为测试
- `apiRouterService` 服务测试

## 决策

在用户明确要求“不打扰、由我代做决策”的前提下，本设计直接视为批准版本，按方案 C 进入实现。
