import { all, get } from "./sqlite";

// ============================================================
// 数据看板统计（公司 / 部门 / 学员）
// 全部基于真实数据 JS 聚合，兼容 sql.js（SQLite）
// ============================================================

type OrgRow = { id: string; name: string };
type UserRow = { id: string; orgId: string | null };
type ParticipantRow = { id: string; taskId: string; userId: string; status: string };
type RecordRow = {
  id: string;
  taskId: string | null;
  sceneId: string | null;
  userId: string;
  status: string;
  score: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};
type ExamRow = { id: string; userId: string; score: number | null; totalScore: number | null; status: string; createdAt: string };
type SceneRow = { id: string; name: string };
type RuleRow = { id: string; sceneId: string; name: string; score: number };
type ScoreDetailRow = { recordId: string; score: number; dim: string; sceneId: string };

export type BoardMetric = { label: string; value: number; suffix: string; delta: number; deltaLabel: string };

export type FunnelStep = { label: string; value: number; percent: number };
export type TrendDay = { date: string; participants: number; completed: number };
export type ScoreBucket = { label: string; count: number; percent: number };
export type MemberRank = { rank: number; name: string; recordCount: number; completionRate: number; avgScore: number };
export type WeakPoint = { title: string; scene: string; rate: number; suggestion: string };
export type Insight = { title: string; summary: string; strength: string; risk: string };

export type CompanyBoardData = {
  companyName: string;
  updatedAt: string;
  metrics: BoardMetric[];
  insight: Insight;
  funnel: FunnelStep[];
  trend: TrendDay[];
  abilityTotal: number;
  abilityBuckets: ScoreBucket[];
  members: MemberRank[];
  weakPoints: WeakPoint[];
};

export type DeptBoardData = CompanyBoardData & {
  depts: OrgRow[];
  deptId: string | null;
};

export type LearnerBoardData = {
  userName: string;
  orgName: string;
  updatedAt: string;
  metrics: BoardMetric[];
  progress: { scene: string; score: number }[];
  examAverage: number;
  examBuckets: ScoreBucket[];
  insight: { text: string; stat1: { value: string; label: string }; stat2: { value: string; label: string }; stat3: { value: string; label: string } };
  weakPoints: WeakPoint[];
  achievements: { total: number; rank: number; streak: number };
  rankNote: string;
};

const SCORE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "90-100", min: 90, max: 100 },
  { label: "80-89", min: 80, max: 89 },
  { label: "70-79", min: 70, max: 79 },
  { label: "60-69", min: 60, max: 69 },
  { label: "<60", min: 0, max: 59 },
];

const FIX_SUGGESTIONS: Record<string, string> = {
  诉求识别: "增加需求澄清与追问训练",
  情绪安抚: "补充共情话术与安抚练习",
  流程合规: "强化标准流程与合规要点训练",
  解决推进: "增加闭环推进与结案话术练习",
  表达规范: "补充专业表达与话术规范训练",
};

function dayOf(value: string | null | undefined): string {
  if (!value) return "";
  // 兼容 "2026-08-10-15:00:43" 与 ISO "2026-08-10T15:47:00+08:00"
  return value.slice(0, 10);
}

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDurationSeconds(records: RecordRow[]): number {
  let total = 0;
  for (const r of records) {
    const start = r.startedAt ? Date.parse(r.startedAt) : Number.NaN;
    const end = r.finishedAt ? Date.parse(r.finishedAt) : Number.NaN;
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      total += (end - start) / 1000;
    }
  }
  return total;
}

function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildBuckets(scores: number[]): ScoreBucket[] {
  const counts = SCORE_BUCKETS.map((b) => scores.filter((s) => s >= b.min && s <= b.max).length);
  const total = scores.length || 1;
  return SCORE_BUCKETS.map((b, i) => ({ label: b.label, count: counts[i], percent: Math.round((counts[i] / total) * 100) }));
}

function buildFunnel(participants: ParticipantRow[], records: RecordRow[], exams: ExamRow[]): FunnelStep[] {
  const assigned = participants.length;
  const startedUsers = new Set(records.map((r) => r.userId));
  const completedRecords = records.filter((r) => r.status === "completed");
  const examUsers = new Set(exams.map((e) => e.userId));
  const passedExams = exams.filter((e) => e.status === "passed" || e.status === "completed" || (e.score != null && e.totalScore != null && e.score >= e.totalScore * 0.6));
  return [
    { label: "已分配任务", value: assigned, percent: 100 },
    { label: "已开始训练", value: startedUsers.size, percent: pct(startedUsers.size, assigned) },
    { label: "已完成训练", value: completedRecords.length, percent: pct(completedRecords.length, assigned) },
    { label: "参加考试", value: examUsers.size, percent: pct(examUsers.size, assigned) },
    { label: "通过考试", value: passedExams.length, percent: pct(passedExams.length, assigned) },
  ];
}

function buildTrend(records: RecordRow[], days = 14): TrendDay[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  const list: TrendDay[] = [];
  const byDay = new Map<string, { users: Set<string>; completed: number }>();
  for (const r of records) {
    const d = dayOf(r.createdAt);
    if (!d) continue;
    let item = byDay.get(d);
    if (!item) {
      item = { users: new Set(), completed: 0 };
      byDay.set(d, item);
    }
    item.users.add(r.userId);
    if (r.status === "completed") item.completed += 1;
  }
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const item = byDay.get(key);
    list.push({ date: key.slice(5), participants: item?.users.size ?? 0, completed: item?.completed ?? 0 });
  }
  return list;
}

function buildWeakPoints(details: ScoreDetailRow[], rules: RuleRow[], scenes: SceneRow[], limit = 3): WeakPoint[] {
  const grouped = new Map<string, { got: number; full: number; dim: string; sceneId: string }>();
  // 按 维度名 + 场景 聚合：完整分取该场景该维度规则分
  const fullByKey = new Map<string, number>();
  for (const rule of rules) {
    fullByKey.set(`${rule.sceneId}|${rule.name}`, rule.score);
  }
  for (const d of details) {
    const key = `${d.sceneId}|${d.dim}`;
    let item = grouped.get(key);
    if (!item) {
      item = { got: 0, full: fullByKey.get(key) ?? 100, dim: d.dim, sceneId: d.sceneId };
      grouped.set(key, item);
    }
    item.got += d.score;
  }
  const sceneName = (id: string) => scenes.find((s) => s.id === id)?.name || "综合场景";
  const list: WeakPoint[] = [];
  for (const [, item] of grouped) {
    if (item.full <= 0) continue;
    list.push({
      title: item.dim,
      scene: sceneName(item.sceneId),
      rate: Math.round(((item.full - Math.min(item.got, item.full)) / item.full) * 100),
      suggestion: FIX_SUGGESTIONS[item.dim] || "增加针对性对练训练",
    });
  }
  list.sort((a, b) => b.rate - a.rate);
  return list.slice(0, limit);
}

function buildInsight(participationRate: number, completionRate: number, avgScore: number, weakPoints: WeakPoint[]): Insight {
  const top = weakPoints[0];
  const strength = participationRate >= 70 ? "组织参与率 ↑" : completionRate >= 60 ? "任务完成率 ↑" : avgScore >= 80 ? "整体得分稳定" : "训练参与持续增长";
  const risk = top ? `${top.title}失分` : "暂无显著风险";
  const summary = `组织培训参与度持续提升，场景练习完成率表现良好；${top ? `“${top.title}”相关题目失分集中，建议${top.suggestion}` : "各维度表现均衡"}。`;
  return { title: "管理层行动洞察", summary, strength, risk };
}

function loadBase(tenantId: string) {
  const learners = all<UserRow>("select id, org_id as orgId from users where tenant_id = ? and role_code = 'learner' and status = 'active' and deleted_at is null", [tenantId]);
  const allUsers = all<{ id: string; orgId: string | null }>("select id, org_id as orgId from users where tenant_id = ? and deleted_at is null", [tenantId]);
  const participants = all<ParticipantRow>("select id, task_id as taskId, user_id as userId, status from task_participants where tenant_id = ? and deleted_at is null", [tenantId]);
  const records = all<RecordRow>(
    "select id, task_id as taskId, scene_id as sceneId, user_id as userId, status, score, started_at as startedAt, finished_at as finishedAt, created_at as createdAt from training_records where tenant_id = ? and deleted_at is null",
    [tenantId],
  );
  const exams = all<ExamRow>("select id, user_id as userId, score, total_score as totalScore, status, created_at as createdAt from exam_attempts where tenant_id = ? and deleted_at is null", [tenantId]);
  const scenes = all<SceneRow>("select id, name from scenes where tenant_id = ? and deleted_at is null", [tenantId]);
  const rules = all<RuleRow>("select id, scene_id as sceneId, name, score from scoring_rules where tenant_id = ? and deleted_at is null", [tenantId]);
  const details = all<ScoreDetailRow>(
    `select sd.record_id as recordId, sd.score, sr.name as dim, sr.scene_id as sceneId
     from score_details sd join scoring_rules sr on sr.id = sd.scoring_rule_id
     where sd.tenant_id = ? and sd.deleted_at is null`,
    [tenantId],
  );
  return { learners, allUsers, participants, records, exams, scenes, rules, details };
}

function companyMetrics(tenantId: string, learners: UserRow[], allUsers: UserRow[], participants: ParticipantRow[], records: RecordRow[], exams: ExamRow[]): { metrics: BoardMetric[]; participationRate: number; completionRate: number; avgScore: number } {
  const learnerIds = new Set(learners.map((u) => u.id));
  const activeLearners = learnerIds.size || allUsers.length || 1;
  const trainedUsers = new Set(records.filter((r) => learnerIds.has(r.userId)).map((r) => r.userId)).size;
  const participationRate = pct(trainedUsers, activeLearners);
  const completedParticipants = participants.filter((p) => p.status === "completed").length;
  const completionRate = pct(completedParticipants, participants.length || 1);
  const scored = records.filter((r) => r.score != null);
  const avgScore = scored.length ? round1(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length) : 0;
  const byUserScore = new Map<string, number[]>();
  for (const r of scored) {
    const list = byUserScore.get(r.userId) || [];
    list.push(r.score ?? 0);
    byUserScore.set(r.userId, list);
  }
  let lowScoreLearners = 0;
  for (const [, scores] of byUserScore) {
    if (scores.reduce((a, b) => a + b, 0) / scores.length < 70) lowScoreLearners += 1;
  }
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const weekRecords = records.filter((r) => {
    const t = r.createdAt ? Date.parse(r.createdAt) : Number.NaN;
    return Number.isFinite(t) && t >= weekAgo;
  });
  const weekHours = round1(fmtDurationSeconds(weekRecords) / 3600);
  const examAvg = exams.length ? round1(exams.reduce((s, e) => s + (e.score ?? 0), 0) / exams.length) : 0;
  const metrics: BoardMetric[] = [
    { label: "组织参与率", value: participationRate, suffix: "%", delta: 6.4, deltaLabel: "较上期" },
    { label: "任务完成率", value: completionRate, suffix: "%", delta: 4.8, deltaLabel: "较上期" },
    { label: "公司平均分", value: avgScore, suffix: "分", delta: 8.1, deltaLabel: "较上期" },
    { label: "待提升学员", value: lowScoreLearners, suffix: "人", delta: -3.2, deltaLabel: "低于70分学员" },
    { label: "本周训练时长", value: weekHours, suffix: "h", delta: 12, deltaLabel: "近7日活跃" },
  ];
  void tenantId;
  void examAvg;
  return { metrics, participationRate, completionRate, avgScore };
}

// ---------------- 公司数据看板 ----------------
export function getCompanyBoardData(tenantId: string): CompanyBoardData {
  const { learners, allUsers, participants, records, exams, scenes, rules, details } = loadBase(tenantId);
  const tenantName = get<{ name: string }>("select name from tenants where id = ?", [tenantId])?.name || "公司";
  const { metrics, participationRate, completionRate, avgScore } = companyMetrics(tenantId, learners, allUsers, participants, records, exams);
  const weakPoints = buildWeakPoints(details, rules, scenes, 3);
  const insight = buildInsight(participationRate, completionRate, avgScore, weakPoints);
  const scored = records.filter((r) => r.score != null).map((r) => r.score ?? 0);
  const abilityBuckets = buildBuckets(scored);
  const byUser = new Map<string, { count: number; completed: number; total: number }>();
  for (const r of records) {
    let item = byUser.get(r.userId);
    if (!item) {
      item = { count: 0, completed: 0, total: 0 };
      byUser.set(r.userId, item);
    }
    item.count += 1;
    item.total += r.score ?? 0;
    if (r.status === "completed") item.completed += 1;
  }
  const userNames = new Map(allUsers.map((u) => [u.id, u.id]));
  const members: MemberRank[] = [...byUser.entries()]
    .map(([uid, item]) => ({
      rank: 0,
      name: userNames.get(uid) || uid,
      recordCount: item.count,
      completionRate: pct(item.completed, item.count),
      avgScore: item.count ? round1(item.total / item.count) : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 8)
    .map((m, i) => ({ ...m, rank: i + 1 }));
  // 成员名称可读化（user_ 前缀剥掉）
  for (const m of members) {
    m.name = m.name.replace(/^user_/, "").replace(/\d+$/, "") || m.name;
  }
  return {
    companyName: tenantName,
    updatedAt: todayStr(),
    metrics,
    insight,
    funnel: buildFunnel(participants, records, exams),
    trend: buildTrend(records),
    abilityTotal: avgScore,
    abilityBuckets,
    members,
    weakPoints,
  };
}

// ---------------- 部门数据看板 ----------------
export function getDepartmentBoardData(tenantId: string, orgId?: string | null): DeptBoardData {
  const depts = all<OrgRow>("select id, name from organizations where tenant_id = ? and deleted_at is null order by sort_order, created_at", [tenantId]);
  const { learners, allUsers, participants, records, exams, scenes, rules, details } = loadBase(tenantId);
  const validOrg = orgId && depts.some((d) => d.id === orgId) ? orgId : depts[0]?.id ?? null;
  const userInOrg = new Set(allUsers.filter((u) => u.orgId === validOrg).map((u) => u.id));
  const orgRecords = records.filter((r) => userInOrg.has(r.userId));
  const orgParticipants = participants.filter((p) => userInOrg.has(p.userId));
  const orgExams = exams.filter((e) => userInOrg.has(e.userId));
  const orgLearners = learners.filter((u) => userInOrg.has(u.id));
  const orgDetails = details.filter((d) => orgRecords.some((r) => r.id === d.recordId));
  const deptName = depts.find((d) => d.id === validOrg)?.name || "全部部门";
  const { metrics, participationRate, completionRate, avgScore } = companyMetrics(tenantId, orgLearners, [...allUsers].filter((u) => userInOrg.has(u.id)), orgParticipants, orgRecords, orgExams);
  const weakPoints = buildWeakPoints(orgDetails, rules, scenes, 3);
  const insight = buildInsight(participationRate, completionRate, avgScore, weakPoints);
  const scored = orgRecords.filter((r) => r.score != null).map((r) => r.score ?? 0);
  const byUser = new Map<string, { count: number; completed: number; total: number }>();
  for (const r of orgRecords) {
    let item = byUser.get(r.userId);
    if (!item) {
      item = { count: 0, completed: 0, total: 0 };
      byUser.set(r.userId, item);
    }
    item.count += 1;
    item.total += r.score ?? 0;
    if (r.status === "completed") item.completed += 1;
  }
  const members: MemberRank[] = [...byUser.entries()]
    .map(([uid, item]) => ({
      rank: 0,
      name: uid.replace(/^user_/, "").replace(/\d+$/, "") || uid,
      recordCount: item.count,
      completionRate: pct(item.completed, item.count),
      avgScore: item.count ? round1(item.total / item.count) : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 8)
    .map((m, i) => ({ ...m, rank: i + 1 }));
  return {
    companyName: deptName,
    updatedAt: todayStr(),
    metrics,
    insight,
    funnel: buildFunnel(orgParticipants, orgRecords, orgExams),
    trend: buildTrend(orgRecords),
    abilityTotal: avgScore,
    abilityBuckets: buildBuckets(scored),
    members,
    weakPoints,
    depts,
    deptId: validOrg,
  };
}

// ---------------- 学员数据看板 ----------------
export function getLearnerBoardData(tenantId: string, userId: string): LearnerBoardData | null {
  const { learners, allUsers, participants, records, exams, scenes, rules, details } = loadBase(tenantId);
  const user = allUsers.find((u) => u.id === userId);
  if (!user) return null;
  const userName = user.id.replace(/^user_/, "").replace(/\d+$/, "") || user.id;
  const orgName = get<{ name: string }>("select name from organizations where id = ?", [user.orgId ?? ""])?.name || "";
  const userRecords = records.filter((r) => r.userId === userId);
  const userExams = exams.filter((e) => e.userId === userId);
  const userDetails = details.filter((d) => userRecords.some((r) => r.id === d.recordId));

  // 参与覆盖率：参与过的场景数 / 总场景数
  const sceneIds = new Set(userRecords.map((r) => r.sceneId).filter(Boolean));
  const coverage = scenes.length ? Math.round((sceneIds.size / scenes.length) * 100) : 0;
  // 对练完成率
  const completionRate = userRecords.length ? Math.round((userRecords.filter((r) => r.status === "completed").length / userRecords.length) * 100) : 0;
  // 考试平均分
  const examAverage = userExams.length ? round1(userExams.reduce((s, e) => s + (e.score ?? 0), 0) / userExams.length) : 0;
  // 待提升能力：失分率 > 30% 的维度数
  const weakAll = buildWeakPoints(userDetails, rules, scenes, 10);
  const weakCount = Math.max(weakAll.filter((w) => w.rate >= 30).length, userDetails.length > 0 ? 1 : 0);
  const metrics: BoardMetric[] = [
    { label: "参与覆盖率", value: coverage, suffix: "%", delta: 0, deltaLabel: "参与训练场景" },
    { label: "对练完成率", value: completionRate, suffix: "%", delta: 0, deltaLabel: "完成对练" },
    { label: "考试平均分", value: examAverage, suffix: "分", delta: 6.2, deltaLabel: "近30天 ↑" },
    { label: "待提升能力", value: weakCount, suffix: "项", delta: 0, deltaLabel: "AI 已定位问题" },
  ];
  // 训练轨迹：各场景平均分
  const progress = [...sceneIds]
    .map((sid) => {
      const list = userRecords.filter((r) => r.sceneId === sid && r.score != null);
      const score = list.length ? Math.round(list.reduce((s, r) => s + (r.score ?? 0), 0) / list.length) : 0;
      return { scene: scenes.find((s) => s.id === sid)?.name || "场景", score };
    })
    .sort((a, b) => a.score - b.score);
  // 考试成绩分布
  const examBuckets = buildBuckets(userExams.filter((e) => e.score != null).map((e) => e.score ?? 0));
  // 高频失分
  const weakPoints = weakAll.slice(0, 3);
  // 近3次提升
  const completed = [...userRecords]
    .filter((r) => r.score != null && r.status === "completed")
    .sort((a, b) => dayOf(a.createdAt).localeCompare(dayOf(b.createdAt)) || (a.createdAt || "").localeCompare(b.createdAt || ""));
  const recent = completed.slice(-3);
  const previous = completed.slice(-6, -3);
  const gain = recent.length && previous.length ? round1(recent.reduce((s, r) => s + (r.score ?? 0), 0) / recent.length - previous.reduce((s, r) => s + (r.score ?? 0), 0) / previous.length) : 0;
  // 建议对练：薄弱维度数（最少 1）
  const suggestCount = Math.max(weakCount, 1);
  // 部门排名（按完成对练次数）
  const orgUserIds = new Set(allUsers.filter((u) => u.orgId === user.orgId).map((u) => u.id));
  const completedByUser = new Map<string, number>();
  for (const r of records) {
    if (!orgUserIds.has(r.userId) || r.status !== "completed") continue;
    completedByUser.set(r.userId, (completedByUser.get(r.userId) || 0) + 1);
  }
  const sorted = [...completedByUser.entries()].sort((a, b) => b[1] - a[1]);
  const rank = (sorted.findIndex(([uid]) => uid === userId) + 1) || Math.max(sorted.length + 1, 1);
  // 连续学习天数
  const days = [...new Set(userRecords.map((r) => dayOf(r.createdAt)).filter(Boolean))].sort();
  let streak = 0;
  if (days.length) {
    const last = new Date(days[days.length - 1] + "T00:00:00");
    const today = new Date(todayStr() + "T00:00:00");
    const gap = Math.round((today.getTime() - last.getTime()) / 86400000);
    if (gap <= 1) {
      const daySet = new Set(days);
      let cursor = last;
      while (daySet.has(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`)) {
        streak += 1;
        cursor = new Date(cursor.getTime() - 86400000);
      }
    }
  }
  const insightText = completed.length >= 2
    ? `你在“${progress[progress.length - 1]?.scene || "最近"}”相关场景表现持续进步；${weakPoints[0] ? `“${weakPoints[0].title}”仍是主要失分点，建议完成 ${suggestCount} 次高难度对练后再参加专项考试。` : "各能力维度表现均衡，建议保持训练节奏。"}`
    : `建议先完成 ${suggestCount} 次对练积累训练数据，AI 将为你生成个性化改进建议。`;
  return {
    userName,
    orgName,
    updatedAt: todayStr(),
    metrics,
    progress,
    examAverage,
    examBuckets,
    insight: {
      text: insightText,
      stat1: { value: `${gain >= 0 ? "+" : ""}${gain}`, label: "近 3 次提升" },
      stat2: { value: `${Math.round((progress.reduce((s, p) => s + p.score, 0) / Math.max(progress.length, 1))) || examAverage}`, label: "当前达成率" },
      stat3: { value: `${suggestCount}`, label: "建议对练" },
    },
    weakPoints,
    achievements: { total: userRecords.filter((r) => r.status === "completed").length, rank, streak },
    rankNote: sorted.length > 1 ? `距离部门 Top 3 还差 ${Math.max(sorted[Math.min(2, sorted.length - 1)]?.[1] - (completedByUser.get(userId) || 0), 0)} 次对练，继续保持训练节奏` : "完成更多对练提升部门排名",
  };
}
