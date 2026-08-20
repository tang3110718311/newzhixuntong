---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '35b310a7-3371-450d-b0d9-02d663702b5f'
  PropagateID: '35b310a7-3371-450d-b0d9-02d663702b5f'
  ReservedCode1: '32314161-cf14-4f10-a774-e6180223b8f8'
  ReservedCode2: '32314161-cf14-4f10-a774-e6180223b8f8'
---

# AI 智训通 Next.js 重构版

AI 智训通是一套面向企业培训场景的 AI 对练与考核平台，覆盖管理端、移动端和独立 API 服务，支持 AI 语音对练、考试测评、知识库管理、训练数据复盘等完整业务闭环。

## Monorepo 结构

```
zxt-next/
├── apps/
│   ├── admin/      # 管理端（Next.js，端口 3000）
│   ├── api/        # API 服务（Next.js Route Handler，端口 4000）
│   └── mobile/     # 学员移动端（Next.js，端口 3100）
├── packages/
│   ├── ai-provider/  # AI 供应商统一适配层（LLM/STT/TTS）
│   ├── database/     # 数据层（Prisma + sql.js 双实现）
│   └── shared/       # 共享类型、API 客户端、Zod 校验
├── scripts/          # 构建、启停、HTTPS 证书、冒烟测试等脚本
└── deploy/           # Docker 部署文件
```

## 技术基线

- **管理端**：Next.js + TypeScript，位于 `apps/admin`
- **移动端**：Next.js + TypeScript，位于 `apps/mobile`（单页 SPA，学员端所有功能在组件内切换）
- **API 服务**：Next.js Route Handler，位于 `apps/api`，是唯一数据访问层
- **数据库**：Prisma schema（24 个 model）+ sql.js 内存/持久化库（31 张表），本地持久化到 `storage/dev.db`
- **AI 能力**：LLM、STT、TTS 走 `packages/ai-provider` 统一适配层，对接通义千问等模型
- **SaaS 预留**：核心业务模型保留 `tenant_id` 和审计字段，支持多租户隔离

## 本地启动

```powershell
npm.cmd install
npm.cmd run setup          # 初始化 SQLite 数据库
node scripts/build.mjs all # 构建三端
node scripts/start-local.mjs
```

> 构建必须走根目录统一脚本 `node scripts/build.mjs`（或 `npm run build`），不要直接用 `npm.cmd run dev:api` / `npm.cmd run dev:admin`。

构建脚本用法：
```powershell
node scripts/build.mjs        # 构建 api + admin + mobile
node scripts.build.mjs api    # 只构建 api
node scripts/build.mjs admin  # 只构建 admin
node scripts/build.mjs mobile # 只构建 mobile
npm run build                 # 等价 build.mjs all
```

默认端口：

- 管理端：http://localhost:3000
- API 服务：http://localhost:4000/api
- 移动端：http://localhost:3100

> 移动端需要 HTTPS 才能使用麦克风权限，用 `npm run start:mobile:https` 启动。

## 已实现功能

### 管理端

- **登录与会话**：账号密码登录 + 图形滑块验证码，7 天 Bearer Token，支持多租户切换。
- **人员管理**：新增/编辑参训学员、内训师、管理员，支持密码重置和所属组织选择。
- **组织管理**：创建部门/公司/班组/外部组织，统计组织下人员数。
- **角色与权限**：角色管理、菜单管理，支持按角色分配菜单权限。
- **行业包**：新增/管理客服、面试官、内训师、自定义行业包。
- **能力模型**：按行业包创建岗位能力模型和能力项，权重合计校验为 100。
- **场景工厂**：手工创建场景、AI 创建场景、场景复制、批量创建、场景详情查看、评分规则编辑（总分校验 100）。
- **任务中心**：创建任务（选择场景 + 参训人员/组织范围）、发布任务、停止任务、任务详情查看。
- **对练中心**：独立页面承载 AI 语音对练，支持 TTS 播放和 STT 识别。
- **资料话术库**：按行业包/场景录入文本资料、FAQ、制度、案例和标签。
- **企业知识库**：文件夹/文件管理，支持知识库与场景绑定。
- **考试系统**：题库管理、题目管理、创建考试、发布考试。
- **数据复盘**：查看训练记录列表、记录详情（对话轮次、评分明细、扣分证据）、后台录入训练结果。
- **评分申诉**：提交申诉、管理员复核处理（通过/驳回）。
- **大屏看板**：总览统计、学员维度统计、部门维度统计、公司维度统计。
- **系统配置**：租户与套餐配置（额度、到期时间）、AI 模型配置（LLM/STT/TTS，Key 仅存后端）。

### 移动端（学员侧）

- 登录认证（手机验证码 + 密码）
- 任务列表与考试列表
- AI 语音对练（TTS 播放 + STT 识别）
- 考试答题与提交
- 训练记录查看

### API 接口

| 模块 | 接口 |
|------|------|
| 认证 | `POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout`、`POST /api/auth/send-code`、`GET /api/auth/captcha`、`POST /api/auth/switch-tenant` |
| 租户 | `GET /api/tenant/current`、`GET /api/tenants/mine` |
| 组织 | `GET/POST /api/organizations`、`/api/organizations/{id}` |
| 用户 | `GET/POST /api/users`、`/api/users/{id}`、`POST /api/users/{id}/reset-password` |
| 角色 | `GET/POST /api/roles`、`/api/roles/{id}` |
| 菜单 | `GET/POST /api/menus`、`/api/menus/{id}` |
| 行业包 | `GET/POST /api/industry-packages` |
| 能力模型 | `GET/POST /api/capability-models` |
| 场景 | `GET/POST /api/scenes`、`GET /api/scenes/{id}`、`PUT /api/scenes/{id}/scoring-rules`、`POST /api/scenes/{id}/publish`、`POST /api/scenes/{id}/copy`、`POST /api/scenes/batch` |
| AI 能力 | `POST /api/ai/scenes/generate`、`POST /api/ai/chat`、`POST /api/ai/stt/transcribe`、`POST /api/ai/tts/synthesize`、`POST /api/ai/script-check` |
| 任务 | `GET/POST /api/tasks`、`GET /api/tasks/{id}`、`POST /api/tasks/{id}/publish`、`POST /api/tasks/{id}/stop` |
| 训练记录 | `GET/POST /api/training-records`、`GET /api/training-records/{id}`、`GET /api/training-records/by-session/{sessionId}` |
| 考试 | `GET/POST /api/exams`、`/api/exam-attempts`、`/api/exam-questions`、`/api/exam-banks` |
| 知识库 | `GET/POST /api/knowledge`、`/api/knowledge/{id}`、`GET/POST /api/knowledge/files`、`/api/knowledge/files/{id}` |
| 资料 | `GET/POST /api/materials` |
| 申诉 | `GET/POST /api/appeals`、`PUT /api/appeals/{id}` |
| 帖子 | `GET/POST /api/posts`、`/api/posts/{id}` |
| 大屏看板 | `GET /api/dashboard/overview`、`/api/dashboard/learner`、`/api/dashboard/department`、`/api/dashboard/company` |
| 模型配置 | `GET/POST /api/configs/ai-providers` |
| 健康检查 | `GET /api/health` |

## 重要约束

1. `apps/admin` 和 `apps/mobile` 只能调用 HTTP API，不允许直接访问数据库、文件系统或模型 Key。
2. `apps/api` 是唯一数据访问层，负责租户隔离、权限校验、AI 调用和审计。
3. 未配置真实模型 API Key 时，AI 生成接口返回明确错误，不用假数据冒充真实模型生成。
4. SQLite 用于本地验证，生产环境通过 Docker 部署；数据库有 Prisma 和 sql.js 两套实现，sql.js 写库需停进程再操作。

## 开发校验

```powershell
# 类型检查（全部 workspace）
npm.cmd run typecheck

# 或单独检查
npm.cmd --workspace @zxt/shared run typecheck
npm.cmd --workspace @zxt/database run typecheck
npm.cmd --workspace @zxt/api run typecheck
npm.cmd --workspace @zxt/admin run typecheck
```

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run dev:api` | 启动 API 开发服务（端口 4000） |
| `npm run dev:admin` | 启动管理端开发服务（端口 3000） |
| `npm run start:local` | 一键启动三端 |
| `npm run stop:local` | 停止本地服务 |
| `npm run start:mobile:https` | HTTPS 启动移动端（麦克风权限） |
| `npm run build` | 构建全部（api + admin + mobile） |
| `npm run db:generate` | 生成 Prisma 客户端 |
| `npm run db:push` | 推送 Prisma schema 到数据库 |
| `npm run db:seed` | 执行种子数据 |
| `npm run db:sqlite:init` | 初始化 SQLite 库 |
| `npm run smoke:p1:exam` | P1 考试链路冒烟测试 |
| `npm run lint` | 各 workspace lint |

## 部署

部署文件位于 `deploy/` 目录，使用 Docker Compose 编排三个容器（zxt-api / zxt-admin / zxt-mobile），部署说明见 `deploy/README.deploy.md`。

> AI生成