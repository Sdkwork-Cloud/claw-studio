# Claw Studio - 前端SDK接入执行规范

## 项目概述

**应用名称**: Claw Studio (OpenClaw)  
**技术栈**: React + TypeScript + Vite + Tauri + pnpm Workspace  
**API调用**: 直接HTTP请求 (基于 `@sdkwork/claw-infrastructure` 的 HTTP 客户端)  
**目标平台**: Windows / macOS / Linux 桌面应用 / Web浏览器

---

## 核心原则

### 1. 架构理解

```
后端服务 (端口: 8080)
    ↓ REST API
HTTP客户端 (@sdkwork/claw-infrastructure)
    ↓ 封装
Feature Packages (各业务模块)
    ↓
Web/Desktop Hosts (claw-web / claw-desktop)
```

### 2. 目录结构规范

```
claw-studio/
├── packages/
│   ├── sdkwork-claw-web/                # Web主机 (Vite)
│   │   ├── src/
│   │   │   ├── App.tsx                  # 应用入口
│   │   │   ├── main.tsx                 # 入口文件
│   │   │   └── env.ts                    # 环境配置
│   │   └── vite.config.ts
│   ├── sdkwork-claw-desktop/            # Desktop主机 (Tauri)
│   │   ├── src/
│   │   │   └── main.tsx
│   │   ├── src-tauri/
│   │   │   ├── src/
│   │   │   └── tauri.conf.json
│   │   └── Cargo.toml
│   ├── sdkwork-claw-shell/              # Shell层 (路由、布局)
│   │   └── src/
│   ├── sdkwork-claw-core/               # 核心层 (stores, services, hooks)
│   │   └── src/
│   │       ├── hooks/                   # 共享Hooks
│   │       ├── services/                # 共享Services
│   │       └── stores/                   # Zustand状态管理
│   ├── sdkwork-claw-infrastructure/     # 基础设施层
│   │   └── src/
│   │       ├── http/                    # HTTP客户端
│   │       ├── config/                  # 配置管理
│   │       └── platform/                # 平台适配
│   ├── sdkwork-claw-types/              # 类型定义层
│   │   └── src/
│   ├── sdkwork-claw-ui/                 # UI组件库
│   │   └── src/
│   ├── sdkwork-claw-i18n/               # 国际化
│   │   └── src/
│   ├── sdkwork-claw-commons/            # 共享组件
│   │   └── src/
│   ├── sdkwork-claw-distribution/       # 发行管理
│   │   └── src/
│   │       ├── manifests/               # 清单
│   │       └── providers/               # 提供商
│   └── sdkwork-claw-*/                   # Feature Packages
│       ├── claw-chat/                   # 聊天模块
│       ├── claw-market/                 # 市场模块
│       ├── claw-settings/               # 设置模块
│       ├── claw-auth/                   # 认证模块
│       ├── claw-account/                # 账户模块
│       ├── claw-install/                # 安装模块
│       ├── claw-instances/              # 实例模块
│       ├── claw-dashboard/              # 仪表板
│       ├── claw-channels/               # 渠道模块
│       ├── claw-tasks/                  # 任务模块
│       ├── claw-center/                  # 个人中心
│       ├── claw-apps/                   # 应用模块
│       ├── claw-devices/                # 设备模块
│       ├── claw-github/                 # GitHub模块
│       ├── claw-community/              # 社区模块
│       ├── claw-extensions/             # 扩展模块
│       ├── claw-docs/                   # 文档模块
│       └── claw-model-purchase/         # 模型购买模块
├── scripts/                              # 构建/验证脚本
├── docs/                                 # VitePress文档
└── prompt/
    └── execute.md                        # 本执行规范
```

### 3. 依赖层次规则

依赖流向由 `scripts/check-arch-boundaries.mjs` 强制执行：

```
web / desktop
  └─> shell
        └─> feature packages
              └─> commons, core, infrastructure, i18n, types, ui
core  ──> infrastructure, i18n, types
infra ──> i18n, types
types / ui / i18n ──> self only
```

**Import规则**:
- 只能从包根目录导入: `@sdkwork/claw-market`，禁止 `@sdkwork/claw-market/src/...`
- 每个包的 `package.json` 只导出 `"."`
- 包内导入服务通过 barrel 文件 (`../services`)，而非直接路径 (`../services/fooService`)
- 禁止使用旧的 `@sdkwork/claw-studio-*` 桥接引用

### 4. Service层开发规范

所有业务Service必须遵循以下原则：

1. **HTTP客户端获取**: 使用 `@sdkwork/claw-infrastructure` 的 HTTP 模块
2. **状态管理**: 使用 Zustand stores (`useXStore.ts`)
3. **错误处理**: 统一处理HTTP调用异常，适配桌面端交互
4. **类型安全**: 充分利用 `@sdkwork/claw-types` 的类型定义

**Service模板示例**:

```typescript
import { http } from '@sdkwork/claw-infrastructure';
import type { ChatMessage } from '@sdkwork/claw-types';

export interface SendMessageRequest {
  content: string;
  sessionId: string;
}

export async function sendMessage(params: SendMessageRequest): Promise<ChatMessage> {
  try {
    const response = await http.post<ChatMessage>('/api/chat/message', params);
    return response.data;
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
}
```

**Store使用示例**:

```typescript
import { create } from 'zustand';
import { sendMessage } from './chatService';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (content: string, sessionId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  sendMessage: async (content, sessionId) => {
    set({ isLoading: true });
    try {
      const message = await sendMessage({ content, sessionId });
      set((state) => ({ messages: [...state.messages, message] }));
    } finally {
      set({ isLoading: false });
    }
  },
}));
```

### 5. Tauri原生能力使用规范

```typescript
// 正确：通过Tauri API访问原生能力
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';

// 调用Rust命令
const result = await invoke('my_command', { arg: 'value' });

// 文件选择
const selected = await open({ multiple: false, filters: [{ name: 'Images', extensions: ['png', 'jpg'] }] });

// 文件读写
const content = await readFile(filePath);
await writeFile(filePath, new Uint8Array(content));

// 执行系统命令
const output = await Command.create('echo', ['hello']).execute();
```

---

## 执行流程

### 阶段一：环境准备与基础服务

1. **确认后端服务状态**
   - 确保后端服务运行在 `http://localhost:8080`
   - 验证 API 文档可访问

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **配置环境变量**
   - 复制 `.env.example` 到 `.env`
   - 配置必要的环境变量

4. **基础服务配置**
   - 检查 `packages/sdkwork-claw-infrastructure/src/http` HTTP客户端配置
   - 检查 `packages/sdkwork-claw-core/src/services` 共享服务
   - 建立统一的错误处理和响应解析机制

### 阶段二：逐个模块功能开发

按优先级顺序处理各业务模块：

#### P0 - 核心基础模块

1. **Auth (认证模块)**
   - Package: `sdkwork-claw-auth`
   - API: `/auth/**`, `/login/**`, `/register/**`, `/oauth/**`
   - 功能: 登录、注册、OAuth、Token刷新

2. **Account (账户模块)**
   - Package: `sdkwork-claw-account`
   - API: `/profile/**`, `/account/**`
   - 功能: 用户信息、个人资料、账户设置

#### P1 - 核心业务模块

1. **Chat (聊天模块)**
   - Package: `sdkwork-claw-chat`
   - API: `/chat/**`, `/session/**`, `/message/**`
   - 功能: 会话列表、消息收发

2. **Market (市场模块)**
   - Package: `sdkwork-claw-market`
   - 功能: AI市场、模型浏览

3. **Install (安装模块)**
   - Package: `sdkwork-claw-install`
   - 功能: 应用安装、管理

4. **Instances (实例模块)**
   - Package: `sdkwork-claw-instances`
   - 功能: 实例管理

#### P2 - 扩展业务模块

1. **Settings (设置)**
   - Package: `sdkwork-claw-settings`
   - API: `/settings/**`
   - 功能: 应用设置

2. **Dashboard (仪表板)**
   - Package: `sdkwork-claw-dashboard`
   - 功能: 数据展示、统计

3. **Channels (渠道)**
   - Package: `sdkwork-claw-channels`
   - 功能: 渠道管理

4. **Tasks (任务)**
   - Package: `sdkwork-claw-tasks`
   - 功能: 任务管理

5. **Center (个人中心)**
   - Package: `sdkwork-claw-center`
   - 功能: 用户中心

6. **Apps (应用)**
   - Package: `sdkwork-claw-apps`
   - 功能: 应用管理

7. **Devices (设备)**
   - Package: `sdkwork-claw-devices`
   - 功能: 设备管理

8. **GitHub**
   - Package: `sdkwork-claw-github`
   - 功能: GitHub集成

9. **Community (社区)**
   - Package: `sdkwork-claw-community`
   - 功能: 社区功能

10. **Extensions (扩展)**
    - Package: `sdkwork-claw-extensions`
    - 功能: 扩展管理

11. **Docs (文档)**
    - Package: `sdkwork-claw-docs`
    - 功能: 文档浏览

12. **Model Purchase (模型购买)**
    - Package: `sdkwork-claw-model-purchase`
    - 功能: 模型购买

### 阶段三：开发迭代流程

```
1. 分析需求
   ↓
2. 确定功能模块
   ↓
3. 在对应package中开发
   ↓
4. 实现Service和Store
   ↓
5. 开发组件和页面
   ↓
6. 验证功能
   pnpm dev
   ↓
7. 运行检查
   pnpm lint
   ↓
8. 重复迭代直到功能完美
```

---

## 开发检查清单

### 每个模块开发时需检查：

- [ ] HTTP API 调用是否正确
- [ ] 错误处理是否完善 (含网络错误、超时处理)
- [ ] 加载状态是否处理 (Skeleton/Loading)
- [ ] 空状态是否处理 (EmptyState)
- [ ] 分页/无限滚动是否正确实现
- [ ] Tauri原生能力调用是否正确 (文件系统/对话框等)
- [ ] 响应式布局是否正常
- [ ] 包依赖是否合法 (通过 `pnpm check:arch` 验证)
- [ ] 导出是否符合契约 (通过 `pnpm check:sdkwork-*` 验证)

### 代码质量检查：

```bash
# 运行所有契约测试
pnpm check:parity

# 运行特定契约测试
pnpm check:sdkwork-chat
pnpm check:sdkwork-auth
pnpm check:sdkwork-settings

# 架构边界检查
pnpm check:arch

# 构建验证
pnpm build

# 类型检查 (在每个包中)
pnpm --filter @sdkwork/claw-chat typecheck

# 开发服务器
pnpm dev

# 桌面端开发
pnpm tauri:dev

# 桌面端构建
pnpm tauri:build
```

---

## 重要配置

### 环境变量

```env
# .env.development
VITE_API_BASE_URL=http://localhost:8080
VITE_ACCESS_TOKEN=your-test-token
VITE_APP_ID=your-app-id
VITE_RELEASE_CHANNEL=stable
VITE_DISTRIBUTION_ID=your-distribution-id
VITE_PLATFORM=web
GEMINI_API_KEY=your-gemini-api-key
```

### HTTP客户端配置

```typescript
// 在 claw-infrastructure 中配置
import { createHttpClient } from '@sdkwork/claw-infrastructure';

const http = createHttpClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
});
```

### Tauri配置

```json
// sdkwork-claw-desktop/src-tauri/tauri.conf.json
{
  "identifier": "com.sdkwork.claw",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:3001"
  },
  "app": {
    "windows": [
      {
        "title": "Claw Studio",
        "width": 1400,
        "height": 900
      }
    ]
  }
}
```

---

## 构建与部署

### Web构建

```bash
pnpm build          # 生产构建
pnpm dev            # 开发模式
pnpm preview        # 本地预览
```

### 桌面端构建

```bash
# 开发模式
pnpm tauri:dev

# 构建桌面应用
pnpm tauri:build
```

### 包管理

```bash
# 安装依赖
pnpm install

# 运行特定包的命令
pnpm --filter @sdkwork/claw-chat dev
pnpm --filter @sdkwork/claw-chat build
pnpm --filter @sdkwork/claw-chat typecheck
```

---

## 调试指南

### Web调试

```bash
pnpm dev              # 启动开发服务器 (http://localhost:3001)
```

### Tauri调试

```bash
# 启动Tauri开发模式 (含Rust调试)
pnpm tauri:dev

# 查看Rust日志
RUST_LOG=debug pnpm tauri:dev

# Chrome DevTools 调试
# 1. 在应用中按 F12 或 Ctrl+Shift+I
```

---

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件/页面 | PascalCase.tsx | `ChatPage.tsx`, `SettingsPanel.tsx` |
| 服务/工具 | camelCase.ts | `chatService.ts`, `formatDate.ts` |
| Zustand Store | useXStore.ts | `useChatStore.ts`, `useUserStore.ts` |
| Package Scope | @sdkwork/claw-xxx | `@sdkwork/claw-chat` |
| 目录名称 | kebab-case | `sdkwork-claw-chat` |

---

## 契约测试

`scripts/*-contract.test.ts` 文件断言每个包的公共表面（导出、文件存在性、i18n keys、依赖约束）。

添加新导出或文件到包时，检查其契约测试是否需要更新：

```bash
# 运行所有契约测试
pnpm check:parity

# 运行单个契约测试
node --experimental-strip-types scripts/sdkwork-chat-contract.test.ts
```

---

## 参考文档

- 项目架构: `docs/core/architecture.md`
- 桌面端开发: `docs/core/desktop.md`
- 包开发指南: `docs/core/packages.md`
- Tauri文档: https://tauri.app/docs

---

## 成功标准

1. 所有P0/P1模块完成功能开发
2. `pnpm build` 构建成功
3. `pnpm lint` 检查通过
4. `pnpm check:parity` 契约测试通过
5. `pnpm tauri:build` 桌面构建成功
6. 核心业务流程端到端测试通过
7. 应用能在Web端和桌面端正常运行
