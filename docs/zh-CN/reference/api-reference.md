# API 总览

## 范围

本页是当前 Claw Studio 原生 API 文档的入口页，说明 Rust Host 已经发布的原生接口面，以及它们和运行模式、鉴权、OpenAPI 发布之间的关系。

## 基础路径规则

当前原生平台 API 统一发布在 `/claw/*` 下。

已实现的路由族如下：

| 路由族 | 基础路径 | 作用 |
| --- | --- | --- |
| Health | `/claw/health/*` | 存活与就绪探针 |
| Public API | `/claw/api/v1/*` | 对外公开的原生发现与引导信息 |
| OpenAPI | `/claw/openapi/*` | 机器可读的 API 发现与 OpenAPI 文档 |
| Internal | `/claw/internal/v1/*` | 宿主运行时协调、node-session 状态与内控能力 |
| Manage | `/claw/manage/v1/*` | 面向运维和控制平面的 rollout / 管理能力 |

## 按运行模式理解 Base URL

同一套产品能力可以运行在不同宿主形态中，但规范化的 `/claw/*` HTTP API 只有在存在 Rust 宿主时才会可访问。

| 模式 | 原生 API 访问方式 | Base URL |
| --- | --- | --- |
| Web 工作区 | 不稳定，主要通过 preview bridge 或 mock bridge | 不提供正式 `/claw/*` HTTP 入口 |
| 桌面端运行时 | 规范 hosted flow 通过嵌入式 loopback HTTP 提供，service 生命周期接口保持关闭 | 通过运行时 `browserBaseUrl` 解析，通常是 `http://127.0.0.1:<dynamic-port>` |
| 原生 Server | 同源 HTTP | `http://<host>:<port>` |
| Container | 通过暴露端口访问同源 HTTP | `http://<host>:<port>` 或 ingress 地址 |
| Kubernetes | 通过 service 或 ingress 访问同源 HTTP | `https://<domain>` 或 service 地址 |

当前打包后的本地 Server 默认地址仍然是 `http://127.0.0.1:18797`，除非通过 `CLAW_SERVER_HOST` 或 `CLAW_SERVER_PORT` 覆盖。

当前 Rust Host 在 `server` 模式和 hosted `desktopCombined` 浏览器流程下都会发布 discovery：

## 发现接口

| 接口 | 作用 |
| --- | --- |
| `GET /claw/api/v1/discovery` | 对外公开的原生 API discovery |
| `GET /claw/openapi/discovery` | OpenAPI 文档发现接口 |
| `GET /claw/openapi/v1.json` | 已实现原生路由的 OpenAPI 3.1 JSON 文档 |

## 当前接口矩阵

### Health

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/claw/health/live` | 存活探针 |
| `GET` | `/claw/health/ready` | 就绪探针 |

### Public API

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/claw/api/v1/discovery` | 对外公开的原生发现与启动信息 |
| `GET` | `/claw/api/v1/studio/instances` | 查看规范化 studio 实例列表 |
| `POST` | `/claw/api/v1/studio/instances` | 创建一个 studio 实例 |
| `GET` | `/claw/api/v1/studio/instances/{id}` | 查看单个 studio 实例 |
| `PUT` | `/claw/api/v1/studio/instances/{id}` | 更新单个 studio 实例 |
| `DELETE` | `/claw/api/v1/studio/instances/{id}` | 删除单个 studio 实例 |
| `POST` | `/claw/api/v1/studio/instances/{id}:start` | 启动实例 |
| `POST` | `/claw/api/v1/studio/instances/{id}:stop` | 停止实例 |
| `POST` | `/claw/api/v1/studio/instances/{id}:restart` | 重启实例 |
| `GET` | `/claw/api/v1/studio/instances/{id}/detail` | 查看实例 detail 投影 |
| `GET` | `/claw/api/v1/studio/instances/{id}/config` | 读取实例配置 |
| `PUT` | `/claw/api/v1/studio/instances/{id}/config` | 更新实例配置 |
| `GET` | `/claw/api/v1/studio/instances/{id}/logs` | 读取实例日志投影 |
| `GET` | `/claw/api/v1/studio/instances/{id}/conversations` | 查看实例会话列表 |
| `PUT` | `/claw/api/v1/studio/conversations/{conversationId}` | 写入或更新单个会话 |
| `DELETE` | `/claw/api/v1/studio/conversations/{conversationId}` | 删除单个会话 |

### OpenAPI

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/claw/openapi/discovery` | 查看已发布的 OpenAPI 文档集合 |
| `GET` | `/claw/openapi/v1.json` | 下载当前 OpenAPI 3.1 文档 |

### Internal

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/claw/internal/v1/host-platform` | 读取宿主状态、能力和 state-store 投影 |
| `GET` | `/claw/internal/v1/node-sessions` | 查看 live 与 projected node-session 列表 |
| `POST` | `/claw/internal/v1/node-sessions:hello` | 注册节点运行时并获取 lease proposal |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:admit` | 正式接纳一个 hello 创建的 session |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:heartbeat` | 刷新 lease 并获取 posture hint |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:pull-desired-state` | 拉取当前 desired state |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:ack-desired-state` | 回写 desired state 的应用结果 |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:close` | 优雅关闭 live session |

### Manage

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/claw/manage/v1/rollouts` | 查看 rollout 列表 |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}` | 查看单个 rollout |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/targets` | 查看 preview 推导出的 target 列表 |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}` | 查看单个 target |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/waves` | 查看 preview 推导出的 wave 摘要 |
| `POST` | `/claw/manage/v1/rollouts/{rolloutId}:preview` | 计算或刷新 rollout preview |
| `POST` | `/claw/manage/v1/rollouts/{rolloutId}:start` | 在 preview 成功后启动 rollout |
| `GET` | `/claw/manage/v1/host-endpoints` | 查看规范化 host endpoint 列表 |
| `GET` | `/claw/manage/v1/openclaw/runtime` | 查看受管 OpenClaw runtime 投影 |
| `GET` | `/claw/manage/v1/openclaw/gateway` | 查看受管 OpenClaw gateway 投影 |
| `POST` | `/claw/manage/v1/openclaw/gateway/invoke` | 调用受管 OpenClaw gateway |
| `GET` | `/claw/manage/v1/service` | 查看原生服务状态，仅 `server` 模式提供 |
| `POST` | `/claw/manage/v1/service:install` | 安装原生服务，仅 `server` 模式提供 |
| `POST` | `/claw/manage/v1/service:start` | 启动原生服务，仅 `server` 模式提供 |
| `POST` | `/claw/manage/v1/service:stop` | 停止原生服务，仅 `server` 模式提供 |
| `POST` | `/claw/manage/v1/service:restart` | 重启原生服务，仅 `server` 模式提供 |

重要模式说明：

- `desktopCombined` 会通过嵌入式 loopback host 发布规范化的 `studio`、`internal`、`openapi` 和非 service 的 `manage` 流程。
- `/claw/manage/v1/service*` 在 `desktopCombined` 中不会发布，只存在于 `server` 模式。

## 鉴权模型

当前鉴权是可选的，并基于 HTTP Basic Auth。

| 接口面 | 默认状态 | 可选凭据 |
| --- | --- | --- |
| 浏览器壳 | 默认开放 | `CLAW_SERVER_MANAGE_USERNAME` / `CLAW_SERVER_MANAGE_PASSWORD` |
| `/claw/manage/v1/*` | 默认开放 | `CLAW_SERVER_MANAGE_USERNAME` / `CLAW_SERVER_MANAGE_PASSWORD` |
| `/claw/internal/v1/*` | 默认开放 | `CLAW_SERVER_INTERNAL_USERNAME` / `CLAW_SERVER_INTERNAL_PASSWORD` |

## 快速示例

先设置本地基础地址：

```bash
export CLAW_BASE_URL=http://127.0.0.1:18797
```

读取 readiness：

```bash
curl -i "$CLAW_BASE_URL/claw/health/ready"
```

读取 public discovery：

```bash
curl "$CLAW_BASE_URL/claw/api/v1/discovery"
```

下载 OpenAPI 文档：

```bash
curl "$CLAW_BASE_URL/claw/openapi/v1.json"
```

在启用 manage 鉴权后读取 rollout 列表：

```bash
curl -u operator:manage-secret \
  "$CLAW_BASE_URL/claw/manage/v1/rollouts"
```

执行一次 rollout preview：

```bash
curl -u operator:manage-secret \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"includeTargets":true,"forceRecompute":false}' \
  "$CLAW_BASE_URL/claw/manage/v1/rollouts/rollout-a:preview"
```

读取 host-platform：

```bash
curl -u internal:internal-secret \
  "$CLAW_BASE_URL/claw/internal/v1/host-platform"
```

## 当前 OpenAPI 边界

当前发布的 OpenAPI 文档只覆盖已经实现的原生路由，包括 `health`、`api`、`internal` 和 `manage`。

它当前不会对外宣称：

- 更宽泛的 `/claw/api/v1/*` 业务资源
- 插件托管的 HTTP 接口面
- 仍处于架构定义阶段的 compatibility gateway alias

## 示例响应

public discovery 示例：

```json
{
  "family": "api",
  "version": "v1",
  "basePath": "/claw/api/v1",
  "hostMode": "server",
  "hostVersion": "0.1.0",
  "openapiDocumentUrl": "/claw/openapi/v1.json",
  "healthLiveUrl": "/claw/health/live",
  "healthReadyUrl": "/claw/health/ready",
  "capabilityKeys": ["api.discovery.read"],
  "generatedAt": 1743600000000
}
```

错误包络示例：

```json
{
  "error": {
    "code": "rollout_not_found",
    "category": "state",
    "message": "The requested rollout was not found.",
    "httpStatus": 404,
    "retryable": false,
    "resolution": "fix_request",
    "correlationId": "claw-1234567890"
  }
}
```

排查问题时，应优先记录 `x-claw-correlation-id` 响应头，它是浏览器诊断、日志对齐和运维支持的主请求追踪 id。
