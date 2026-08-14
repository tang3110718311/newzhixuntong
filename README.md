---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: 'f8004a95-292a-4fb4-b8a8-6ec20adf9198'
  PropagateID: 'f8004a95-292a-4fb4-b8a8-6ec20adf9198'
  ReservedCode1: '8a5da6da-695d-412d-a40d-cdf40b264805'
  ReservedCode2: '8a5da6da-695d-412d-a40d-cdf40b264805'
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
## 当前已实现的管理端闭环

- 行业包：`GET/POST /api/industry-packages`，支持新增客服、面试官、内训师、自定义行业包。
- 人员管理：`GET/POST /api/users`，支持新增参训学员/内训师/管理员，任务可选择学员发布。
- 场景工厂：`GET/POST /api/scenes`，支持手工创建场景；`POST /api/scenes/{id}/publish` 支持发布场景。
- AI 创建场景：`POST /api/ai/scenes/generate` 已接 OpenAI 兼容 Chat Completions；未配置 Key 时返回明确配置错误，不返回假数据。
- 任务中心：`GET/POST /api/tasks`，支持选择场景和参训人员创建任务；`POST /api/tasks/{id}/publish` 支持发布任务。
- 数据复盘：`GET /api/training-records`，读取真实训练记录、学员、任务、场景和分数。
- 模型配置：`GET/POST /api/configs/ai-providers`，支持 LLM/STT/TTS 三类能力配置，API Key 仅保存在后端。
- 语音接口预留：`POST /api/ai/stt/transcribe`、`POST /api/ai/tts/synthesize` 已有真实 API 边界和配置校验，后续接供应商适配器即可。

## 开发校验

```powershell
npm.cmd --workspace @zxt/shared run typecheck
npm.cmd --workspace @zxt/database run typecheck
npm.cmd --workspace @zxt/api run typecheck
npm.cmd --workspace @zxt/admin run typecheck
```

`npm.cmd run start:local` 已改为等待 `http://localhost:4000/api/health` 和 `http://localhost:3000` 真正可访问后才写入 `.logs/pids.json`，避免半启动误判。

## 本轮新增能力

- 资料话术库：`GET/POST /api/materials`，支持按行业包/场景沉淀文本资料、FAQ、制度、案例和标签。
- 管理端新增“资料话术”菜单，可录入客服投诉、套餐资费、网络故障等训练资料，后续可接文件上传和向量化。
- 训练记录详情：`GET /api/training-records/{id}`，返回记录基础信息、对话轮次、评分明细和扣分证据。
- 管理端“数据复盘”支持点击记录查看详情，展示 AI 客户/学员对话文本、单项评分和证据文本。
- 任务创建表单已恢复“选择学员”，任务保存会同时写入 `task_participants`。

## 本轮新增能力：训练结果录入与复盘生成

- 训练记录创建接口：`POST /api/training-records`，支持写入任务、场景、学员、训练模式、综合分、对话轮次和评分证据。
- 后端创建训练记录时同步写入 `training_records`、`training_turns`、`score_details`，并在个人任务参与记录上标记完成。
- 管理端“数据复盘”新增“录入训练结果”表单，可后台录入 AI 客户话术、学员回应、得分、评价说明和证据文本。
- 新记录保存后自动刷新复盘数据并打开详情，形成“任务发布 → 训练结果 → 复盘详情 → 申诉处理”的真实闭环。
## 本轮新增能力：任务详情与发布对象追踪

- 任务详情接口：`GET /api/tasks/{id}`，返回任务基础信息、关联场景、发布到的个人学员和组织范围。
- 管理端任务列表新增“详情”操作，可查看任务下的场景、及格线、发布对象和参与状态。
- 发布任务后会刷新当前任务详情，便于检查任务状态变化。
- 人员新增表单补齐“所属组织”选择，确保组织架构、人员归属和任务发放范围形成闭环。
## 本轮新增能力：组织管理与按组织发放任务

- 组织管理接口：`GET/POST /api/organizations`，支持创建部门、公司、班组和外部组织，并统计组织下人员数。
- 管理端新增“组织管理”菜单，可维护租户内组织架构，后续可对接企微/钉钉通讯录同步。
- 人员管理支持选择所属组织，新增人员时会写入 `users.org_id`，列表展示组织名称。
- 任务创建支持同时选择个人学员和组织范围，后端写入 `task_participants.user_id` 或 `task_participants.org_id`，为按部门发放训练任务打基础。
## 本轮新增能力：能力模型与 SaaS 租户配置

- 能力模型接口：`GET/POST /api/capability-models`，支持按行业包创建岗位能力模型和能力项，权重合计强校验为 100。
- 管理端新增“能力模型”菜单，可维护客服、面试官、内训师等垂直行业的评分维度、权重、风险标签和及格线。
- 租户配置接口：`GET/PUT /api/tenant/current`，支持保存租户名称、套餐版本、到期时间和资源额度。
- 管理端“系统配置”新增“租户与套餐”表单，SQLite 本地持久化场景额度、LLM Token、STT 秒数和 TTS 字符额度，为后续 SaaS 部署和 MySQL 迁移预留。
## 本轮新增能力：评分申诉处理闭环

- 申诉接口：`GET/POST /api/appeals`，支持查看复核申诉、基于训练记录提交申诉并写入 SQLite。
- 申诉处理接口：`PUT /api/appeals/{id}`，支持管理员将申诉标记为“已通过”或“已驳回”，记录处理人和处理时间。
- 管理端新增“申诉处理”菜单，支持查看训练记录、学员、场景、分数、申诉原因和当前处理状态。
- 管理端支持后台代录学员复核诉求，补齐“训练复盘 → 评分异议 → 管理员复核处理”的真实闭环。
## 本轮新增能力：场景详情与评分规则

- 场景详情接口：`GET /api/scenes/{id}`，返回场景基础信息、行业包、角色设定、对话规则、评分规则和绑定资料。
- 评分规则编辑接口：`PUT /api/scenes/{id}/scoring-rules`，支持整组保存评分项，后端校验总分必须等于 100。
- 评分规则保存采用软删除旧规则再插入新规则，避免破坏历史训练记录的评分追溯。
- 管理端“场景工厂”支持点击“详情”，在右侧审核角色、规则、资料，并直接编辑评分标准、分值、扣分规则和证据要求。






## 本轮新增能力：管理端登录与会话

- 后端新增 `POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout`，登录成功后发放 7 天有效期 Bearer Token。
- 业务 API 默认要求 `Authorization: Bearer <token>`，不再依赖管理端硬编码 `X-Tenant-Code`；仅本机开发调试可通过 `ALLOW_DEV_TENANT_HEADER=true` 临时恢复租户头访问，服务端只接受 localhost/127.0.0.1 或 `DEV_TENANT_HEADER_HOSTS` 白名单主机。
- SQLite 初始化和 Prisma 种子脚本会给本地管理员写入密码哈希，支持真实账号登录。
- 管理端新增登录页、会话本地保存、退出登录和当前用户展示。
- 本地默认账号：租户 `zxt-demo`，手机号 `13800000000`，密码 `Zxt@2026`；可用 `ZXT_SEED_ADMIN_PASSWORD` 覆盖初始化密码；登录前需完成一次图形滑块验证码，后端会发放一次性 `captchaToken`。
