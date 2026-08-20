---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '5a307813-15d5-48f3-b07a-95bcb5ab4b0e'
  PropagateID: '5a307813-15d5-48f3-b07a-95bcb5ab4b0e'
  ReservedCode1: 'ae066df0-b9d0-4c93-bb92-81e6e877dc25'
  ReservedCode2: 'ae066df0-b9d0-4c93-bb92-81e6e877dc25'
---

# AI 智训通 Next.js 重构版

这是 AI 智训通重构版的第一阶段工程骨架，目标是先跑通“管理端 H5 + 独立 API 服务 + SQLite 持久化 + AI/STT/TTS 接口预留”的真实业务闭环。

## 技术基线

- 管理端：Next.js + TypeScript，位于 `apps/admin`
- API 服务：Next.js Route Handler，位于 `apps/api`
- 数据库：Prisma + SQLite，本地持久化到 `storage/dev.db`
- 后续迁移：通过 Prisma migration 迁移到 MySQL 8
- AI 能力：LLM、STT、TTS 走 `packages/ai-provider` 统一适配层
- SaaS 预留：核心业务模型都保留 `tenant_id` 和审计字段

## 本地启动

```powershell
npm.cmd install
npm.cmd run setup
node scripts/build.mjs all
node scripts/start-local.mjs
```

> 注意：构建必须走根目录统一脚本 `node scripts/build.mjs`（或 `npm run build`），
> 不要直接用 `npm.cmd run dev:api` / `npm.cmd run dev:admin` 或旧式 `npm --workspaces run build`——
> 前者在 CodeBuddy/WorkBuddy 沙箱下可能因 safe-delete 拦截 `.next` 清理而失败，后者缺少保护开关。
>
> 构建脚本用法：
> ```powershell
> node scripts/build.mjs        # 构建 api + admin + mobile
> node scripts/build.mjs api    # 只构建 api
> node scripts/build.mjs admin  # 只构建 admin
> node scripts/build.mjs mobile # 只构建 mobile
> npm run build                 # 等价 build.mjs all
> ```

默认端口：

- 管理端 H5：http://localhost:3000
- API 服务：http://localhost:4000/api

## 重要约束

1. `apps/admin` 只能调用 HTTP API，不允许直接访问数据库、文件系统或模型 Key。
2. `apps/api` 是唯一数据访问层，负责租户隔离、权限校验、AI 调用和审计。
3. 未配置真实模型 API Key 时，AI 生成接口返回明确错误，不用假数据冒充真实模型生成。
4. SQLite 只用于本地验证，表结构通过 Prisma schema 维护，后续迁移 MySQL。
## 已实现功能

### 管理端

- **登录与会话**：账号密码登录 + 图形滑块验证码，7 天有效期 Bearer Token，支持退出登录和当前用户展示。
- **行业包**：新增/管理客服、面试官、内训师、自定义行业包。
- **人员管理**：新增参训学员/内训师/管理员，支持所属组织选择。
- **组织管理**：创建部门/公司/班组/外部组织，统计组织下人员数。
- **场景工厂**：手工创建场景、AI 创建场景、场景详情查看、评分规则编辑（总分校验 100）。
- **任务中心**：创建任务（选择场景 + 参训人员/组织范围）、发布任务、任务详情查看。
- **资料话术库**：按行业包/场景录入文本资料、FAQ、制度、案例和标签。
- **数据复盘**：查看训练记录列表、记录详情（对话轮次、评分明细、扣分证据）、后台录入训练结果。
- **评分申诉**：提交申诉、管理员复核处理（通过/驳回）。
- **能力模型**：按行业包创建岗位能力模型和能力项，权重合计校验为 100。
- **系统配置**：租户与套餐配置（额度、到期时间）、AI 模型配置（LLM/STT/TTS，Key 仅存后端）。

### API 接口

| 模块 | 接口 |
|------|------|
| 认证 | `POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout` |
| 行业包 | `GET/POST /api/industry-packages` |
| 人员 | `GET/POST /api/users` |
| 组织 | `GET/POST /api/organizations` |
| 场景 | `GET/POST /api/scenes`、`GET /api/scenes/{id}`、`PUT /api/scenes/{id}/scoring-rules`、`POST /api/scenes/{id}/publish` |
| AI 场景生成 | `POST /api/ai/scenes/generate` |
| 任务 | `GET/POST /api/tasks`、`GET /api/tasks/{id}`、`POST /api/tasks/{id}/publish` |
| 训练记录 | `GET/POST /api/training-records`、`GET /api/training-records/{id}` |
| 资料 | `GET/POST /api/materials` |
| 申诉 | `GET/POST /api/appeals`、`PUT /api/appeals/{id}` |
| 能力模型 | `GET/POST /api/capability-models` |
| 租户配置 | `GET/PUT /api/tenant/current` |
| 模型配置 | `GET/POST /api/configs/ai-providers` |
| 语音 | `POST /api/ai/stt/transcribe`、`POST /api/ai/tts/synthesize` |

## 开发校验

```powershell
npm.cmd --workspace @zxt/shared run typecheck
npm.cmd --workspace @zxt/database run typecheck
npm.cmd --workspace @zxt/api run typecheck
npm.cmd --workspace @zxt/admin run typecheck
```

`npm.cmd run start:local` 会等待 `http://localhost:4000/api/health` 和 `http://localhost:3000` 真正可访问后才写入 `.logs/pids.json`，避免半启动误判。

> 本地默认账号和密码请参考 `.env.example` 中的种子配置说明；登录前需完成一次图形滑块验证码，后端会发放一次性 `captchaToken`。

> AI生成