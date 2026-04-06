# Community Classified Entrance Design

## Context

`@sdkwork/claw-community` 现在仍然是一个以文章、讨论和公告为中心的内容社区，`news` 只是公告筛选，不是独立的分类信息模块。这和用户希望的方向不一致。

新的目标是把 `Community` 重构成一个参考 58 同城、BOSS 直聘、本地分类信息平台的信息入口，但不是简单复制传统黄页，而是让 `openclaw` 成为发布、撮合、整理和升级信息的智能助手入口。

这次会采用自主决策推进。用户已经明确要求不要继续询问，并要求按最优方案直接迭代，因此下面的方案视为本次执行基线。

## Business Analysis

参考 58 同城公开资料，可以提炼出两个对产品结构最重要的结论：

- 高营收核心长期来自商家侧的在线营销服务，而不是单纯的会员展示。
- 最适合先做深的高频高价值垂类是招聘，其次才是房产、二手、本地生活服务。

这意味着首版不应该平均铺开所有分类，而应该先做一个“招聘优先、分类可扩展、广告与线索位清晰”的信息入口。

## Product Goal

把 `Community` 重构成一个基于 `openclaw` 智能助手协作的分类信息服务入口，满足四个核心目标：

1. 用户一进入页面就能看到招聘/求职这一高价值主场景。
2. 个人和企业都能通过 `openclaw` 发起结构化发布，而不是只写自由文本帖子。
3. `news` 模块继续保留，作为平台公告、政策变化、活动快讯和产品更新入口。
4. 页面本身就要体现未来营收抓手，包括推荐位、智能代发、企业加速和高意向线索入口。

## Options Considered

### Option A: 在现有内容社区上继续加分类入口

Pros:
- 改动最小
- 兼容当前文章模型

Cons:
- 仍然是“内容社区”，不是“分类信息入口”
- 个人找工作、企业招聘、本地服务会变成二级能力
- 营收位和线索位没有自然位置

### Option B: 招聘优先的分类信息入口

Pros:
- 最贴近 58/招聘平台的高价值业务
- 能直接承接“个人找工作”和“企业招聘”
- 结构清晰，后续能扩展到房产、二手、本地服务
- `openclaw` 的智能代发、智能改写、智能匹配价值最明显

Cons:
- 需要重写页面信息架构
- 需要把发布流程从文章编辑器转成结构化表单 + 辅助生成

### Option C: 一次性做全量 58 式多分类门户

Pros:
- 表面上最完整
- 首页品类最丰富

Cons:
- 首版信息密度过高
- 数据和交互都容易显得空
- 招聘主场景不够强
- 会削弱 `openclaw` 作为核心助手的定位

## Decision

选择 Option B。

`Community` 应该被重构成“招聘优先的分类信息入口”，以求职和招聘作为首页核心流量池，同时保留：

- `news` 公告/资讯模块
- 可扩展的分类卡片
- 智能发布与智能匹配入口

## Information Architecture

### 1. Hero 区

Hero 要明确表达三件事：

- 这是一个分类信息服务入口
- `openclaw` 可以帮个人发求职，也可以帮企业发招聘
- 平台保留资讯和本地服务扩展能力

Hero 内包含：

- 页面标题和定位文案
- 搜索框
- 主要发布入口
- 次要入口
- 平台营收抓手提示

推荐两个主按钮：

- `openclaw 发布求职信息`
- `openclaw 发布企业招聘`

补充一个次级入口：

- `查看 news 快讯`

### 2. 高价值分类导航

首屏下方展示一排分类卡片，而不是旧版 posts/news 切换。

首版分类建议：

- 求职广场
- 企业招聘
- 灵活用工
- 本地服务
- 创业合作
- news

其中：

- `求职广场` 与 `企业招聘` 是默认主视图切换
- `news` 必须单独保留，且内容与其他分类信息区分开

### 3. 智能助手工作台

这是本次重构和传统分类信息站点最大的差异点。

工作台以 `openclaw` 为中心，展示 3 个助手能力卡：

- 求职助手：整理履历、生成求职文案、自动发布
- 招聘助手：生成 JD、提炼岗位亮点、发布招聘信息
- 线索助手：对高意向用户做跟进提醒和信息整理

这些卡片是未来可付费的基础服务位，也为后续和 `market`、`chat` 联动留入口。

### 4. 信息流主内容区

主内容区采用双模式：

- 分类信息模式
- news 模式

分类信息模式下展示结构化卡片：

- 标题
- 类型标签
- 地区
- 薪资/预算
- 发布者身份
- 发布时间
- 核心诉求
- `让 openclaw 帮我处理`

news 模式下继续展示官方资讯卡片：

- 标题
- 摘要
- 官方标签
- 发布时间

### 5. 右侧运营栏

右栏不再展示旧版 latest/online/hottest claw，而改成更贴近分类信息平台经营逻辑的模块：

- 今日热门岗位
- 急招企业
- 平台快讯
- 增值服务位

其中“增值服务位”直接体现未来营收模型：

- 智能置顶
- 企业急聘加速
- 简历优先推荐

## Content Model

现有 `CommunityPost` 需要升级成“统一信息项”模型，但仍保留兼容页面渲染的基本字段。

建议新增这些语义字段：

- `entryType`
- `audienceType`
- `location`
- `salary`
- `budget`
- `employmentType`
- `company`
- `contactPreference`
- `isFeatured`
- `assistantActions`

`entryType` 建议支持：

- `job-seeking`
- `recruitment`
- `service`
- `partnership`
- `news`

这样可以在不拆掉现有 package surface 的前提下，把首页、发布页和详情页统一起来。

## Publish Flow

`NewPost` 不应该继续是纯文章编辑器主导，而应该变成“智能发布工作台”。

发布流程改为：

1. 选择发布类型
2. 选择个人/企业身份
3. 填写结构化字段
4. 使用 `openclaw` 生成或润色标题与正文
5. 发布到对应分类

发布类型重点支持：

- 个人找工作
- 企业招聘
- 本地服务需求
- news 公告

仍然保留富文本能力，但它退居到“详细描述”位置。

## Detail Page

详情页应该按信息类型显示不同的主叙事：

- 求职信息：突出候选人能力、目标岗位、地点、期望薪资
- 招聘信息：突出公司、岗位、薪资、福利、地点
- news：突出官方身份、资讯正文和关联动态

所有详情页都要提供一个 `openclaw` 行动入口，例如：

- 帮我优化这条信息
- 帮我生成相似发布
- 帮我联系对方

## Revenue-Oriented Surfaces

为了对齐 58 类平台的高营收业务，页面需要在视觉和信息架构上预留变现能力：

- 首页推荐位
- 列表卡片中的精选标记
- 右侧企业急聘卡位
- 发布后的智能加速服务

首版只做展示和文案，不做真实支付流程，但组件结构应允许后续接入。

## Architecture

改动保持在 feature 边界内：

- `packages/sdkwork-claw-community/src/pages/community/Community.tsx`
- `packages/sdkwork-claw-community/src/pages/community/NewPost.tsx`
- `packages/sdkwork-claw-community/src/pages/community/CommunityPostDetail.tsx`
- `packages/sdkwork-claw-community/src/services/communityService.ts`
- `packages/sdkwork-claw-community/src/services/communityService.test.ts`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`
- `scripts/sdkwork-community-contract.test.ts`

如需更新导航文案，只改壳层文案，不把业务逻辑放进 host package。

## Error Handling

需要处理三类状态：

- 信息流为空
- 搜索无结果
- 详情不存在

发布流程还需要处理：

- 必填项缺失
- AI 生成失败
- 发布失败

这些状态都要保留明确的回退文案，不依赖控制台报错。

## Testing Strategy

先写失败测试，再写实现。

需要新增或改写的验证重点：

1. 服务测试
   - 能返回招聘优先的分类数据
   - `news` 仍然可单独筛选
   - 新增结构化字段存在
   - 发布新求职/招聘信息后会出现在列表顶部

2. 契约测试
   - 旧的 posts/news 入口被替换为分类信息入口
   - 页面出现 `openclaw` 发布能力
   - 页面保留 `news`
   - 页面出现招聘/求职/服务等新分类

3. 构建验证
   - 社区服务测试
   - 社区契约测试
   - `pnpm build`

## Success Criteria

这次重构完成时，应满足：

- `Community` 首页已经不是文章社区，而是分类信息入口
- 首页明确突出个人求职和企业招聘
- `openclaw` 成为发布与处理信息的中心助手
- `news` 模块仍然保留且可浏览
- 页面中已经体现未来营收抓手，如推荐位和加速服务位
- 数据与交互仍然留在 `@sdkwork/claw-community` 包内，不破坏现有分层
