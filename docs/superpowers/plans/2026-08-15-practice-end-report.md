# 对练结束与报告类型实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让对练会话能按有效学员回答次数和目标达成结果，可靠区分放弃、阶段性报告与正式报告，并只把正式报告统计为完成训练。

**架构：** 在 `packages/database` 扩展会话和训练记录的报告元数据；在 API 层通过独立的结束决策函数统一主动结束和自动结束的分类；评分函数将决策元数据写入训练记录。移动端调用 `action=end` 并按 API 返回的报告类型进入报告页或场景页。

**技术栈：** Next.js 15、TypeScript、Zod、sql.js/SQLite、Node `assert` 纯函数断言、现有 `scoreAndSaveRecordSafe` 报告生成链路。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `apps/api/src/lib/practice-end.ts` | 纯函数：依据回答次数、结束原因与目标达成，输出会话状态和报告类型。 |
| `apps/api/src/lib/practice-end.test.ts` | 用 Node `assert` 覆盖结束分类的业务边界。 |
| `packages/database/prisma/schema.prisma` | 声明会话、训练记录新增的报告元数据字段。 |
| `packages/database/src/sqlite.ts` | 为运行中 SQLite 数据库补齐新增字段和索引。 |
| `packages/database/src/repository.ts` | 扩展会话/记录类型、创建更新和查询映射；正式完成统计仅计算 `final`。 |
| `apps/api/src/lib/ai-scoring.ts` | 接收报告元数据并将其随 `TrainingRecord` 落库。 |
| `apps/api/app/api/ai/chat/route.ts` | 用结束决策统一处理 `action=end`、目标达成、跑题和最大轮次，并触发报告。 |
| `apps/api/app/api/training-records/by-session/[sessionId]/route.ts` | 恢复评分时传递会话的报告元数据。 |
| `apps/mobile/src/lib/api.ts` | 声明 AI Chat 结束响应的最小类型。 |
| `apps/mobile/src/components/PracticeView.tsx` | 主动结束会话、处理报告类型并安全地停止音频。 |
| `apps/mobile/src/components/TaskDetailPage.tsx` | 保存报告类型并传递给报告组件。 |
| `apps/mobile/src/components/PracticeReport.tsx` | 显示“阶段性报告”或“正式报告”。 |

### 任务 1：建立并验证结束决策纯函数

**文件：**
- 创建：`apps/api/src/lib/practice-end.ts`
- 创建：`apps/api/src/lib/practice-end.test.ts`

- [ ] **步骤 1：编写失败的结束决策断言**

```ts
import assert from "node:assert/strict";
import { decidePracticeEnd } from "./practice-end";

assert.deepEqual(
  decidePracticeEnd({ roundCount: 2, endReason: "user_end", targetAchieved: false }),
  { sessionStatus: "abandoned", reportType: "none", endReason: "user_end", targetAchieved: false },
);
assert.deepEqual(
  decidePracticeEnd({ roundCount: 3, endReason: "user_end", targetAchieved: false }),
  { sessionStatus: "completed", reportType: "progress", endReason: "user_end", targetAchieved: false },
);
assert.deepEqual(
  decidePracticeEnd({ roundCount: 4, endReason: "target_achieved", targetAchieved: true }),
  { sessionStatus: "completed", reportType: "final", endReason: "target_achieved", targetAchieved: true },
);
assert.deepEqual(
  decidePracticeEnd({ roundCount: 8, endReason: "off_topic", targetAchieved: false }),
  { sessionStatus: "completed", reportType: "progress", endReason: "off_topic", targetAchieved: false },
);
console.log("practice-end tests passed");
```

- [ ] **步骤 2：运行断言，确认因模块不存在而失败**

运行：`npx tsx apps/api/src/lib/practice-end.test.ts`

预期：失败，提示无法解析 `./practice-end`。

- [ ] **步骤 3：实现最小结束决策函数**

```ts
export type PracticeEndReason = "user_end" | "target_achieved" | "off_topic" | "max_round";
export type PracticeReportType = "none" | "progress" | "final";
export type PracticeSessionStatus = "completed" | "abandoned";

export function decidePracticeEnd(input: {
  roundCount: number;
  endReason: PracticeEndReason;
  targetAchieved: boolean;
}): {
  sessionStatus: PracticeSessionStatus;
  reportType: PracticeReportType;
  endReason: PracticeEndReason;
  targetAchieved: boolean;
} {
  if (input.endReason === "user_end" && input.roundCount < 3) {
    return { ...input, sessionStatus: "abandoned", reportType: "none" };
  }
  if (input.endReason === "target_achieved" && input.targetAchieved && input.roundCount >= 4) {
    return { ...input, sessionStatus: "completed", reportType: "final" };
  }
  return { ...input, sessionStatus: "completed", reportType: "progress" };
}
```

- [ ] **步骤 4：运行断言，确认结束分类全部通过**

运行：`npx tsx apps/api/src/lib/practice-end.test.ts`

预期：输出 `practice-end tests passed`。

- [ ] **步骤 5：提交纯函数和测试**

```powershell
git add apps/api/src/lib/practice-end.ts apps/api/src/lib/practice-end.test.ts
```

随后创建一次提交，提交消息为：`feat(api): add practice end decision`。

### 任务 2：扩展数据库模型、迁移和仓储映射

**文件：**
- 修改：`packages/database/prisma/schema.prisma:312-355`
- 修改：`packages/database/src/sqlite.ts:253-326`
- 修改：`packages/database/src/repository.ts:236-326,1519-1595,1638-1810,1377-1458`

- [ ] **步骤 1：先扩展 TypeScript 类型，确认现有调用出现类型缺口**

在 `repository.ts` 的 `AiTrainingSessionRow` 中增加：

```ts
reportType: "none" | "progress" | "final";
endReason: "user_end" | "target_achieved" | "off_topic" | "max_round" | null;
targetAchieved: boolean;
```

在 `TrainingRecordRow` 与 `CreateTrainingRecordInput` 中只增加：

```ts
reportType: "progress" | "final";
endReason: "user_end" | "target_achieved" | "off_topic" | "max_round";
```

把 `updateAiTrainingSession` 的输入扩展为：

```ts
reportType?: "none" | "progress" | "final";
endReason?: "user_end" | "target_achieved" | "off_topic" | "max_round" | null;
targetAchieved?: boolean;
```

- [ ] **步骤 2：运行数据库类型检查，确认字段尚未在持久化层补齐**

运行：`npm --workspace @zxt/database run typecheck`

预期：失败，指出会话/记录 SQL 映射或创建入参缺少新增字段。

- [ ] **步骤 3：声明 Prisma 字段和 SQLite 兼容迁移**

在 Prisma 的 `TrainingRecord` 增加：

```prisma
reportType     String   @default("final") @map("report_type")
endReason      String?  @map("end_reason")
```

在 `AiTrainingSession` 增加：

```prisma
reportType     String   @default("none") @map("report_type")
endReason      String?  @map("end_reason")
targetAchieved Boolean  @default(false) @map("target_achieved")
```

在 `sqlite.ts` 的会话建表 SQL 中写入同名 snake_case 字段，默认值分别为 `none`、`NULL`、`0`。在 `ensureColumn` 区追加：

```ts
ensureColumn("ai_training_sessions", "report_type", "TEXT NOT NULL DEFAULT 'none'");
ensureColumn("ai_training_sessions", "end_reason", "TEXT");
ensureColumn("ai_training_sessions", "target_achieved", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("training_records", "report_type", "TEXT NOT NULL DEFAULT 'final'");
ensureColumn("training_records", "end_reason", "TEXT");
```

为 `training_records(tenant_id, scene_id, user_id, report_type)` 添加索引，名称为 `idx_tr_completion_type`。

- [ ] **步骤 4：补齐仓储 SQL 映射、更新字段与正式完成统计**

1. `createAiTrainingSession` 插入 `report_type='none'`、`end_reason=NULL`、`target_achieved=0`；
2. `updateAiTrainingSession` 仅在对应字段不是 `undefined` 时更新，并将布尔值写为 `1/0`；
3. `createTrainingRecord` 的 insert 列和参数带入 `report_type`、`end_reason`；
4. 会话/记录查询行映射将 SQLite `0/1` 转为 `boolean`；
5. `completedTrainCount` 及所有“完成训练次数”查询条件加 `AND report_type = 'final'`；
6. 旧数据读取时，记录缺失 `report_type` 时按 `final`，会话缺失时按 `none` 兜底。

- [ ] **步骤 5：运行数据库类型检查，确认通过**

运行：`npm --workspace @zxt/database run typecheck`

预期：退出码 0。

- [ ] **步骤 6：提交数据层变更**

```powershell
git add packages/database/prisma/schema.prisma packages/database/src/sqlite.ts packages/database/src/repository.ts
```

随后创建一次提交，提交消息为：`feat(database): persist practice report metadata`。

### 任务 3：让评分记录继承会话的报告元数据

**文件：**
- 修改：`apps/api/src/lib/ai-scoring.ts:54-297`

- [ ] **步骤 1：把报告元数据加入评分函数入参类型**

将 `TrainingTranscript` 或新增的评分上下文扩展为：

```ts
reportType: "progress" | "final";
endReason: "user_end" | "target_achieved" | "off_topic" | "max_round";
```

并让 `scoreAndSaveRecordSafe` 将这两个字段完整转发给内部评分函数。

- [ ] **步骤 2：运行 API 类型检查，确认创建记录调用缺少字段而失败**

运行：`npm --workspace @zxt/api run typecheck`

预期：失败，指出 `createTrainingRecord` 参数缺少 `reportType` 或 `endReason`。

- [ ] **步骤 3：在 TrainingRecord 创建调用中写入元数据**

将原调用中的固定状态保持为：

```ts
status: "completed",
reportType: body.reportType,
endReason: body.endReason,
```

不将阶段性报告写为 `abandoned`，以保证现有报告轮询和详情查询可复用。

- [ ] **步骤 4：运行 API 类型检查，确认通过**

运行：`npm --workspace @zxt/api run typecheck`

预期：退出码 0。

- [ ] **步骤 5：提交评分元数据传递**

```powershell
git add apps/api/src/lib/ai-scoring.ts
```

随后创建一次提交，提交消息为：`feat(api): save practice report metadata`。

### 任务 4：接入 Chat 路由的主动与自动结束决策

**文件：**
- 修改：`apps/api/app/api/ai/chat/route.ts:28-34,255-317,334-477,491-505`
- 修改：`apps/api/app/api/training-records/by-session/[sessionId]/route.ts:35-63`

- [ ] **步骤 1：在 Chat 路由导入结束决策函数并定义报告响应字段**

导入：

```ts
import { decidePracticeEnd, type PracticeEndReason } from "@/src/lib/practice-end";
```

将成功响应统一补充：

```ts
reportType: "none" | "progress" | "final";
endReason: PracticeEndReason | null;
targetAchieved: boolean;
```

对于仍在进行中的 `start` 或普通消息，返回 `reportType: "none"`、`endReason: null`、`targetAchieved: false`。

- [ ] **步骤 2：替换 `action=end` 的放弃逻辑**

在已校验的活动会话中执行：

```ts
const decision = decidePracticeEnd({
  roundCount: activeSession.roundCount,
  endReason: "user_end",
  targetAchieved: false,
});
const updatedSession = updateAiTrainingSession(tenantId, activeSession.id, {
  status: decision.sessionStatus,
  history,
  roundCount: activeSession.roundCount,
  reportType: decision.reportType,
  endReason: decision.endReason,
  targetAchieved: decision.targetAchieved,
  finishedAt: new Date().toISOString(),
});
```

当 `decision.reportType !== "none"` 且当前不存在记录时，构造 `TrainingTranscript` 并调用：

```ts
void scoreAndSaveRecordSafe(tenantId, userId, {
  sceneId: body.sceneId,
  sessionId: updatedSession.id,
  messages: history,
  startedAt: updatedSession.startedAt ?? undefined,
  reportType: decision.reportType,
  endReason: decision.endReason,
}, sceneDetail, config, traceId);
```

返回 `isFinished: decision.reportType !== "none"`、`recordPending: decision.reportType !== "none"` 及决策字段。

- [ ] **步骤 3：统一自动结束原因和正式报告条件**

在消息处理处按优先级生成：

```ts
let endReason: PracticeEndReason | null = null;
if (offTopicCount >= OFF_TOPIC_LIMIT) endReason = "off_topic";
else if (learnerMessageCount >= MAX_LEARNER_MESSAGES) endReason = "max_round";
else if (cleanReply.includes("【训练结束】")) endReason = "target_achieved";
```

仅 `endReason === "target_achieved"` 时令 `targetAchieved = true`。用：

```ts
const decision = endReason
  ? decidePracticeEnd({ roundCount: learnerMessageCount, endReason, targetAchieved: endReason === "target_achieved" })
  : null;
```

替换原先直接写 `completed` 的会话更新与评分调用；评分 transcript 必须携带 `decision.reportType`、`decision.endReason`。保留 AI 回复正文中的结束标记清理。

- [ ] **步骤 4：让已完成会话恢复评分时带入元数据**

在 Chat 路由“completed 但无 record”的分支，以及 `by-session/[sessionId]` 的恢复分支，从会话读取：

```ts
reportType: session.reportType === "progress" ? "progress" : "final",
endReason: session.endReason ?? "target_achieved",
```

并传给 `scoreAndSaveRecordSafe`。不允许对 `reportType="none"` 或 `status="abandoned"` 的会话触发恢复评分。

- [ ] **步骤 5：运行结束决策断言和 API 类型检查**

运行：

```powershell
npx tsx apps/api/src/lib/practice-end.test.ts
npm --workspace @zxt/api run typecheck
```

预期：输出 `practice-end tests passed`，且类型检查退出码 0。

- [ ] **步骤 6：提交 API 结束流程变更**

```powershell
git add apps/api/app/api/ai/chat/route.ts apps/api/app/api/training-records/by-session/[sessionId]/route.ts
```

随后创建一次提交，提交消息为：`feat(api): classify practice end reports`。

### 任务 5：接入移动端结束入口和报告类型展示

**文件：**
- 修改：`apps/mobile/src/lib/api.ts:293-317`
- 修改：`apps/mobile/src/components/PracticeView.tsx:158-280,860-874`
- 修改：`apps/mobile/src/components/TaskDetailPage.tsx:142-165`
- 修改：`apps/mobile/src/components/PracticeReport.tsx:85-215`

- [ ] **步骤 1：为 AI Chat 和报告页定义最小响应类型**

在 `api.ts` 新增：

```ts
export type PracticeReportType = "none" | "progress" | "final";
export type AiChatResponse = {
  isFinished: boolean;
  recordPending: boolean;
  sessionId: string;
  reportType: PracticeReportType;
  endReason: "user_end" | "target_achieved" | "off_topic" | "max_round" | null;
  targetAchieved: boolean;
  aiReply?: string;
};
```

将 `aiApi.chat` 返回值改为 `Promise<AiChatResponse>`，保留现有字段的扩展索引或完整字段定义，确保 `PracticeView` 当前读取的 `coachTip`、`emotion`、`round` 和 `perTurnScores` 均不丢失。

- [ ] **步骤 2：让 TaskDetailPage 携带报告类型**

将 `onReport` 改为：

```ts
onReport: (sessionId: string, reportType: PracticeReportType) => void;
```

增加 `reportType` state，默认 `"final"` 以兼容从历史记录进入；自动完成和主动结束都写入后端返回的 `res.reportType`，再传给 `PracticeReport`。

- [ ] **步骤 3：实现 PracticeView 的主动结束处理**

增加一个单一的 `handleEndPractice`：

```ts
async function handleEndPractice() {
  if (!activeSessionId || endingRef.current) return;
  endingRef.current = true;
  stopPlayback();
  try {
    const res = await aiApi.chat({ sceneId, action: "end", sessionId: activeSessionId });
    if (res.reportType === "none") onBack();
    else onReport(res.sessionId, res.reportType);
  } finally {
    endingRef.current = false;
  }
}
```

将顶部返回按钮改为调用该函数；未创建会话时保留直接 `onBack()`。在普通消息自动结束分支改为 `onReport(activeSessionId, res.reportType)`；当服务端意外返回 `none` 时回场景页而不是打开空报告。

- [ ] **步骤 4：在报告页显示类型并以记录值为准**

`PracticeReport` 新增 `reportType?: PracticeReportType` 属性。在标题区域：

```tsx
const isProgress = (record?.reportType ?? reportType) === "progress";
<h1>{isProgress ? "阶段性报告" : "正式报告"}</h1>
{isProgress && <p>本次结果用于复盘，不计入正式完成训练。</p>}
```

报告轮询成功后优先使用 `data.record.reportType`；现有历史报告没有字段时显示“正式报告”。不改变报告评分、建议和轮询上限逻辑。

- [ ] **步骤 5：运行移动端类型检查，确认通过**

运行：`npm --workspace @zxt/mobile run typecheck`

预期：退出码 0。

- [ ] **步骤 6：提交移动端结束和报告展示变更**

```powershell
git add apps/mobile/src/lib/api.ts apps/mobile/src/components/PracticeView.tsx apps/mobile/src/components/TaskDetailPage.tsx apps/mobile/src/components/PracticeReport.tsx
```

随后创建一次提交，提交消息为：`feat(mobile): handle progress practice reports`。

### 任务 6：全链路回归、差异审查与提交前验证

**文件：**
- 修改：仅修复本计划实施中发现的类型或逻辑错误；不得修改 `scripts/start-local.mjs`、协作说明和其他无关文件。

- [ ] **步骤 1：运行纯函数断言**

运行：`npx tsx apps/api/src/lib/practice-end.test.ts`

预期：输出 `practice-end tests passed`。

- [ ] **步骤 2：运行全项目类型检查**

运行：`npm run typecheck`

预期：所有 workspace 类型检查退出码 0。

- [ ] **步骤 3：运行移动端同步断言和生产构建**

运行：

```powershell
npx tsx apps/mobile/src/lib/speech-sync.test.ts
npm.cmd run build:mobile
```

预期：分别输出 `speech-sync tests passed` 与 `全部构建完成。`。

- [ ] **步骤 4：审查差异范围和格式**

运行：

```powershell
git diff --check
```

预期：`git diff --check` 无输出；本计划提交只涉及文件结构表中列出的文件，不纳入已存在的 `scripts/start-local.mjs`、协作配置或工具说明改动。

- [ ] **步骤 5：提交最终修正（仅在本计划文件仍有未提交修复时）**

```powershell
git add apps/api apps/mobile packages/database
```

仅在 `git status --short` 显示本计划相关文件仍有修改时执行；随后以 `fix: verify practice end reporting flow` 创建提交。否则跳过本步骤。

## 实施完成后的人工流程验证

在本地服务已由用户另行启动且可访问时，用测试账号执行以下路径；不得为此运行会阻塞的 `start:local`：

1. 新开会话，回答 2 次后点击结束：返回场景页，历史无新报告。
2. 新开会话，回答 3 次后点击结束：进入“阶段性报告”，历史可查看，但完成次数不增加。
3. 新开会话，完成至少 4 次有效回答并让 AI 输出结束标记：进入“正式报告”，完成次数增加。
4. 连续触发 3 次跑题：进入“阶段性报告”，完成次数不增加。
5. 对同一会话连续点击结束两次：仅产生一条记录，不重复评分。

完成以上验证后，部署应另行获得用户明确指示，并严格只打包本计划相关提交和此前已验证的语音同步改动。
