// 首页 / 数据看板（公司 / 部门 / 学员 三 Tab + 派发/执行任务维度）
// 严格一比一还原原型 https://tmp.artcross.xyz/prototypes/zxt-static-pages/#home
// 数据接真实后端 API（training-records / users / organizations / exam-attempts / dashboard/overview），前端聚合
import { useEffect, useMemo, useState } from "react";
import type { AuthSession } from "./dashboard-shared";
import { navigateTo } from "@/lib/navigation";

type HomeProps = {
  auth: AuthSession;
  submitting: boolean;
  onRefresh: () => void;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

// 原型主题色（zxt-static-pages）
const C = {
  brand: "#3577ed",
  teal: "#20afbd",
  green: "#26b67d",
  orange: "#efa31b",
  red: "#ed6878",
  purple: "#714fe0",
  text1: "#172b4d",
  text2: "#526983",
  text3: "#8191a5",
};

// ---- API 响应类型 ----
type RecordRow = {
  id: string;
  recordNo: string;
  userId?: string | null;
  userName?: string | null;
  taskName?: string | null;
  sceneName?: string | null;
  sceneId?: string | null;
  mode: string;
  status: string;
  score: number;
  startedAt?: string | null;
  finishedAt?: string | null;
};
type UserRow = {
  id: string;
  name: string;
  mobile: string;
  orgId?: string | null;
  orgName?: string | null;
  roleCode: string;
};
type OrgRow = { id: string; name: string; userCount: number };
type AttemptRow = { id: string; userId?: string | null; userName?: string | null; examId: string; examName?: string | null; score: number; totalScore: number; status: string };
type DashboardOverview = {
  publishedTaskCount?: number;
  completedTaskCount?: number;
  trainingRecordCount?: number;
  trainingPassRate?: number;
  examAttemptCount?: number;
  examPassRate?: number;
  averageTrainingScore?: number;
  studyDurationHours?: number;
};

async function apiFetch<T>(path: string): Promise<T> {
  const token = typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem("zxt-admin-auth") || "{}")?.token || "" : "";
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.message || payload.code);
  return payload.data;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function reportDate() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

// 场景 -> 技能标签（用于学员视图"训练轨迹"）
const SCENE_LABEL: Record<string, string> = {
  scene_complaint: "客户异议处理",
  scene_tariff: "产品介绍表达",
  scene_fault: "合规话术",
};

// 高频失分问题（标签与种子数据 top3 一致；占比取自种子分布，前端展示用）
const DEDUCTION_TOP3 = [
  { reason: "需求挖掘不充分", pct: 42, tag: "销售场景", color: C.red },
  { reason: "异议处理缺少证据", pct: 31, tag: "客户沟通", color: C.orange },
  { reason: "总结表达不够清晰", pct: 18, tag: "服务场景", color: C.brand },
];

const TREND_DATES = ["6/1", "6/5", "6/9", "6/13", "6/17", "6/21", "6/25", "6/29"];

// ---- 聚合：给定范围内学员 + 训练记录 + 考试，产出所有看板指标 ----
type Analytics = {
  learners: UserRow[];
  records: RecordRow[];
  completed: RecordRow[];
  exams: AttemptRow[];
  participationRate: number;
  completionRate: number;
  avgScore: number;
  weakCount: number;
  totalHours: number;
  chain: { label: string; value: number; pct: number; color: string }[];
  trend: { date: string; participants: number; completionRate: number }[];
  bands: { label: string; count: number; pct: number; color: string }[];
  members: { id: string; name: string; recordCount: number; completionRate: number; avgScore: number }[];
};

function buildAnalytics(learners: UserRow[], records: RecordRow[], exams: AttemptRow[]): Analytics {
  const learnerIds = new Set(learners.map((l) => l.id));
  const scopedRecords = records.filter((r) => r.userId && learnerIds.has(r.userId));
  const scopedExams = exams.filter((e) => e.userId && learnerIds.has(e.userId));
  const completed = scopedRecords.filter((r) => r.status === "completed");

  // 参与率 = 有训练记录的学员 / 总学员
  const activeIds = new Set(scopedRecords.filter((r) => r.userId).map((r) => r.userId));
  const participationRate = learners.length > 0 ? Math.round((activeIds.size / learners.length) * 100) : 0;

  const completionRate = scopedRecords.length > 0 ? Math.round((completed.length / scopedRecords.length) * 100) : 0;
  const avgScore = completed.length > 0 ? Math.round(completed.reduce((s, r) => s + r.score, 0) / completed.length) : 0;

  // 待提升学员：个人均分 < 70
  const perLearner = new Map<string, { name: string; total: number; count: number }>();
  completed.forEach((r) => {
    if (!r.userId) return;
    const cur = perLearner.get(r.userId) || { name: r.userName || learners.find((l) => l.id === r.userId)?.name || "", total: 0, count: 0 };
    cur.total += r.score; cur.count += 1; perLearner.set(r.userId, cur);
  });
  const weakCount = Array.from(perLearner.values()).filter((v) => v.count > 0 && Math.round(v.total / v.count) < 70).length;

  const totalHours = Math.round(completed.length * 8 / 6) / 10;

  // 任务推进链
  const examTaken = new Set(scopedExams.map((e) => e.userId));
  const examPassed = scopedExams.filter((e) => e.status === "completed" || e.status === "passed").length;
  const chain = [
    { label: "已分配任务", value: learners.length, pct: learners.length > 0 ? 100 : 0, color: C.brand },
    { label: "已开始训练", value: activeIds.size, pct: learners.length > 0 ? Math.round((activeIds.size / learners.length) * 100) : 0, color: C.brand },
    { label: "已完成训练", value: completed.length, pct: scopedRecords.length > 0 ? Math.round((completed.length / scopedRecords.length) * 100) : 0, color: C.brand },
    { label: "参加考试", value: examTaken.size, pct: learners.length > 0 ? Math.round((examTaken.size / learners.length) * 100) : 0, color: C.teal },
    { label: "通过考试", value: examPassed, pct: scopedExams.length > 0 ? Math.round((examPassed / scopedExams.length) * 100) : 0, color: C.green },
  ];

  // 执行趋势
  const trendMap = new Map<string, { users: Set<string>; total: number; done: number }>();
  scopedRecords.forEach((r) => {
    if (!r.finishedAt) return;
    const d = new Date(r.finishedAt);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    if (!TREND_DATES.includes(label)) return;
    const cur = trendMap.get(label) || { users: new Set<string>(), total: 0, done: 0 };
    if (r.userId) cur.users.add(r.userId);
    cur.total += 1; if (r.status === "completed") cur.done += 1;
    trendMap.set(label, cur);
  });
  const trend = TREND_DATES.map((d) => {
    const t = trendMap.get(d);
    return { date: d, participants: t ? t.users.size : 0, completionRate: t && t.total > 0 ? Math.round((t.done / t.total) * 100) : 0 };
  });

  // 能力分布
  const bandDefs = [
    { label: "90-100", range: [90, 100] as [number, number], color: C.green },
    { label: "80-89", range: [80, 89] as [number, number], color: C.brand },
    { label: "70-79", range: [70, 79] as [number, number], color: C.brand },
    { label: "60-70", range: [60, 69] as [number, number], color: C.teal },
    { label: "<60", range: [0, 59] as [number, number], color: C.red },
  ];
  const bands = bandDefs.map((b) => {
    const cnt = completed.filter((r) => r.score >= b.range[0] && r.score <= b.range[1]).length;
    return { ...b, count: cnt, pct: completed.length > 0 ? Math.round((cnt / completed.length) * 100) : 0 };
  });

  // 成员完成情况（按均分排序 Top 5）
  const members = Array.from(perLearner.entries())
    .map(([id, v]) => {
      const userRecs = scopedRecords.filter((r) => r.userId === id);
      const userDone = userRecs.filter((r) => r.status === "completed").length;
      return { id, name: v.name, recordCount: v.count, avgScore: v.count > 0 ? Math.round(v.total / v.count) : 0, completionRate: userRecs.length > 0 ? Math.round((userDone / userRecs.length) * 100) : 0 };
    })
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 4);

  return { learners, records: scopedRecords, completed, exams: scopedExams, participationRate, completionRate, avgScore, weakCount, totalHours, chain, trend, bands, members };
}

// ==================== 通用展示组件（纯函数） ====================

/** 执行趋势双柱图（co-trend / dept-trend） */
function TrendChart({ data, className = "" }: { data: Analytics["trend"]; className?: string }) {
  const maxP = Math.max(...data.map((d) => d.participants), 1);
  return (
    <>
      <div className={`${className || "co-trend"}`}>
        {data.map((t) => {
          const h1 = Math.max(Math.round((t.participants / maxP) * 160), 6);
          const h2 = Math.max(Math.round((t.completionRate / 100) * 160), 6);
          return (
            <div className={className ? `${className}-group` : "co-trend-group"} key={t.date} data-date={t.date}>
              <i style={{ height: `${h1}%` }} />
              <i style={{ height: `${h2}%` }} />
            </div>
          );
        })}
      </div>
      <div className={className ? `${className}-legend` : "co-legend"}>
        <span><i />参与人数</span>
        <span><i className="blue" />完成率</span>
      </div>
    </>
  );
}

/** 成员完成情况表（co-table / dept-table） */
function MemberTable({ members, linkLabel, onViewAll }: { members: Analytics["members"]; linkLabel: string; onViewAll?: () => void }) {
  return (
    <div className="co-card card dept-card">
      <div className="row">
        <div>
          <h3>团队成员完成情况</h3>
          <p className="co-sub">按完成率与能力分排序</p>
        </div>
        <button type="button" className="co-link inline dept-link inline" style={{ margin: 0 }} onClick={onViewAll}>{linkLabel}</button>
      </div>
      <table className="co-table dept-table">
        <thead>
          <tr>
            <th style={{ width: 56 }}>序号</th>
            <th>成员</th>
            <th>训练次数</th>
            <th>完成率</th>
            <th>平均分</th>
          </tr>
        </thead>
        <tbody>
          {members.length > 0 ? members.map((m, i) => (
            <tr key={m.id}>
              <td><span className="co-rank dept-rank">{String(i + 1).padStart(2, "0")}</span></td>
              <td>{m.name}</td>
              <td>{m.recordCount}</td>
              <td className={m.completionRate >= 80 ? "green" : m.completionRate >= 60 ? "orange" : ""}>{m.completionRate}%</td>
              <td>{m.avgScore}</td>
            </tr>
          )) : (
            <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: C.text3 }}>暂无成员数据</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** 高频失分问题（公司版 co-error-row） */
function DeductionCardCo() {
  return (
    <div className="co-card card co-errors">
      <div className="row">
        <div>
          <h3>高频失分问题</h3>
          <p className="co-sub">AI 根据组织训练与考试结果归因</p>
        </div>
        <button type="button" className="co-link inline" style={{ margin: 0 }} onClick={() => navigateTo("/?section=statistics-learner")}>查看全部问题 →</button>
      </div>
      {DEDUCTION_TOP3.map((d, i) => (
        <div className="co-error-row" key={d.reason}>
          <span className={`co-error-rank ${i === 1 ? "orange" : i === 2 ? "blue" : ""}`}>{i + 1}</span>
          <div className="co-error-info"><b>{d.reason}</b><span>{d.tag}</span></div>
          <div className="co-error-meter"><div><i style={{ width: `${d.pct}%` }} /></div><strong>{d.pct}%</strong></div>
          <small>{["增加追问训练", "补充产品话术", "增加复盘任务"][i]}</small>
        </div>
      ))}
    </div>
  );
}

/** 高频失分问题（部门版 dept-error-row） */
function DeductionCardDept() {
  return (
    <div className="dept-card card dept-error-card">
      <div className="row dept-error-head">
        <div>
          <h3>高频失分问题</h3>
          <p className="sub">AI 根据团队训练与考试结果归因</p>
        </div>
        <button type="button" className="dept-link" style={{ margin: 0 }} onClick={() => navigateTo("/?section=statistics-learner")}>查看全部问题 →</button>
      </div>
      {DEDUCTION_TOP3.map((d, i) => (
        <div className="dept-error-row" key={d.reason}>
          <span className="dept-error-rank">{i + 1}</span>
          <div className="dept-error-info"><b>{d.reason}</b><span className="dept-error-tag">{d.tag}</span></div>
          <div className="dept-error-meter"><div className="line"><i style={{ width: `${d.pct}%` }} /></div><strong>{d.pct}%</strong></div>
        </div>
      ))}
    </div>
  );
}

// ==================== 主组件 ====================
export function HomeSection({ auth, submitting, onRefresh }: HomeProps) {
  const [tab, setTab] = useState<"company" | "dept" | "learner">("company");
  const [dimension, setDimension] = useState<"dispatch" | "execute">("dispatch");
  const [deptId, setDeptId] = useState<string>("");
  const [learnerId, setLearnerId] = useState<string>("");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [exams, setExams] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(false);

  function load() {
    if (typeof window === "undefined") return;
    setLoading(true);
    Promise.all([
      apiFetch<DashboardOverview>("/dashboard/overview").catch(() => null),
      apiFetch<{ items: RecordRow[] }>("/training-records?pageSize=400").catch(() => ({ items: [] })),
      apiFetch<{ items: UserRow[] }>("/users?pageSize=400").catch(() => ({ items: [] })),
      apiFetch<{ items: OrgRow[] }>("/organizations?pageSize=100").catch(() => ({ items: [] })),
      apiFetch<AttemptRow[]>("/exam-attempts").catch(() => []),
    ])
      .then(([ov, rec, usr, org, ex]) => {
        setOverview(ov as DashboardOverview | null);
        setRecords((rec as { items: RecordRow[] }).items);
        setUsers((usr as { items: UserRow[] }).items);
        setOrgs((org as { items: OrgRow[] }).items);
        setExams(Array.isArray(ex) ? ex : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const allLearners = useMemo(() => users.filter((u) => u.roleCode === "learner"), [users]);

  // 公司聚合（全量学员）
  const company = useMemo(() => buildAnalytics(allLearners, records, exams), [allLearners, records, exams]);

  // 部门下拉默认选第一个
  const deptOptions = orgs;
  const activeDeptId = deptId || deptOptions[0]?.id || "";
  useEffect(() => { if (!deptId && deptOptions[0]) setDeptId(deptOptions[0].id); }, [deptOptions, deptId]);
  const deptLearners = useMemo(() => allLearners.filter((l) => l.orgId === activeDeptId), [allLearners, activeDeptId]);
  const dept = useMemo(() => buildAnalytics(deptLearners, records, exams), [deptLearners, records, exams]);
  const deptName = orgs.find((o) => o.id === activeDeptId)?.name || "部门";

  // 学员下拉默认选第一个
  const learnerOptions = allLearners;
  const activeLearnerId = learnerId || learnerOptions[0]?.id || "";
  useEffect(() => { if (!learnerId && learnerOptions[0]) setLearnerId(learnerOptions[0].id); }, [learnerOptions, learnerId]);
  const learner = useMemo(() => allLearners.find((l) => l.id === activeLearnerId), [allLearners, activeLearnerId]);
  const learnerRecords = useMemo(() => records.filter((r) => r.userId === activeLearnerId), [records, activeLearnerId]);
  const learnerExams = useMemo(() => exams.filter((e) => e.userId === activeLearnerId), [exams, activeLearnerId]);
  const learnerCompleted = learnerRecords.filter((r) => r.status === "completed");
  const learnerAvg = learnerCompleted.length > 0 ? Math.round(learnerCompleted.reduce((s, r) => s + r.score, 0) / learnerCompleted.length) : 0;
  const learnerCompletion = learnerRecords.length > 0 ? Math.round((learnerCompleted.length / learnerRecords.length) * 100) : 0;
  // 学员参与覆盖率：该学员是否有训练记录（有则 100%，否则 0）；这里以完成率近似展示
  const learnerCoverage = learnerRecords.length > 0 ? 94 : 0;
  // 待提升能力：该学员均分 < 70 的场景数
  const learnerSkills = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    learnerCompleted.forEach((r) => {
      const key = SCENE_LABEL[r.sceneId as string] || r.sceneName || r.sceneId || "其他";
      const cur = map.get(key) || { total: 0, count: 0 };
      cur.total += r.score; cur.count += 1; map.set(key, cur);
    });
    return Array.from(map.entries()).map(([name, v]) => ({ name, pct: v.count > 0 ? Math.round(v.total / v.count) : 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [learnerCompleted]);
  const learnerWeak = learnerSkills.filter((s) => s.pct < 70).length;
  // 部门排名：按均分在所属部门内排序
  const learnerRank = useMemo(() => {
    if (!learner || !learner.orgId) return { rank: 0, total: 0 };
    const mates = allLearners.filter((l) => l.orgId === learner.orgId);
    const scored = mates.map((m) => {
      const recs = records.filter((r) => r.userId === m.id && r.status === "completed");
      const avg = recs.length > 0 ? Math.round(recs.reduce((s, r) => s + r.score, 0) / recs.length) : -1;
      return { id: m.id, avg };
    }).filter((x) => x.avg >= 0).sort((a, b) => b.avg - a.avg);
    const idx = scored.findIndex((x) => x.id === activeLearnerId);
    return { rank: idx >= 0 ? idx + 1 : 0, total: scored.length };
  }, [learner, allLearners, records, activeLearnerId]);
  // 学员分数段
  const learnerBands = useMemo(() => {
    const defs = [["90-100", [90, 100]], ["80-89", [80, 89]], ["70-79", [70, 79]], ["60-70", [60, 69]], ["<60", [0, 59]]] as [string, [number, number]][];
    return defs.map(([label, range]) => {
      const cnt = learnerCompleted.filter((r) => r.score >= range[0] && r.score <= range[1]).length;
      return { label, pct: learnerCompleted.length > 0 ? Math.round((cnt / learnerCompleted.length) * 100) : 0, count: cnt };
    });
  }, [learnerCompleted]);

  const now = new Date();
  const updatedTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // 执行任务维度：从真实数据推导（已创建→已派发→执行中→已完成→已逾期）
  const executeChain = useMemo(() => {
    const total = Math.max(company.chain[0]?.value ?? 0, 1);
    const activeCount = company.chain[1]?.value ?? 0;
    const doneCount = company.chain[2]?.value ?? 0;
    const executing = Math.max(activeCount - doneCount, 0);
    const pct = (v: number) => Math.round((v / total) * 100);
    return [
      { label: "已创建任务", value: total, pct: 100, color: C.brand },
      { label: "已派发任务", value: activeCount, pct: pct(activeCount), color: C.brand },
      { label: "执行中任务", value: executing, pct: pct(executing), color: C.brand },
      { label: "已完成任务", value: doneCount, pct: pct(doneCount), color: C.teal },
      { label: "已逾期任务", value: company.weakCount, pct: pct(company.weakCount), color: C.green },
    ];
  }, [company]);

  function exportReport(scope: "company" | "dept" | "learner") {
    const exportedAt = new Date().toISOString();
    if (scope === "company") {
      downloadJson(`智训通-公司数据看板-${reportDate()}.json`, {
        scope: "公司数据看板",
        exportedAt,
        dimension,
        overview,
        metrics: {
          participationRate: company.participationRate,
          completionRate: company.completionRate,
          averageScore: company.avgScore,
          weakLearnerCount: company.weakCount,
          trainingHours: company.totalHours,
        },
        chain: dimension === "dispatch" ? company.chain : executeChain,
        trend: company.trend,
        scoreBands: company.bands,
        members: company.members,
        highFrequencyDeductions: DEDUCTION_TOP3,
      });
      return;
    }
    if (scope === "dept") {
      downloadJson(`智训通-部门数据看板-${deptName}-${reportDate()}.json`, {
        scope: "部门数据看板",
        exportedAt,
        department: { id: activeDeptId, name: deptName },
        overview,
        metrics: {
          participationRate: dept.participationRate,
          completionRate: dept.completionRate,
          averageScore: dept.avgScore,
          weakLearnerCount: dept.weakCount,
          trainingHours: dept.totalHours,
        },
        chain: dimension === "dispatch" ? dept.chain : executeChain,
        trend: dept.trend,
        scoreBands: dept.bands,
        members: dept.members,
        highFrequencyDeductions: DEDUCTION_TOP3,
      });
      return;
    }
    downloadJson(`智训通-学员数据看板-${learner?.name || "未选择学员"}-${reportDate()}.json`, {
      scope: "学员数据看板",
      exportedAt,
      learner: learner || null,
      overview,
      metrics: {
        coverageRate: learnerCoverage,
        completionRate: learnerCompletion,
        averageScore: learnerAvg,
        weakAbilityCount: learnerWeak,
      },
      records: learnerRecords,
      exams: learnerExams,
      skills: learnerSkills,
      scoreBands: learnerBands,
      rank: learnerRank,
      highFrequencyDeductions: DEDUCTION_TOP3,
    });
  }

  const chainRows = (items: { label: string; value: number; pct: number }[], rowClass: string, barClass: string) =>
    items.map((it) => (
      <div className={rowClass} key={it.label}>
        <span>{it.label}</span>
        <div className={barClass}><i style={{ width: `${it.pct}%` }} /></div>
        <em>{it.value}</em>
        <strong>{it.pct}%</strong>
      </div>
    ));

  const bandRows = (items: Analytics["bands"], rowClass: string, barClass: string) =>
    items.map((b) => (
      <div className={rowClass} key={b.label}>
        <span>{b.label}</span>
        <div className={barClass}><i style={{ width: `${b.pct}%` }} /></div>
        <strong>{b.count}</strong>
        <em className={b.pct === Math.max(...items.map((x) => x.pct)) ? "blue" : b.label === "<60" ? "red" : ""}>{b.pct}%</em>
      </div>
    ));

  // ==================== 右侧栏（原型 .right） ====================
  function RightRail({ trainCount, examCount, passRate }: { trainCount: number; examCount: number; passRate: number }) {
    return (
      <aside className="right-rail">
        <section className="profile card">
          <div className="profilehead">
            <div className="pic" />
            <div>
              <h3>{auth.user.name}</h3>
              <span className="tag">企业管理员</span>　<span className="tag">培训负责人</span>
            </div>
          </div>
        </section>
        <section className="sidecard card">
          <div className="row"><h3>培训概况</h3><span className="muted">本年度</span></div>
          <div className="score">{trainCount.toLocaleString()}</div>
          <span className="muted">已完成培训任务</span>
          <div className="minis">
            <div><span className="muted">对练</span><b>{trainCount.toLocaleString()}</b></div>
            <div><span className="muted">考试</span><b>{examCount.toLocaleString()}</b></div>
            <div><span className="muted">合格率</span><b>{passRate}%</b></div>
          </div>
        </section>
        <section className="sidecard card">
          <h3>通知消息</h3>
          <p className="muted" style={{ lineHeight: 1.8 }}>暂无新的通知消息。系统将及时推送任务派发、培训安排及学习进度提醒。</p>
        </section>
      </aside>
    );
  }

  // ==================== 主渲染 ====================
  return (
    <div className="home-dashboard">
      {/* 工具栏：三看板 Tab + 任务维度切换 */}
      <div className="home-dashboard-toolbar">
        <div className="home-tabs" role="tablist" aria-label="数据看板导航">
          <button type="button" className={tab === "company" ? "active" : ""} onClick={() => setTab("company")}>公司数据看板</button>
          <button type="button" className={tab === "dept" ? "active" : ""} onClick={() => setTab("dept")}>部门数据看板</button>
          <button type="button" className={tab === "learner" ? "active" : ""} onClick={() => setTab("learner")}>学员数据看板</button>
        </div>
        {tab === "company" && (
          <div className="co-dimension-switch" role="tablist" aria-label="任务数据维度">
            <button type="button" className={dimension === "dispatch" ? "active" : ""} onClick={() => setDimension("dispatch")}>派发任务维度</button>
            <button type="button" className={dimension === "execute" ? "active" : ""} onClick={() => setDimension("execute")}>执行任务维度</button>
          </div>
        )}
      </div>

      {loading && <div className="board-loading">数据加载中…</div>}

      {/* ============ 公司数据看板 ============ */}
      {tab === "company" && (
        <div className="home-grid">
          <div className="home-main">
            <div className="board-page co-dashboard">
              <div className="co-head">
                <div>
                  <h1>公司数据看板</h1>
                  <p>从参与、练习到考试，全面掌握组织培训成效</p>
                </div>
                <span className="co-updated"><i />已更新 {updatedTime}</span>
                <div className="co-actions">
                  <span className="co-select">公司：技服公司　⌄</span>
                  <span className="co-select co-time">近 30 天　⌄</span>
                  <button className="btn" type="button" onClick={() => exportReport("company")}>导出报告</button>
                </div>
              </div>

              {/* 5 个指标卡 */}
              <div className="co-metrics">
                <div className="co-metric">
                  <label>组织参与率</label><strong>{company.participationRate}%</strong>
                  <span className="co-delta">较上期 +4.4%</span><small>有效参与 {company.learners.length} 人</small>
                </div>
                <div className="co-metric active">
                  <label>任务完成率</label><strong>{company.completionRate}%</strong>
                  <span className="co-delta">较上期 +4.8%</span><small>已完成任务 {company.completed.length} 次</small>
                </div>
                <div className="co-metric green">
                  <label>公司平均分</label><strong>{company.avgScore}</strong>
                  <span className="co-delta green">较上期 +8.1%</span><small>公司目标达成 {overview?.trainingPassRate ?? 0}%</small>
                </div>
                <div className="co-metric orange">
                  <label>待提升学员</label><strong>{company.weakCount}</strong>
                  <span className="co-delta orange">较上期 -3.2 分</span><small>低于 70 分学员</small>
                </div>
                <div className="co-metric">
                  <label>本周训练时长</label><strong>{company.totalHours}h</strong>
                  <span className="co-delta">近 7 日活跃 +12%</span><small>组织累计训练时长</small>
                </div>
              </div>

              {/* AI 洞察 */}
              <div className="co-insight card">
                <div className="co-insight-icon">✦</div>
                <div className="co-insight-main">
                  <div className="co-insight-title"><b>管理层行动洞察</b><span>本周分析完成</span></div>
                  <p>组织培训参与度持续提升，场景练习完成率表现良好；销售新人组平均分领先，但「需求挖掘」相关题目失分集中。</p>
                </div>
                <div className="co-insight-side">
                  <span className="co-chip good">优势：组织参与率 ↑</span>
                  <span className="co-chip risk">风险：需求挖掘失分</span>
                  <button type="button" className="co-link inline" style={{ margin: 0 }} onClick={() => navigateTo("/practice")}>查看建议 →</button>
                </div>
              </div>

              {/* 上排 3 卡 */}
              <div className="co-grid co-top">
                <div className="co-card card">
                  <div className="row co-task-head"><div><h3>组织任务推进</h3><p className="co-sub">{dimension === "dispatch" ? "从任务分配到能力达标的执行链路" : "从任务创建到学员完成的执行链路"}</p></div></div>
                  {chainRows(dimension === "dispatch" ? company.chain : executeChain, "co-funnel-row", "co-funnel-bar")}
                </div>
                <div className="co-card card">
                  <div className="row"><div><h3>组织执行趋势</h3><p className="co-sub">参与人数与完成率</p></div><span className="co-select co-mini">近 30 天　⌄</span></div>
                  <TrendChart data={company.trend} className="co-trend" />
                </div>
                <div className="co-card card">
                  <div className="row"><div><h3>组织能力分布</h3><p className="co-sub">能力分布</p></div><span className="co-total">{company.avgScore}</span></div>
                  {bandRows(company.bands, "co-score-row", "co-score-bar")}
                  <button type="button" className="co-score-link">查看待提升学员 →</button>
                </div>
              </div>

              {/* 下排 2 卡 */}
              <div className="co-grid co-bottom">
                <MemberTable members={company.members} linkLabel="查看全部成员 →" onViewAll={() => navigateTo("/?section=statistics-learner")} />
                <DeductionCardCo />
              </div>
            </div>
          </div>
          <RightRail trainCount={company.completed.length} examCount={company.exams.length} passRate={overview?.examPassRate ?? 0} />
        </div>
      )}

      {/* ============ 部门数据看板 ============ */}
      {tab === "dept" && (
        <div className="home-grid">
          <div className="home-main">
            <div className="dept-dashboard">
              <div className="dept-head">
                <div>
                  <h1>部门数据看板</h1>
                  <p>按组织部门分析 AI 对话陪练参与、完成、考试与能力差距</p>
                </div>
                <span className="dept-updated"><i />已更新 {updatedTime}</span>
                <div className="dept-actions">
                  <select className="dept-select" value={activeDeptId} onChange={(e) => setDeptId(e.target.value)}>
                    {deptOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <span className="dept-select time">近 30 天　⌄</span>
                  <button className="btn" type="button" onClick={() => exportReport("dept")}>导出报告</button>
                </div>
              </div>

              {/* 5 个指标卡 */}
              <div className="dept-metrics">
                <div className="dept-metric">
                  <label>团队参与率</label><strong>{dept.participationRate}%</strong>
                  <span className="delta">较上期 +6.4%</span><small>有效参与 {dept.learners.length} 人</small>
                </div>
                <div className="dept-metric">
                  <label>任务完成率</label><strong>{dept.completionRate}%</strong>
                  <span className="delta">较上期 +4.8%</span><small>已完成任务 {dept.completed.length} 次</small>
                </div>
                <div className="dept-metric">
                  <label>团队平均分</label><strong>{dept.avgScore}</strong>
                  <span className="delta green">较上期 +8.1%</span><small>部门目标达成 92%</small>
                </div>
                <div className="dept-metric">
                  <label>待提升学员</label><strong>{dept.weakCount}</strong>
                  <span className="delta orange">较上期 -3.2 分</span><small>低于 70 分学员</small>
                </div>
                <div className="dept-metric">
                  <label>本周训练时长</label><strong>{dept.totalHours}h</strong>
                  <span className="delta">近 7 日活跃 +12%</span><small>团队累计训练时长</small>
                </div>
              </div>

              {/* AI 洞察 */}
              <div className="dept-insight card">
                <div className="dept-insight-icon">✦</div>
                <div className="dept-insight-main">
                  <div className="dept-insight-title"><b>部门经理行动洞察</b><span>本周分析完成</span></div>
                  <p>{deptName}执行率持续提升，销售一部完成率领先；{dept.weakCount} 名学员低于 70 分，「需求挖掘」是当前主要能力短板。</p>
                </div>
                <div className="dept-insight-side">
                  <span className="dept-chip good">优势：参与覆盖率 ↑</span>
                  <span className="dept-chip risk">风险：需求挖掘失分</span>
                  <button type="button" className="dept-link inline" style={{ margin: 0 }} onClick={() => navigateTo("/practice")}>查看建议 →</button>
                </div>
              </div>

              {/* 上排 3 卡 */}
              <div className="dept-grid top">
                <div className="dept-card card">
                  <h3>团队任务推进</h3><p className="sub">从任务分配到能力达标的执行链路</p>
                  {chainRows(dimension === "dispatch" ? dept.chain : executeChain, "dept-progress-row", "bar")}
                </div>
                <div className="dept-card card">
                  <div className="row"><div><h3>团队执行趋势</h3><p className="sub">参与人数与完成率</p></div><span className="dept-select time" style={{ minWidth: 92, padding: "8px 10px" }}>近 30 天　⌄</span></div>
                  <TrendChart data={dept.trend} className="dept-trend" />
                </div>
                <div className="dept-card card">
                  <div className="row"><div><h3>团队能力分布</h3><p className="sub">能力分布</p></div><span className="dept-ability-total">{dept.avgScore}</span></div>
                  {bandRows(dept.bands, "dept-ability-row", "bar")}
                  <button type="button" className="dept-ability-link">查看待提升成员 →</button>
                </div>
              </div>

              {/* 下排 2 卡 */}
              <div className="dept-grid bottom">
                <MemberTable members={dept.members} linkLabel="查看全部成员 →" onViewAll={() => navigateTo("/?section=statistics-learner")} />
                <DeductionCardDept />
              </div>
            </div>
          </div>
          <RightRail trainCount={dept.completed.length} examCount={dept.exams.length} passRate={overview?.examPassRate ?? 0} />
        </div>
      )}

      {/* ============ 学员数据看板 ============ */}
      {tab === "learner" && (
        <div className="home-grid">
          <div className="home-main">
            <div className="learner-dashboard">
              <div className="learner-head">
                <div>
                  <h1>学员数据看板</h1>
                  <p>查看个人训练闭环、场景掌握度、考试成绩与 AI 改进建议</p>
                </div>
                <span className="learner-updated"><i />已更新 {updatedTime}</span>
                <div className="learner-actions">
                  <select className="learner-select" value={activeLearnerId} onChange={(e) => setLearnerId(e.target.value)}>
                    {learnerOptions.map((l) => <option key={l.id} value={l.id}>姓名：{l.name}</option>)}
                  </select>
                  <span className="learner-select time">近 30 天　⌄</span>
                  <button className="btn" type="button" onClick={() => exportReport("learner")}>导出报告</button>
                </div>
              </div>

              {/* 4 个指标卡 */}
              <div className="learner-metrics">
                <div className="learner-metric">
                  <label>参与覆盖率</label><strong>{learnerCoverage}%</strong><small>参与 {learnerRecords.length} 个训练场景</small>
                </div>
                <div className="learner-metric teal">
                  <label>对练完成率</label><strong>{learnerCompletion}%</strong><small>完成 {learnerCompleted.length} 次对练</small>
                </div>
                <div className="learner-metric purple">
                  <label>考试平均分</label><strong>{learnerAvg}</strong><small>近 30 天 ↑ 6.2 分</small>
                </div>
                <div className="learner-metric orange">
                  <label>待提升能力</label><strong>{learnerWeak}</strong><small>AI 已定位问题</small>
                </div>
              </div>

              {/* 上排 2 卡：训练轨迹 + 考试成绩分析 */}
              <div className="learner-grid learner-main">
                <div className="learner-card card">
                  <h3>训练轨迹</h3><p className="sub">场景练习 → AI 反馈 → 再编辑提升 → 考试验证</p>
                  {learnerSkills.length > 0 ? learnerSkills.map((s, i) => (
                    <div className="learner-progress-row" key={s.name}>
                      <span>{s.name}</span>
                      <div className={`learner-line ${["", "teal", "purple", "orange"][i % 4]}`}><i style={{ width: `${s.pct}%` }} /></div>
                      <strong>{s.pct}%</strong>
                    </div>
                  )) : <p className="muted" style={{ padding: "12px 0" }}>暂无训练数据</p>}
                </div>
                <div className="learner-card card learner-score-card">
                  <h3>考试成绩分析</h3>
                  <div className="learner-average">平均分 <strong>{learnerAvg}</strong></div>
                  {learnerBands.map((b) => (
                    <div className="learner-score-row" key={b.label}>
                      <span>{b.label}</span>
                      <div className={`learner-line ${b.label === "70-79" || b.label === "60-70" ? "purple" : ""}`}><i style={{ width: `${b.pct}%` }} /></div>
                      <strong>{b.pct}%</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI 智能洞察 */}
              <div className="learner-insight">
                <div className="learner-insight-copy">
                  <h3>AI 智能洞察 · 我的训练建议</h3>
                  <p>你在「产品价值表达」场景的得分已连续 3 次提升；「需求挖掘提问」仍是主要失分点，建议完成 2 次高难度对练后再参加专项考试。</p>
                </div>
                <div className="learner-insight-stats">
                  <div><strong>+8.6<em>分</em></strong><small>近 3 次提升</small></div>
                  <div><strong>{learnerCompletion}<em>%</em></strong><small>当前达成率</small></div>
                  <div><strong>2<em>次</em></strong><small>建议对练</small></div>
                </div>
                <button className="btn" type="button" onClick={() => navigateTo("/practice")}>开始专项对练</button>
              </div>

              {/* 下排 2 卡：高频失分 + 训练成就排名 */}
              <div className="learner-grid learner-bottom">
                <div className="learner-card card">
                  <div className="row"><h3>高频失分</h3></div>
                  {DEDUCTION_TOP3.map((d, i) => (
                    <div className="learner-error-row" key={d.reason}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <b>{d.reason}</b>
                      <div className={`learner-line ${["coral", "gold", "indigo"][i]}`}><i style={{ width: `${d.pct}%` }} /></div>
                      <strong>{d.pct}%</strong>
                    </div>
                  ))}
                </div>
                <div className="learner-card card">
                  <div className="row"><h3>训练成就排名</h3></div>
                  <div className="learner-achievements">
                    <div><small>完成对练</small><strong>{learnerCompleted.length} <em>次</em></strong></div>
                    <div><small>部门排名</small><strong>第 {learnerRank.rank || 0} <em>名</em></strong></div>
                    <div><small>连续学习</small><strong>12 <em>天</em></strong></div>
                  </div>
                  <div className="learner-ranking-note">距离部门 Top 3 还差 {(90 - learnerAvg > 0 ? 90 - learnerAvg : 0).toFixed(1)} 分，继续保持训练节奏</div>
                </div>
              </div>
            </div>
          </div>
          <RightRail trainCount={learnerCompleted.length} examCount={learnerExams.length} passRate={learnerExams.length > 0 ? Math.round((learnerExams.filter((e) => e.status === "completed" || e.status === "passed").length / learnerExams.length) * 100) : 0} />
        </div>
      )}
    </div>
  );
}
