---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: 'e7d0f9cb-f686-4682-8b6a-ab1de26044cc'
  PropagateID: 'e7d0f9cb-f686-4682-8b6a-ab1de26044cc'
  ReservedCode1: 'c55ec587-5bf6-4431-aeca-2a80db134176'
  ReservedCode2: 'c55ec587-5bf6-4431-aeca-2a80db134176'
---

# 对练中心（/practice）与学员首页改造 · 设计规格

- 日期：2026-08-08
- 作者：小唐（星辰超级智能体）
- 关联工程：zxt-next（apps/admin、apps/api、packages/database、packages/ai-provider）

## 一、目标与范围

在现有单页 admin 之外，新增一个**真实独立路由 `/practice`**（Next.js App Router 页面），承载完整的"对练中心"：场景选择 → 对话 → 评分 → 历史记录。同时改造主站学员首页（student-home），将写死数据替换为真实 API 数据，并把"去对练"入口切到新路由。

**明确不在本次范围**：原 `chat-training-overlay` 浮层在 `/practice` 上线后移除；首页布局与区块结构不变，只换数据；语音服务采用 edge-tts + 本地 Whisper 的免费方案。

---

## 二、主站学员首页（student-home）改造

| 区块 | 现状 | 改造 |
|---|---|---|
| 布局/结构 | 横幅+3统计卡+待办列表/日历并排+右3卡 | **不变** |
| "去对练"按钮 | 触发浮层 startChatTraining | **改跳 `/practice`**（不传参，由对练中心选场景） |
| 待完成学习任务 | 写死3条 | 接真实 `/tasks`（当前用户待办） |
| 顶部3统计卡+进度环 | 写死 | 接真实数据（任务数/学习时长/积分/进度） |
### 2.3 学习日历 + 推荐课程
- 学习日历：按当前真实月份渲染日期格；**学习日标记规则 = 任务截止日（tasks.end_at 当月日期）+ 训练记录日期（training_records.finished_at 当月日期）** 标绿
- 推荐课程：接真实资料库 `materials`（取前若干条作为推荐）
| 右侧3卡 | 已是真实数据 | 保持不动 |

### 2.1 首页概览数据（后端）
`getDashboardOverview` 需新增**当前用户视角**字段（非管理员全租户聚合）：
- `pendingTaskCount`：当前用户待办任务数
- `studyDurationHours`：学习时长（小时），累加 `training_records` 中各记录时长（duration_ms/3600000）
- `points`：学习积分 =（已完成任务数 + 已完成对练次数）× 固定分（**基数 = 10分/次**，常量可配）
- `monthProgress`：本月进度百分比（按完成情况算，0-100）

> 说明：首页右上角用户角色标识（企业管理员/培训负责人）保持静态文案不动。

### 2.2 待办任务列表
调 `/tasks`（按当前用户过滤），取前 3 条展示"继续学习/开始学习/查看记录"按钮，跳转逻辑复用现有 `viewTaskDetail` / `setActiveSection`。

---

## 三、对练中心路由 `/practice`

- 文件：`apps/admin/app/practice/page.tsx`（独立页面，不再依赖 `activeSection` 浮层）
- 认证：复用现有 token，未登录重定向回 `/`
- **无左侧导航**，仅顶部：品牌标识（左） + "返回主页"按钮（右）
- URL 参数：`?sceneId=xxx` 进入即自动选该场景并进入对话；`?tab=history` 默认显示历史 Tab

### 3.1 视图A：场景选择（默认）
- 数据：真实 `/scenes`（按 `status='published'` 过滤）
- 卡片内容：场景名、类型标签、模式标签（语音/文本）、状态；已发布才显示"开始对练"
- **个人练习进度**：每卡片显示"已对练 N 次 / 最高 X 分"（按当前用户，来源 = `training_records` 中该用户该场景的「记录数 / 最高 score」）
- 搜索框：按场景名实时过滤（前端）
- 点击"开始对练" → 进入对话视图（默认文本模式，对话内可切语音，见 3.2）
- **场景详情页（admin 场景编辑页）的"进入对练"按钮**：一并改为跳 `/practice?sceneId=xxx`，移除对旧浮层 `startChatTraining` 的调用

### 3.2 视图B：对话
- 逐层进入，替换场景选择视图
- **默认文本模式**；底部输入区左侧麦克风按钮（按住说话）+ 文本输入框 + 发送；可切语音
- **AI 先开口**（进入对话即触发首轮，无学员内容）
- **语音对练**：
  - 按住麦克风 → 录音 → 松开发送 → `/ai/stt/transcribe` 转写 → 走文本对练流程
  - AI 回复文字后 `/ai/tts/synthesize` 合成语音 → **自动播报**，同时文字气泡显示
- **教练提示条**：仅异常时（跑题/敷衍/违规）由 AI 返回 `coachTip` 字段，前端以黄色小条显示在输入框上方
- **结束判定（满足任一即结束，全部交给 AI 在 system prompt 中判断）**：
  1. AI 判定用户完成目标 → 自动结束
  2. 用户连续 3 次回答偏离话题 → AI 终止
  3. 达到最大轮次 20 轮 → 结束
  4. 用户回复含"结束"等意图（由 AI 识别），或主动点"结束训练"
- 中途退出：点"返回场景列表" → 确认弹框 → 确认后**丢弃当前对话，不保存不评分**

### 3.3 视图C：历史记录（独立 Tab）
- 列表字段：场景名、分数、合格/不合格、时间、模式、轮数；**时间倒序**
- 权限：**学员只看自己**；**管理员看全部**
- 筛选：场景下拉；管理员额外有**学员**下拉
- **合格判定**：按**场景配置合格线**（非全站统一80）
- "查看详情"展开：各维度评分 + 改进建议 + **完整对话回放**（每轮 AI/学员内容）

### 3.4 视图D：评分卡（对话结束自动弹）
- **任何结束方式都弹**
- 内容：综合分 + 各维度（得分/满分 + **维度合格线对比**）+ 改进建议
- 按钮：【返回场景列表】+【再来一次】（同场景重开对话）

---

## 四、后端新增/改动

### 4.1 场景合格线字段（新增）
- `SceneRow` 加 `passScore: number`（场景级合格线）
- `scenes` 表加 `pass_score` 列（`ensureColumn` 兼容）
- seed 补默认合格线（如 80）
- 对练评分合格判定改按**场景 passScore**，不再写死 80

### 4.2 首页概览字段（新增）
- `getDashboardOverview(tenantId, tenantName, userId?)` 增加用户视角聚合（见 2.1）
- `/dashboard/overview` 路由透传当前 userId

### 4.3 场景个人练习进度（新增）
- 新增查询或扩展 `/scenes`：返回每场景 `attemptCount`、`bestScore`（按当前用户，来源 = `training_records` 中该用户该场景的「记录数 / 最高 score」）

### 4.4 语音链路（真实接入）
- **TTS**：`/ai/tts/synthesize` 改用 **edge-tts**（免费、无需 Key），Node 侧通过子进程/库调用；返回音频（base64 或文件 URL）
- **STT**：`/ai/stt/transcribe` 改用 **本地 Whisper**（whisper.cpp HTTP 服务或轻量 Python 服务，本机可起、接受此依赖）；后端把音频转发给本地 Whisper 服务返回文本
- `getDefaultAiProvider(tenantId, "stt"|"tts")` 配置：edge-tts 不需 Key；本地 Whisper 用 baseUrl 指向本地服务地址（环境变量 `WHISPER_BASE_URL`）

### 4.5 对练 chat 接口增强（`/ai/chat`）
- 请求 body 支持 `mode`（voice/text）、`sceneId` 已有
- 响应增加可选 `coachTip`（异常提示）、`isOffTopic`（连续跑题计数由后端维护或前端传回）
- system prompt 强化：
  - AI 角色立场（提诉求方，绝不替对方解答）——已在前序任务完成
  - **结束判定逻辑**：4 种结束条件写入 system prompt
  - **教练提示**：异常时额外返回 `coachTip`
- 评分合格判定改按场景 passScore

### 4.6 历史记录接口（`/training-records`）—— 按规格全做
- 支持按用户维度：学员只看自己（`userId=当前`），管理员看全部（按 `roleCode` 判定管理员）
- 支持按场景、学员筛选（管理员额外可按学员筛选）
- 返回完整 `turns`（含每轮 speaker/text）供对话回放
- 返回 `passed`（按场景合格线 `passScore` 判定，回退默认 80）
- 列表按 `finished_at` 时间倒序

---

## 五、数据流与关键交互

```
首页"去对练"
  → /practice
  → 场景选择（/scenes 真实数据 + 个人进度）
  → 点"开始对练"(sceneId)
  → 对话视图（AI 先开口）
  → 学员文本/语音回复
  → AI 回复（异常时带 coachTip）
  → 任一结束条件满足 → 自动评分配对练记录
  → 弹评分卡
  → [返回场景列表] / [再来一次]

历史记录 Tab
  → /training-records（按权限过滤）
  → 查看详情（评分+建议+对话回放）
```

---

## 六、错误处理
- 语音服务未配置/不可用：TTS 失败则降级为纯文字；STT 失败则提示"语音识别失败，请改用文字"
- 对练接口异常：现有 `fail`/错误提示通道复用，前端 toast/错误条展示
- 场景无合格线配置：默认回退 80

---

## 七、测试要点
1. 首页各区块均显示真实数据（与 API 一致），"去对练"跳 `/practice`
2. `/practice` 无左侧导航，仅返回主页
3. 场景选择显示真实已发布场景 + 个人进度 + 搜索
4. 对话：AI 先开口；文本/语音切换；语音自动播报；跑题/20轮/自然结束/说结束均触发评分卡
5. 评分卡任何结束都弹，显示维度合格线对比
6. 历史记录：学员只看自己、管理员看全部+学员筛选；详情含对话回放；合格按场景线
7. 边缘：音频时长累加、积分基数正确、场景合格线回退默认

---

## 八、待定常量（实现时落地，后续可配）
- 学习积分基数：`POINTS_PER_COMPLETION = 10`
- 对话最大轮次：`MAX_TURNS = 20`
- 连续跑题阈值：`OFF_TOPIC_LIMIT = 3`
- 默认场景合格线回退值：`DEFAULT_SCENE_PASS_SCORE = 80`
- 本地 Whisper 服务地址：`WHISPER_BASE_URL`（环境变量）

> AI生成