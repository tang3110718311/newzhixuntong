---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '063229e0-763b-4223-b21b-9684e287ba5d'
  PropagateID: '063229e0-763b-4223-b21b-9684e287ba5d'
  ReservedCode1: 'd7819f49-0852-4d36-a05a-daf97fbb280f'
  ReservedCode2: 'd7819f49-0852-4d36-a05a-daf97fbb280f'
---

# 对练中心（/practice）与学员首页改造 · 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 新增独立路由 `/practice` 承载完整对练中心（场景选择+对话+历史+评分），改造学员首页换真实数据并改跳入口

**架构：** Next.js App Router 独立页面 `app/practice/page.tsx`，复用现有 API 认证体系；后端扩展场景/记录/概览接口；语音链路 edge-tts + 本地 Whisper

**技术栈：** Next.js 15 / TypeScript / SQLite (better-sqlite3) / edge-tts / whisper.cpp / fetch API

---

## 文件结构

### 新建文件
| 文件 | 职责 |
|---|---|
| `apps/admin/app/practice/page.tsx` | 对练中心独立页面（4 视图：场景选择/对话/历史/评分） |
| `apps/admin/app/practice/practice.css` | 对练中心专用样式 |

### 修改文件
| 文件 | 职责 | 改动范围 |
|---|---|---|
| `packages/database/src/repository.ts` | 数据层 | SceneRow 加 passScore；getDashboardOverview 加用户视角；listTrainingRecords 加筛选；新增 getSceneUserProgress |
| `packages/database/sqlite/init.mjs` | Schema+Seed | scenes 表加 pass_score 列；seed 补合格线 |
| `apps/api/app/api/dashboard/overview/route.ts` | 概览路由 | 透传 userId，返回用户视角数据 |
| `apps/api/app/api/training-records/route.ts` | 训练记录路由 | 支持按用户/场景/学员筛选，返回 turns+passed |
| `apps/api/app/api/training-records/[id]/route.ts` | 记录详情 | 返回完整 turns 供回放 |
| `apps/api/app/api/ai/chat/route.ts` | 对话路由 | system prompt 强化4种结束判定+教练提示；响应加 coachTip |
| `apps/api/app/api/ai/stt/transcribe/route.ts` | STT 路由 | 接入本地 Whisper 服务 |
| `apps/api/app/api/ai/tts/synthesize/route.ts` | TTS 路由 | 接入 edge-tts |
| `apps/admin/src/components/admin-dashboard.tsx` | 主站前端 | 学员首页换真实数据；"去对练"改跳 /practice；场景详情"进入对练"改跳；移除 chat-training-overlay 浮层及相关 state/函数 |

---

## 任务 1：数据库层 — 场景合格线 + 用户进度查询 + 概览扩展

**文件：**
- 修改：`packages/database/src/repository.ts`
- 修改：`packages/database/sqlite/init.mjs`

- [ ] **步骤 1：SceneRow 加 passScore 字段**

在 `repository.ts` 的 `SceneRow` 类型（约第 97 行）添加：

```typescript
export type SceneRow = {
  id: string;
  name: string;
  code: string;
  industryPackageId?: string | null;
  sceneType: string;
  mode: string;
  status: string;
  isTemplate: number;
  sourceType: string;
  description?: string;
  passScore: number; // 新增：场景合格线
};
```

在所有查 SceneRow 的 SQL select 列表里补上 `s.pass_score as passScore`（含 getSceneDetail、getScenes 列表、updateSceneStatus 等）。

- [ ] **步骤 2：init.mjs schema 补列 + seed 补值**

在 `init.mjs` 的 `ensureColumn` 调用区加：

```javascript
ensureColumn("scenes", "pass_score", "integer not null default 80");
```

seed 数据（for scenes 循环，约第 489 行）的 insert 语句补上 pass_score 字段，3 个场景均设为 80。

- [ ] **步骤 3：新增 getSceneUserProgress 函数**

在 `repository.ts` 末尾新增：

```typescript
export function getSceneUserProgress(tenantId: string, userId: string): Map<string, { attemptCount: number; bestScore: number }> {
  const rows = all<{ sceneId: string; attemptCount: number; bestScore: number }>(
    `select scene_id as sceneId, count(*) as attemptCount, max(score) as bestScore
     from training_records
     where tenant_id = ? and user_id = ? and deleted_at is null and status = 'completed'
     group by scene_id`,
    [tenantId, userId],
  );
  const map = new Map<string, { attemptCount: number; bestScore: number }>();
  rows.forEach((r) => map.set(r.sceneId, { attemptCount: r.attemptCount, bestScore: r.bestScore }));
  return map;
}
```

- [ ] **步骤 4：扩展 getDashboardOverview 增加用户视角字段**

修改 `getDashboardOverview` 签名为 `getDashboardOverview(tenantId: string, tenantName: string, userId?: string)`，在返回对象中追加：

```typescript
const pendingTaskCount = userId ? get<{ count: number }>(
  `select count(*) as count from task_participants tp
   join tasks t on t.id = tp.task_id and t.tenant_id = tp.tenant_id
   where tp.tenant_id = ? and tp.user_id = ? and tp.status != 'completed' and t.deleted_at is null`,
  [tenantId, userId],
)?.count ?? 0 : 0;

const completedCount = userId ? get<{ taskCount: number; recordCount: number }>(
  `select
    (select count(*) from task_participants tp join tasks t on t.id = tp.task_id
     where tp.tenant_id = ? and tp.user_id = ? and tp.status = 'completed' and t.deleted_at is null) as taskCount,
    (select count(*) from training_records
     where tenant_id = ? and user_id = ? and status = 'completed' and deleted_at is null) as recordCount`,
  [tenantId, userId, tenantId, userId],
) : null;

// 积分 = (已完成任务数 + 已完成对练次数) × 10
const points = completedCount ? (completedCount.taskCount + completedCount.recordCount) * 10 : 0;

// 学习时长：累加 training_records 的时长（暂用每条8分钟估算，后续可加真实 duration_ms 字段）
const studyDurationHours = userId ? (get<{ value: number }>(
  `select count(*) as value from training_records where tenant_id = ? and user_id = ? and status = 'completed' and deleted_at is null`,
  [tenantId, userId],
)?.value ?? 0) * 8 / 60 : 0;

// 本月进度
const monthProgress = completedCount ? Math.min(100, Math.round((completedCount.taskCount + completedCount.recordCount) / 25 * 100)) : 0;
```

在 return 对象里追加：`pendingTaskCount`, `studyDurationHours`, `points`, `monthProgress`。

- [ ] **步骤 5：扩展 listTrainingRecords 支持筛选 + 返回 turns + passed**

修改 `listTrainingRecords` 签名为：

```typescript
export function listTrainingRecords(
  tenantId: string,
  pagination: { page: number; pageSize: number },
  options?: { userId?: string; sceneId?: string; filterUserId?: string },
): PageResult<TrainingRecordRow & { passed: boolean; scenePassScore: number }> {
```

在 SQL 里：
- 如果 `options.userId` 存在，加 `AND user_id = ?`（学员只看自己）
- 如果 `options.sceneId` 存在，加 `AND scene_id = ?`
- 如果 `options.filterUserId` 存在，加 `AND user_id = ?`（管理员按学员筛选）
- JOIN scenes 取 `pass_score as scenePassScore`
- 每条记录计算 `passed = score >= scenePassScore`
- 按 `finished_at desc` 排序

- [ ] **步骤 6：typecheck 验证**

运行：`cd packages/database && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 7：Commit**

```bash
git add packages/database/src/repository.ts packages/database/sqlite/init.mjs
git commit -m "feat(db): 场景合格线+用户进度+概览扩展+记录筛选"
```

---

## 任务 2：API 路由层 — 概览+记录+场景接口

**文件：**
- 修改：`apps/api/app/api/dashboard/overview/route.ts`
- 修改：`apps/api/app/api/training-records/route.ts`
- 修改：`apps/api/app/api/training-records/[id]/route.ts`

- [ ] **步骤 1：概览路由透传 userId**

修改 `apps/api/app/api/dashboard/overview/route.ts`，在 `getTenantContext` 后从 auth 中取 userId：

```typescript
import { getAuthUser } from "@/lib/auth"; // 复用现有认证取用户

export async function GET(request: Request) {
  const { tenantId, tenantName } = await getTenantContext(request);
  const user = getAuthUser(request); // 取当前用户
  const userId = user?.id ?? undefined;
  return ok(getDashboardOverview(tenantId, tenantName, userId));
}
```

（具体取用户方式需查现有 auth 中间件，复用 `getAuthUser` 或从 request header 取）

- [ ] **步骤 2：训练记录路由支持筛选 + 返回 passed**

修改 `apps/api/app/api/training-records/route.ts` GET：

```typescript
export async function GET(request: Request) {
  const { tenantId } = await getTenantContext(request);
  const url = new URL(request.url);
  const sceneId = url.searchParams.get("sceneId") || undefined;
  const filterUserId = url.searchParams.get("filterUserId") || undefined;
  const user = getAuthUser(request);
  const isAdmin = user?.roleCode === "tenant_admin";
  // 学员只看自己
  const userId = isAdmin ? undefined : user?.id;
  return ok(listTrainingRecords(tenantId, parsePagination(request), { userId, sceneId, filterUserId }));
}
```

- [ ] **步骤 3：记录详情返回完整 turns**

修改 `apps/api/app/api/training-records/[id]/route.ts`，确保返回的记录包含 `turns` 字段（从 `training_turns` 表查询，按 `created_at asc` 排列）。

在 `repository.ts` 新增 `getTrainingRecordDetail` 函数：

```typescript
export function getTrainingRecordDetail(tenantId: string, recordId: string) {
  const record = get<TrainingRecordRow & { scenePassScore: number }>(
    `select tr.*, s.pass_score as scenePassScore
     from training_records tr left join scenes s on s.id = tr.scene_id and s.tenant_id = tr.tenant_id
     where tr.tenant_id = ? and tr.id = ? and tr.deleted_at is null`,
    [tenantId, recordId],
  );
  if (!record) return undefined;
  const turns = all<{ speaker: string; text: string; durationMs: number }>(
    `select speaker, text, duration_ms as durationMs from training_turns where tenant_id = ? and record_id = ? order by created_at asc`,
    [tenantId, recordId],
  );
  const scores = all<{ scoringRuleId: string | null; score: number; deductionReason: string; evidenceText: string }>(
    `select scoring_rule_id as scoringRuleId, score, deduction_reason as deductionReason, evidence_text as evidenceText
     from score_details where tenant_id = ? and record_id = ?`,
    [tenantId, recordId],
  );
  return { ...record, turns, scores, passed: record.score >= record.scenePassScore };
}
```

- [ ] **步骤 4：typecheck 验证**

运行：`cd apps/api && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add apps/api/app/api/dashboard/overview/route.ts apps/api/app/api/training-records/route.ts apps/api/app/api/training-records/[id]/route.ts
git commit -m "feat(api): 概览用户视角+记录筛选+详情含turns"
```

---

## 任务 3：AI 对话接口强化 — 结束判定 + 教练提示

**文件：**
- 修改：`apps/api/app/api/ai/chat/route.ts`

- [ ] **步骤 1：system prompt 加入 4 种结束判定 + 教练提示指令**

在 `buildSystemPrompt` 函数的行为规则部分追加：

```typescript
  parts.push(`\n## 结束判定规则`);
  parts.push(`你需要在以下任一条件满足时，在回复末尾附上【训练结束】标记：`);
  parts.push(`1. 学员已圆满完成训练目标（如成功安抚客户、给出明确处理安排）。`);
  parts.push(`2. 学员连续3次回答偏离话题（off-topic），你判断无法继续有效训练。`);
  parts.push(`3. 对话已进行20轮（学员10次回复），仍未达成目标。`);
  parts.push(`4. 学员明确表示要结束对话（如"结束""完毕""不想练了"）。`);
  parts.push(``);
  parts.push(`## 教练提示规则`);
  parts.push(`当学员出现以下情况时，你需要在回复的 JSON 外额外返回一条教练提示（coachTip）：`);
  parts.push(`- 回答偏离话题（跑题）`);
  parts.push(`- 回答过于敷衍（如"不知道""随便"）`);
  parts.push(`- 回答包含严重违规内容`);
  parts.push(`教练提示用简短中文（10字内），如"注意倾听客户诉求""请不要敷衍回答"。`);
  parts.push(`正常对话不需要返回教练提示。`);
```

- [ ] **步骤 2：AI 回复解析 coachTip**

在 POST handler 里，AI 回复后尝试解析 `coachTip`：

```typescript
let aiReply = aiContent;
let coachTip: string | null = null;

// AI 可能在回复中嵌入 [COACH_TIP:xxx] 标记
const coachMatch = aiReply.match(/\[COACH_TIP:(.+?)\]/);
if (coachMatch) {
  coachTip = coachMatch[1].trim();
  aiReply = aiReply.replace(coachMatch[0], "").trim();
}
```

在响应中追加 `coachTip` 字段：`return ok({ aiReply, isFinished, trainingRecord, coachTip }, traceId);`

- [ ] **步骤 3：轮次计数（20 轮上限判断）**

在 POST handler 里，计算 learner 消息条数：

```typescript
const learnerMessageCount = body.messages.filter((m) => m.role === "learner").length;
// 如果 learner 已发 10 条（=20 轮对话），在 system 外层追加提示
if (learnerMessageCount >= 10) {
  apiMessages.push({ role: "system", content: "提醒：对话已达最大轮次，请在本次回复后附上【训练结束】标记并给出简要评价。" });
}
```

- [ ] **步骤 4：typecheck 验证**

运行：`cd apps/api && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add apps/api/app/api/ai/chat/route.ts
git commit -m "feat(chat): 4种结束判定+教练提示+20轮上限"
```

---

## 任务 4：语音链路 — edge-tts + 本地 Whisper

**文件：**
- 修改：`apps/api/app/api/ai/tts/synthesize/route.ts`
- 修改：`apps/api/app/api/ai/stt/transcribe/route.ts`

- [ ] **步骤 1：安装 edge-tts 依赖**

```bash
cd apps/api && npm install edge-tts-node 2>/dev/null || echo "尝试 npx 方式"
```

如果无 npm 包，改用本地命令行 edge-tts（通过 `npx edge-tts` 或全局安装）。在 route.ts 里用 `child_process.execFile` 调用。

- [ ] **步骤 2：TTS 路由改用 edge-tts**

替换 `apps/api/app/api/ai/tts/synthesize/route.ts` 的 stub 实现：

```typescript
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { z } from "zod";
import { ok, fail, handleRouteError, createTraceId } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";
import { logAiCall } from "@zxt/database/client";

const execFileAsync = promisify(execFile);

const ttsRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  voice: z.string().default("zh-CN-XiaoxiaoNeural"),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const traceId = createTraceId();
  const started = Date.now();
  try {
    const { tenantId } = await getTenantContext(request);
    const { text, voice } = ttsRequestSchema.parse(await request.json());

    const tmpMp3 = join(tmpdir(), `tts-${Date.now()}.mp3`);
    try {
      await execFileAsync("edge-tts", ["--voice", voice, "--text", text, "--write-media", tmpMp3], { timeout: 15000 });
      const audioBuffer = readFileSync(tmpMp3);
      const audioBase64 = audioBuffer.toString("base64");
      logAiCall({ tenantId, providerType: "tts", modelName: "edge-tts", bizType: "tts_synthesize", durationMs: Date.now() - started, success: true, traceId });
      return ok({ audioBase64, format: "mp3" }, traceId);
    } finally {
      try { unlinkSync(tmpMp3); } catch {}
    }
  } catch (error) {
    return handleRouteError(error, traceId);
  }
}
```

> 注意：如果 edge-tts 命令不可用，需先 `pip install edge-tts` 或 `npm install -g edge-tts`。

- [ ] **步骤 3：STT 路由改用本地 Whisper**

替换 `apps/api/app/api/ai/stt/transcribe/route.ts`：

```typescript
import { z } from "zod";
import { ok, fail, handleRouteError, createTraceId } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";
import { logAiCall } from "@zxt/database/client";

const sttRequestSchema = z.object({
  audioBase64: z.string().min(1),
  format: z.string().default("webm"),
});

const WHISPER_BASE_URL = process.env.WHISPER_BASE_URL || "http://localhost:8178";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const traceId = createTraceId();
  const started = Date.now();
  try {
    const { tenantId } = await getTenantContext(request);
    const { audioBase64, format } = sttRequestSchema.parse(await request.json());

    // 转发到本地 Whisper 服务
    const whisperResponse = await fetch(`${WHISPER_BASE_URL}/asr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: audioBase64, format }),
    });

    if (!whisperResponse.ok) {
      throw new Error(`Whisper 服务返回错误：HTTP ${whisperResponse.status}`);
    }

    const whisperResult = await whisperResponse.json() as { text?: string };
    const text = whisperResult.text || "";

    logAiCall({ tenantId, providerType: "stt", modelName: "whisper-local", bizType: "audio_transcribe", durationMs: Date.now() - started, success: true, traceId });
    return ok({ text, durationMs: Date.now() - started }, traceId);
  } catch (error) {
    return handleRouteError(error, traceId);
  }
}
```

- [ ] **步骤 4：.env 补 Whisper 地址**

在 `apps/api/.env` 追加：

```
WHISPER_BASE_URL=http://localhost:8178
```

- [ ] **步骤 5：typecheck 验证**

运行：`cd apps/api && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add apps/api/app/api/ai/tts/synthesize/route.ts apps/api/app/api/ai/stt/transcribe/route.ts apps/api/.env
git commit -m "feat(voice): edge-tts + 本地Whisper真实接入"
```

---

## 任务 5：主站学员首页改造 — 换真实数据 + 入口改跳

**文件：**
- 修改：`apps/admin/src/components/admin-dashboard.tsx`

- [ ] **步骤 1："去对练"按钮改跳 /practice**

在学员首页 `activeSection === "student-home"` 区块（约第 2681 行），将 `startChatTraining(published[0].id, published[0].name)` 改为：

```typescript
onClick={() => { window.location.href = "/practice"; }}
```

- [ ] **步骤 2：场景详情页"进入对练"改跳 /practice?sceneId=xxx**

在场景详情区块（约第 1734 行），将 `startChatTraining(selectedSceneDetail.scene.id, selectedSceneDetail.scene.name)` 改为：

```typescript
onClick={() => { window.location.href = `/practice?sceneId=${selectedSceneDetail.scene.id}`; }}
```

- [ ] **步骤 3：首页统计卡换真实数据**

将 3 统计卡（约第 2628-2632 行）的写死值替换为 API 返回字段：

```typescript
<div className="metric card"><span>待完成任务</span><strong style={{ color: "#e6a23c" }}>{overview.pendingTaskCount ?? 0}</strong><small>含1项即将到期</small></div>
<div className="metric card"><span>累计学习时长</span><strong><span className="text-blue">{(overview.studyDurationHours ?? 0).toFixed(1)}</span> <span style={{ fontSize: 16, color: "#8b98aa" }}>小时</span></strong><small>较上月持续增长</small></div>
<div className="metric card"><span>学习积分</span><strong>{overview.points ?? 0}</strong><small>本月持续积累</small></div>
```

进度环同理用 `overview.monthProgress`。

- [ ] **步骤 4：待完成学习任务列表接真实 /tasks**

替换写死的 3 条任务，改用 `tasks` 数组取前 3 条渲染（已从 API 加载）。类型/图标按任务类型动态映射。

- [ ] **步骤 5：学习日历改真实月份 + 标记规则**

日历改为当前真实月份，日期标记逻辑：`training_records.finished_at` 当月的日期标绿 + `tasks.end_at` 当月的日期标橙。

- [ ] **步骤 6：推荐课程接真实 materials**

推荐课程改为 `materials.slice(0, 3)` 渲染。

- [ ] **步骤 7：移除 chat-training-overlay 浮层及相关代码**

删除以下 state/函数/渲染块：
- `chatActive`, `chatSceneId`, `chatSceneName`, `chatMessages`, `chatInput`, `chatSending`, `chatFinished`, `chatResult` state 声明
- `startChatTraining()`, `exitChatTraining()`, `sendChatMessage()` 函数
- `{chatActive && (<section className="chat-training-overlay">...)}` 整个渲染块（约第 1962-2030 行）

- [ ] **步骤 8：typecheck 验证**

运行：`cd apps/admin && npx tsc --noEmit`
预期：PASS

- [ ] **步骤 9：Commit**

```bash
git add apps/admin/src/components/admin-dashboard.tsx
git commit -m "feat(home): 学员首页换真实数据+去对练改跳practice+移除浮层"
```

---

## 任务 6：对练中心独立页面 — 场景选择 + 对话 + 历史 + 评分

**文件：**
- 创建：`apps/admin/app/practice/page.tsx`
- 创建：`apps/admin/app/practice/practice.css`

这是最大的任务。拆为子步骤实现。

- [ ] **步骤 1：创建页面骨架 + 认证 + 顶部栏**

`apps/admin/app/practice/page.tsx`：

```typescript
"use client";
import { useEffect, useState } from "react";
import "./practice.css";

type View = "scenes" | "chat" | "history";

export default function PracticePage() {
  const [auth, setAuth] = useState<{ token: string; user: { id: string; name: string; roleCode: string } } | null>(null);
  const [view, setView] = useState<View>("scenes");
  const [scenes, setScenes] = useState<any[]>([]);
  const [selectedScene, setSelectedScene] = useState<any | null>(null);
  // ... 其他 state（chatMessages, chatInput, historyRecords 等）

  useEffect(() => {
    const stored = localStorage.getItem("zxt-admin-auth");
    if (!stored) { window.location.href = "/"; return; }
    const parsed = JSON.parse(stored);
    setAuth(parsed);
    loadScenes(parsed.token);
    // 如果 URL 有 sceneId 参数，自动进入对话
    const params = new URLSearchParams(window.location.search);
    const sceneId = params.get("sceneId");
    if (sceneId) {
      setSelectedScene({ id: sceneId });
      setView("chat");
    }
  }, []);

  // ... 后续步骤补全函数
}
```

顶部栏：品牌 + 返回主页按钮。

- [ ] **步骤 2：场景选择视图**

调 `/scenes?pageSize=50`，按 `status=published` 过滤。卡片网格（2-3 列），每卡显示：
- 场景名、类型标签、模式标签（语音/文字）
- 个人练习进度：调 `/training-records?userId=me` 或单独接口算 attemptCount/bestScore
- "开始对练"按钮

搜索框前端过滤。

- [ ] **步骤 3：对话视图**

核心组件：
- 消息气泡区（AI 左蓝、我 右灰）
- 底部输入栏：麦克风按钮（按住录音）+ 文本输入框 + 发送按钮 + 结束训练
- 默认文本模式，点麦克风切语音
- 进入对话自动触发 AI 首问（调 `/ai/chat`，messages=[]）
- AI 回复后如果 coachTip 非空，显示黄色提示条
- 结束判定后弹评分卡

关键实现：

```typescript
async function sendChatMessage(text: string) {
  const newMessages = [...chatMessages];
  if (text) newMessages.push({ role: "learner", content: text });
  setChatMessages(newMessages);
  setChatInput("");
  setChatSending(true);
  try {
    const result = await apiFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ sceneId: selectedScene.id, messages: newMessages }),
    });
    const aiMsg = { role: "ai", content: result.aiReply };
    setChatMessages([...newMessages, aiMsg]);
    if (result.coachTip) setCoachTip(result.coachTip);
    else setCoachTip(null);
    if (result.isFinished && result.trainingRecord) {
      setChatResult(result.trainingRecord);
      setChatFinished(true);
    }
  } finally {
    setChatSending(false);
  }
}
```

语音对练：
- 按住麦克风 → MediaRecorder 录音 → 松开 → webm blob → base64 → 调 `/ai/stt/transcribe` → 得文字 → 走 sendChatMessage
- AI 回复后自动调 `/ai/tts/synthesize` → 得 audioBase64 → new Audio 播放

- [ ] **步骤 4：评分卡组件**

对话结束（`chatFinished === true`）时覆盖对话区显示评分卡：
- 综合分 + 各维度（得分/满分 + 维度合格线对比）+ 改进建议
- 【返回场景列表】按钮：`setView("scenes"); setSelectedScene(null);`
- 【再来一次】按钮：同场景重新进入对话

- [ ] **步骤 5：历史记录视图**

调 `/training-records`（学员只看自己、管理员看全部+筛选）。
列表：场景名/分数/合格/时间/模式/轮数。
"查看详情"展开：调 `/training-records/[id]`，显示评分维度+建议+对话回放。

- [ ] **步骤 6：practice.css 样式**

对练中心专用样式：顶部栏、场景卡片网格、对话气泡、输入栏、麦克风按钮动画、评分卡、历史记录列表等。

- [ ] **步骤 7：验证**

- 浏览器访问 `/practice`，确认场景列表显示
- 点击"开始对练"，AI 先开口
- 文本对话正常，语音按钮可切换
- 对话结束弹评分卡
- 历史记录 Tab 显示
- 从首页"去对练"跳转 `/practice` 正常

- [ ] **步骤 8：Commit**

```bash
git add apps/admin/app/practice/page.tsx apps/admin/app/practice/practice.css
git commit -m "feat(practice): 对练中心独立页面(场景+对话+历史+评分)"
```

---

## 任务 7：集成验证 + 清理

**文件：**
- 无新增，可能微调上述文件

- [ ] **步骤 1：全量 typecheck**

```bash
cd packages/database && npx tsc --noEmit
cd apps/api && npx tsc --noEmit
cd apps/admin && npx tsc --noEmit
```

预期：全部 PASS

- [ ] **步骤 2：功能验证清单**

逐项验证：
1. 学员首页统计卡显示真实数据
2. 学员首页"去对练"跳 /practice
3. 场景详情"进入对练"跳 /practice?sceneId=xxx
4. /practice 场景选择页显示已发布场景 + 个人进度
5. 对话：AI 先开口、文本/语音切换、教练提示、4 种结束判定
6. 评分卡：维度合格线对比、再来一次
7. 历史记录：学员只看自己、管理员看全部+筛选
8. 原 chat-training-overlay 浮层已移除

- [ ] **步骤 3：最终 Commit**

```bash
git add -A
git commit -m "chore: 对练中心集成验证通过"
```

> AI生成