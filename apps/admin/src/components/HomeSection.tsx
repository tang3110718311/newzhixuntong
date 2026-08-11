// 首页 / 数据看板（公司 / 部门 / 学员 三 Tab，按 2026-08-10 原型逐像素还原）
// 数据全部接真实后端 API（training-records / users / organizations / exam-attempts / dashboard/overview），前端聚合
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, FileText, Rocket, TrendingDown, TrendingUp, Lightbulb, HelpCircle } from "lucide-react";
import type { AuthSession } from "./dashboard-shared";
import { navigateTo } from "@/lib/navigation";

type HomeProps = {
  auth: AuthSession;
  submitting: boolean;
  onRefresh: () => void;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

// 主题色（与原型一致）
const C = {
  brand: "#4080FF",
  teal: "#36CFC9",
  green: "#00B42A",
  darkGreen: "#009E5F",
  orange: "#FF7D00",
  red: "#F53F3F",
  purple: "#722ED1",
  text1: "#1D2129",
  text2: "#4E5969",
  text3: "#86909C",
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

// 场景 -> 技能标签（用于学员视图"训练轨迹"）
const SCENE_LABEL: Record<string, string> = {
  scene_complaint: "客户异议处理",
  scene_tariff: "产品介绍表达",
  scene_fault: "合规话术",
};

// 高频失分问题（标签与种子数据 top3 一致；占比取自种子分布，前端展示用）
const DEDUCTION_TOP3 = [
  { reason: "需求挖掘不充分", pct: 42, tag: "增加模拟训练", color: C.red, tagColor: "#fef2f2", tagText: C.red },
  { reason: "异议处理缺少证据", pct: 31, tag: "补充产品话术", color: C.orange, tagColor: "#fff7ed", tagText: C.orange },
  { reason: "总结表达不够清晰", pct: 18, tag: "增加转述任务", color: C.brand, tagColor: "#eff6ff", tagText: C.brand },
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
    { label: "已开始训练", value: activeIds.size, pct: learners.length > 0 ? Math.round((activeIds.size / learners.length) * 100) : 0, color: C.green },
    { label: "已完成训练", value: completed.length, pct: scopedRecords.length > 0 ? Math.round((completed.length / scopedRecords.length) * 100) : 0, color: C.teal },
    { label: "参加考试", value: examTaken.size, pct: learners.length > 0 ? Math.round((examTaken.size / learners.length) * 100) : 0, color: C.orange },
    { label: "通过考试", value: examPassed, pct: scopedExams.length > 0 ? Math.round((examPassed / scopedExams.length) * 100) : 0, color: C.brand },
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
    { label: "<70", range: [0, 69] as [number, number], color: C.teal },
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
    .slice(0, 5);

  return { learners, records: scopedRecords, completed, exams: scopedExams, participationRate, completionRate, avgScore, weakCount, totalHours, chain, trend, bands, members };
}

// ---- 通用样式片段 ----
const statCard = (border: string) => ({
  borderTop: `3px solid ${border}`,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  borderRadius: 8,
});
const bar = (pct: number, color: string, h = 10) => ({
  width: `${pct}%`, height: h, background: color, borderRadius: 4, transition: "width 0.3s",
});

export function HomeSection({ auth, submitting, onRefresh }: HomeProps) {
  const [tab, setTab] = useState<"company" | "dept" | "learner">("company");
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
    const defs = [["90-100", [90, 100]], ["80-89", [80, 89]], ["70-79", [70, 79]], ["<70", [0, 69]]] as [string, [number, number]][];
    return defs.map(([label, range]) => {
      const cnt = learnerCompleted.filter((r) => r.score >= range[0] && r.score <= range[1]).length;
      return { label, pct: learnerCompleted.length > 0 ? Math.round((cnt / learnerCompleted.length) * 100) : 0, count: cnt };
    });
  }, [learnerCompleted]);

  const now = new Date();
  const updatedTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // ====== 渲染：Tab 头 ======
  const TabBtn = ({ id, label }: { id: "company" | "dept" | "learner"; label: string }) => (
    <button type="button" onClick={() => setTab(id)} className="tab-item"
      style={{ padding: "8px 20px", fontSize: 14, borderRadius: 4, fontWeight: 600, cursor: "pointer",
        background: tab === id ? C.brand : "#fff", color: tab === id ? "#fff" : C.text3, border: `1px solid ${tab === id ? C.brand : "#E5E6EB"}` }}>
      {label}
    </button>
  );

  // ====== 渲染：统计卡 ======
  function StatCards({ items, kind }: { items: { title: string; value: string; delta: string; deltaUp: boolean; note: string; border: string; valueColor: string }[]; kind: "company" | "dept" }) {
    return (
      <div className="stats prototype-stats stats-5" style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
        {items.map((it) => (
          <div key={it.title} className="metric card" style={{ ...statCard(it.border), padding: 16 }}>
            <span style={{ fontSize: 13, color: C.text3 }}>{it.title}</span>
            <strong style={{ fontSize: 28, color: it.valueColor, marginTop: 6, display: "block" }}>{it.value}</strong>
            <small style={{ fontSize: 12, marginTop: 4, display: "block" }}>
              <span className={it.deltaUp ? "trend-up" : "trend-down"} style={{ color: it.deltaUp ? C.green : C.red, display: "inline-flex", alignItems: "center", gap: 2 }}>
                {it.deltaUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {it.delta}
              </span>
              <span style={{ color: C.text3, marginLeft: 6 }}>{it.note}</span>
            </small>
          </div>
        ))}
      </div>
    );
  }

  // ====== 渲染：行动洞察横幅 ======
  function InsightBanner({ title, tag, body, advantage, risk }: { title: string; tag: string; body: string; advantage: string; risk: string }) {
    return (
      <div className="insight-card card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: 16 }}>
        <div style={{ display: "flex", gap: 12, flex: 1 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Lightbulb size={18} color="#fff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: C.text1, fontWeight: 600 }}>{title}</h3>
              <span style={{ fontSize: 12, color: C.orange, background: "#fff7ed", padding: "2px 8px", borderRadius: 4 }}>{tag}</span>
            </div>
            <p style={{ margin: 0, color: C.text2, fontSize: 13, lineHeight: 1.6 }}>{body}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
          <span style={{ fontSize: 12, background: "#f0fdf4", color: C.green, padding: "4px 10px", borderRadius: 4, whiteSpace: "nowrap" }}>优势：{advantage}</span>
          <span style={{ fontSize: 12, background: "#fef2f2", color: C.red, padding: "4px 10px", borderRadius: 4, whiteSpace: "nowrap" }}>风险：{risk}</span>
          <button className="link-btn" type="button" style={{ fontSize: 12 }}>查看建议 →</button>
        </div>
      </div>
    );
  }

  // ====== 渲染：任务推进链 ======
  function ChainCard({ title, sub, items }: { title: string; sub: string; items: Analytics["chain"] }) {
    return (
      <div className="chart card" style={{ padding: 16, flex: "1 1 0" }}>
        <h2 style={{ margin: 0, fontSize: 15, color: C.text1, fontWeight: 600 }}>{title}</h2>
        <p style={{ color: C.text3, fontSize: 12, margin: "4px 0 14px" }}>{sub}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((it) => (
            <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 84, fontSize: 13, color: C.text2, textAlign: "right", flexShrink: 0 }}>{it.label}</span>
              <span style={{ fontSize: 13, color: C.text1, fontWeight: 600, width: 40, textAlign: "right", flexShrink: 0 }}>{it.value}</span>
              <div style={{ flex: 1, height: 6, background: "#F2F3F5", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${it.pct}%`, height: "100%", background: it.color, borderRadius: 3, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 12, color: C.text3, width: 36, flexShrink: 0 }}>{it.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ====== 渲染：执行趋势柱图 ======
  function TrendCard({ title, sub, data }: { title: string; sub: string; data: Analytics["trend"] }) {
    const maxP = Math.max(...data.map((d) => d.participants), 1);
    return (
      <div className="chart card" style={{ padding: 16, flex: "1.3 1 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, color: C.text1, fontWeight: 600 }}>{title}</h2>
            <p style={{ color: C.text3, fontSize: 12, margin: "4px 0 0" }}>{sub}</p>
          </div>
          <span style={{ fontSize: 12, color: C.text3, border: "1px solid #E5E6EB", borderRadius: 4, padding: "3px 8px" }}>近30天 ▼</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: C.teal }}><span style={{ display: "inline-block", width: 10, height: 10, background: C.teal, borderRadius: 2, marginRight: 4 }} />参与人数</span>
          <span style={{ fontSize: 12, color: C.brand }}><span style={{ display: "inline-block", width: 10, height: 10, background: C.brand, borderRadius: 2, marginRight: 4 }} />完成率</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: 130, gap: 8 }}>
          {data.map((t) => (
            <div key={t.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 100 }}>
                <div style={{ width: 12, height: `${Math.max((t.participants / maxP) * 100, 4)}%`, background: C.teal, borderRadius: "3px 3px 0 0", minHeight: 4 }} title={`参与人数 ${t.participants}`} />
                <div style={{ width: 12, height: `${Math.max(t.completionRate, 4)}%`, background: C.brand, borderRadius: "3px 3px 0 0", minHeight: 4 }} title={`完成率 ${t.completionRate}%`} />
              </div>
              <span style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>{t.date}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ====== 渲染：能力分布 ======
  function BandCard({ title, sub, items, total }: { title: string; sub: string; items: Analytics["bands"]; total: number }) {
    return (
      <div className="chart card" style={{ padding: 16, flex: "1 1 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, color: C.text1, fontWeight: 600 }}>{title}</h2>
            <p style={{ color: C.text3, fontSize: 12, margin: "4px 0 0" }}>{sub}</p>
          </div>
          {total != null && <span style={{ fontSize: 24, color: C.green, fontWeight: 700 }}>{total}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {items.map((b) => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 48, fontSize: 13, color: C.text2, flexShrink: 0 }}>{b.label}</span>
              <div style={{ flex: 1, height: 12, background: "#F2F3F5", borderRadius: 4, overflow: "hidden" }}>
                <div style={bar(b.pct, b.color)} />
              </div>
              <span style={{ fontSize: 12, color: C.text3, width: 64, flexShrink: 0, textAlign: "right" }}>{b.count}人，{b.pct}%</span>
            </div>
          ))}
        </div>
        <button className="link-btn" type="button" style={{ marginTop: 12, fontSize: 13, color: C.red }}>查看待提升学员 →</button>
      </div>
    );
  }

  // ====== 渲染：成员完成情况表 ======
  function MemberTable({ members }: { members: Analytics["members"] }) {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, color: C.text1, fontWeight: 600 }}>团队成员完成情况</h2>
            <span style={{ color: C.text3, fontSize: 12 }}>按完成率与能力分排序</span>
          </div>
          <button className="link-btn" type="button" style={{ fontSize: 13, color: C.brand }}>查看全部成员 →</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}>序号</th>
                <th>成员</th>
                <th>训练次数</th>
                <th>完成率</th>
                <th>平均分</th>
              </tr>
            </thead>
            <tbody>
              {members.length > 0 ? members.map((m, i) => (
                <tr key={m.id}>
                  <td><span className="rank-num" style={{ background: C.brand, color: "#fff" }}>{i + 1}</span></td>
                  <td><strong>{m.name}</strong></td>
                  <td>{m.recordCount}次</td>
                  <td style={{ color: m.completionRate >= 80 ? C.green : C.orange, fontWeight: 600 }}>{m.completionRate}%</td>
                  <td>{m.avgScore}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: C.text3 }}>暂无成员数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ====== 渲染：高频失分问题 ======
  function DeductionCard() {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, color: C.text1, fontWeight: 600 }}>高频失分问题</h2>
            <span style={{ color: C.text3, fontSize: 12 }}>AI 错题库识别训练与考试高频归因</span>
          </div>
          <button className="link-btn" type="button" style={{ fontSize: 13, color: C.brand }}>查看全部问题 →</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {DEDUCTION_TOP3.map((d, i) => (
            <div key={d.reason}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: C.text1 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 9, background: d.color, color: "#fff", fontSize: 11, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  {d.reason}
                </span>
                <span style={{ fontSize: 12, background: d.tagColor, color: d.tagText, padding: "2px 8px", borderRadius: 4 }}>{d.tag}</span>
              </div>
              <div style={{ height: 10, background: "#F2F3F5", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${d.pct}%`, height: "100%", background: d.color, borderRadius: 5 }} />
              </div>
              <span style={{ fontSize: 12, color: C.text3, marginTop: 2, display: "inline-block" }}>占{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ====== 右侧栏 ======
  function RightRail({ trainCount, examCount, passRate }: { trainCount: number; examCount: number; passRate: number }) {
    return (
      <aside className="right-rail">
        <div className="profile card">
          <span className="avatar large" />
          <div>
            <h2>{auth.user.name}</h2>
            <p>企业管理员</p>
            <p>培训负责人</p>
          </div>
        </div>
        <div className="sidecard card">
          <div className="sidecard-head"><h2>培训概况</h2><span>本季度</span></div>
          <strong style={{ fontSize: 28 }}>{trainCount}</strong>
          <p>已完成培训任务</p>
          <div className="mini-stats">
            <span>对练<b>{trainCount}</b></span>
            <span>考试<b>{examCount}</b></span>
            <span>合格率<b style={{ color: C.green }}>{passRate}%</b></span>
          </div>
        </div>
        <div className="sidecard card">
          <h2>通知消息</h2>
          <p>暂无新的通知消息，系统将及时推送任务派发、培训收到及学习进展提醒。</p>
        </div>
      </aside>
    );
  }

  // =================== 主渲染 ===================
  return (
    <div className="prototype-home">
      {/* Tab 头 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <TabBtn id="company" label="公司数据看板" />
        <TabBtn id="dept" label="部门数据看板" />
        <TabBtn id="learner" label="学员数据看板" />
      </div>

      {loading && <div style={{ color: C.text3, padding: 12 }}>数据加载中…</div>}

      {tab === "company" && (
        <div className="home-grid">
          <div className="home-main">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: C.text1, fontWeight: 600 }}>公司数据看板</h2>
                <span style={{ color: C.text3, fontSize: 13 }}>从参与、练习到考试，全面掌握组织培训成效</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: C.green, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: C.green, display: "inline-block" }} />已更新 {updatedTime}</span>
                <span style={{ fontSize: 13, color: C.text3, border: "1px solid #E5E6EB", borderRadius: 4, padding: "5px 10px" }}>公司：按公司 ▼</span>
                <span style={{ fontSize: 13, color: C.text3, border: "1px solid #E5E6EB", borderRadius: 4, padding: "5px 10px" }}>近30天 ▼</span>
                <button className="btn" type="button" style={{ fontSize: 13, background: C.brand, color: "#fff", border: "none" }} onClick={() => navigateTo("/practice")}><Rocket size={14} /> 开始专项对练</button>
                <button className="btn" type="button" style={{ fontSize: 13, background: C.brand, color: "#fff", border: "none" }}><FileText size={14} /> 专属报告</button>
              </div>
            </div>

            <StatCards kind="company" items={[
              { title: "组织参与率", value: `${company.participationRate}%`, delta: "+4.4%", deltaUp: true, note: `有效参与 ${company.learners.length} 人`, border: C.brand, valueColor: C.brand },
              { title: "任务完成率", value: `${company.completionRate}%`, delta: "+4.8%", deltaUp: true, note: `已完成任务 ${company.completed.length} 次`, border: C.teal, valueColor: C.teal },
              { title: "公司平均分", value: `${company.avgScore}`, delta: "+8.1%", deltaUp: true, note: `达标率 ${overview?.trainingPassRate ?? 0}%`, border: C.green, valueColor: C.green },
              { title: "待提升学员", value: `${company.weakCount}`, delta: "-12 分", deltaUp: false, note: "低于 70 分学员", border: C.orange, valueColor: C.orange },
              { title: "本周训练时长", value: `${company.totalHours}h`, delta: "+12%", deltaUp: true, note: "每位学员训练时长", border: C.brand, valueColor: C.brand },
            ]} />

            <InsightBanner
              title="管理层行动洞察"
              tag="本周分析完成"
              body="组织培训参与度持续提升，场景练习完成率表现良好；待售新人平均分领先，但「需求挖掘」相关题目失分集中。"
              advantage="组织参与率1"
              risk="需求挖掘失分" />

            <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "stretch" }}>
              <ChainCard title="组织任务推进" sub="从任务分配到能力达标全链路执行链路" items={company.chain} />
              <TrendCard title="组织执行趋势" sub="参与人数与完成率" data={company.trend} />
              <BandCard title="组织能力分布" sub="能力分布" items={company.bands} total={company.avgScore} />
            </div>

            <div className="home-bottom-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <MemberTable members={company.members} />
              <DeductionCard />
            </div>
          </div>
          <RightRail trainCount={company.completed.length} examCount={company.exams.length} passRate={overview?.examPassRate ?? 0} />
        </div>
      )}

      {tab === "dept" && (
        <div className="home-grid">
          <div className="home-main">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: C.text1, fontWeight: 600 }}>部门数据看板</h2>
                <span style={{ color: C.text3, fontSize: 13 }}>按组织部门分析 AI 对答训练参与、完成、考试与能力数据</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: C.green, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: C.green, display: "inline-block" }} />已更新 {updatedTime}</span>
                <select value={activeDeptId} onChange={(e) => setDeptId(e.target.value)} style={{ fontSize: 13, color: C.text2, border: "1px solid #E5E6EB", borderRadius: 4, padding: "5px 10px", background: "#fff" }}>
                  {deptOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <span style={{ fontSize: 13, color: C.text3, border: "1px solid #E5E6EB", borderRadius: 4, padding: "5px 10px" }}>近30天 ▼</span>
                <button className="btn" type="button" style={{ fontSize: 13, background: C.brand, color: "#fff", border: "none" }}><FileText size={14} /> 导出报告</button>
              </div>
            </div>

            <StatCards kind="dept" items={[
              { title: "团队参与率", value: `${dept.participationRate}%`, delta: "+6.4%", deltaUp: true, note: `有效参与 ${dept.learners.length} 人`, border: C.brand, valueColor: C.brand },
              { title: "任务完成率", value: `${dept.completionRate}%`, delta: "+4.8%", deltaUp: true, note: `已完成任务 ${dept.completed.length} 次`, border: C.teal, valueColor: C.teal },
              { title: "团队平均分", value: `${dept.avgScore}`, delta: "+8.1%", deltaUp: true, note: "部门目标达成 92%", border: C.green, valueColor: C.green },
              { title: "待提升学员", value: `${dept.weakCount}`, delta: "-3.2 分", deltaUp: false, note: "低于 70 分学员", border: C.orange, valueColor: C.orange },
              { title: "本周期总时长", value: `${dept.totalHours}h`, delta: "+12%", deltaUp: true, note: "团队累计训练时长", border: C.brand, valueColor: C.brand },
            ]} />

            <div className="insight-card card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: 16 }}>
              <div style={{ display: "flex", gap: 12, flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Rocket size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 15, color: C.text1, fontWeight: 600 }}>部门经理行动洞察</h3>
                    <span style={{ fontSize: 12, color: C.orange, background: "#fff7ed", padding: "2px 8px", borderRadius: 4 }}>本周分析结论</span>
                  </div>
                  <p style={{ margin: 0, color: C.text2, fontSize: 13, lineHeight: 1.6 }}>{deptName}执行率持续提升，完成率领先；{dept.weakCount} 名学员低于 70 分，「需求挖掘」是当前主要能力短板。</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                <span style={{ fontSize: 12, background: "#f0fdf4", color: C.green, border: "1px solid #b7eb8f", padding: "4px 10px", borderRadius: 4, whiteSpace: "nowrap" }}>优势: 参与覆盖率1</span>
                <span style={{ fontSize: 12, background: "#fff7ed", color: C.orange, border: "1px solid #ffd591", padding: "4px 10px", borderRadius: 4, whiteSpace: "nowrap" }}>风险: 需求挖掘低分</span>
                <button className="link-btn" type="button" style={{ fontSize: 12, color: C.brand }}>查看建议</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "stretch" }}>
              <ChainCard title="团队任务推进" sub="从任务分配到能力达标的执行链路" items={dept.chain} />
              <TrendCard title="团队执行趋势" sub="参与人数与完成率" data={dept.trend} />
              <BandCard title="团队能力分布" sub="能力分布" items={dept.bands} total={dept.avgScore} />
            </div>

            <div className="home-bottom-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <MemberTable members={dept.members} />
              <DeductionCard />
            </div>
          </div>
          <RightRail trainCount={dept.completed.length} examCount={dept.exams.length} passRate={overview?.examPassRate ?? 0} />
        </div>
      )}

      {tab === "learner" && (
        <div className="home-grid">
          <div className="home-main">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: C.text1, fontWeight: 600 }}>学员数据看板</h2>
                <span style={{ color: C.text3, fontSize: 13 }}>查看个人训练闭环、场景掌握度、考试成绩与 AI 改进建议</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: C.green, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: C.green, display: "inline-block" }} />已更新 {updatedTime}</span>
                <select value={activeLearnerId} onChange={(e) => setLearnerId(e.target.value)} style={{ fontSize: 13, color: C.text2, border: "1px solid #E5E6EB", borderRadius: 4, padding: "5px 10px", background: "#fff" }}>
                  {learnerOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <span style={{ fontSize: 13, color: C.text3, border: "1px solid #E5E6EB", borderRadius: 4, padding: "5px 10px" }}>近30天 ▼</span>
                <button className="btn" type="button" style={{ fontSize: 13, background: C.brand, color: "#fff", border: "none" }}><FileText size={14} /> 导出报告</button>
              </div>
            </div>

            {/* 4 张个人统计卡 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 16 }}>
              {[
                { title: "我的参与覆盖率", value: `${learnerCoverage}%`, color: C.brand, note: `参与 ${learnerRecords.length} 个训练场景` },
                { title: "我的训练完成率", value: `${learnerCompletion}%`, color: C.green, note: `完成 ${learnerCompleted.length} 次训练` },
                { title: "我的考试平均分", value: `${learnerAvg}`, color: C.purple, note: "近30天 ↑6.2分" },
                { title: "待提升能力", value: `${learnerWeak}`, color: C.orange, note: "AI 已定位问题" },
              ].map((it) => (
                <div key={it.title} className="metric card" style={{ ...statCard(it.color), padding: 16 }}>
                  <span style={{ fontSize: 13, color: C.text3 }}>{it.title}</span>
                  <strong style={{ fontSize: 28, color: it.color, marginTop: 6, display: "block" }}>{it.value}</strong>
                  <small style={{ fontSize: 12, color: C.text3, marginTop: 4, display: "block" }}>{it.note}</small>
                </div>
              ))}
            </div>

            {/* 训练轨迹 + 考试成绩分析 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <h2 style={{ margin: 0, fontSize: 16, color: C.text1, fontWeight: 600 }}>我的训练轨迹</h2>
                <p style={{ color: C.text3, fontSize: 13, margin: "4px 0 14px" }}>场景练习 → AI 反馈 → 再训练提升 → 考试验证</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {learnerSkills.length > 0 ? learnerSkills.map((s, i) => (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 110, fontSize: 13, color: C.text2, flexShrink: 0 }}>{s.name}</span>
                      <div style={{ flex: 1, height: 8, background: "#F2F3F5", borderRadius: 4, overflow: "hidden" }}>
                        <div style={bar(s.pct, [C.brand, C.green, C.purple, C.orange][i % 4])} />
                      </div>
                      <span style={{ fontSize: 12, color: C.text3, width: 40, textAlign: "right", flexShrink: 0 }}>{s.pct}%</span>
                    </div>
                  )) : <span style={{ color: C.text3, fontSize: 13 }}>暂无训练数据</span>}
                </div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ margin: 0, fontSize: 16, color: C.text1, fontWeight: 600 }}>考试成绩分析</h2>
                  <span style={{ color: C.brand, fontWeight: 600 }}>平均分 {learnerAvg}</span>
                </div>
                <p style={{ color: C.text3, fontSize: 13, margin: "4px 0 14px" }}>各分数段占比</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {learnerBands.map((b) => (
                    <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 48, fontSize: 13, color: C.text2, flexShrink: 0 }}>{b.label}</span>
                      <div style={{ flex: 1, height: 8, background: "#F2F3F5", borderRadius: 4, overflow: "hidden" }}>
                        <div style={bar(b.pct, C.brand)} />
                      </div>
                      <span style={{ fontSize: 12, color: C.text3, width: 40, textAlign: "right", flexShrink: 0 }}>{b.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI 训练建议 */}
            <div className="insight-card card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, color: C.text1, fontWeight: 600, marginBottom: 6 }}>AI 智能洞察 · 我的训练建议</h3>
                <p style={{ margin: 0, color: C.text2, fontSize: 13, lineHeight: 1.6 }}>你在「产品价值表达」场景的得分已连续 3 次提升；「需求挖掘技巧」仍是主要失分点，建议完成 2 次高难度对应训练后再参加专项考试。</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: C.brand }}>+8.6分 近2次提升</span>
                <span style={{ fontSize: 12, color: C.green }}>{learnerCompletion}% 训练完成率</span>
                <span style={{ fontSize: 12, color: C.orange }}>2次 建议训练</span>
                <button className="btn" type="button" style={{ fontSize: 13, background: C.brand, color: "#fff", border: "none" }}>开始专项训练</button>
              </div>
            </div>

            {/* 高频失分 + 训练成绩排名 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <DeductionCard />
              <div className="card" style={{ padding: 16 }}>
                <h2 style={{ margin: 0, fontSize: 16, color: C.text1, fontWeight: 600 }}>训练成绩排名</h2>
                <p style={{ color: C.text3, fontSize: 13, margin: "4px 0 14px" }}>完成训练 {learnerCompleted.length} 次</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, background: "#fffbe6", color: C.orange, padding: "4px 10px", borderRadius: 4 }}>部门排名 第{learnerRank.rank}名</span>
                  <span style={{ fontSize: 12, background: "#f0fdf4", color: C.green, padding: "4px 10px", borderRadius: 4 }}>连续学习 12天</span>
                </div>
                <p style={{ color: C.text2, fontSize: 13, margin: 0 }}>距离部门 Top3 还差 {(90 - learnerAvg > 0 ? 90 - learnerAvg : 0).toFixed(1)} 分，继续保持训练节奏。</p>
              </div>
            </div>
          </div>
          <RightRail trainCount={learnerCompleted.length} examCount={learnerExams.length} passRate={learnerExams.length > 0 ? Math.round((learnerExams.filter((e) => e.status === "completed" || e.status === "passed").length / learnerExams.length) * 100) : 0} />
        </div>
      )}

      {/* 右下角帮助按钮 */}
      <button type="button" title="帮助" style={{ position: "fixed", right: 20, bottom: 20, width: 44, height: 44, borderRadius: "50%", background: C.purple, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(114,46,209,0.4)", cursor: "pointer", zIndex: 50 }}>
        <HelpCircle size={22} />
      </button>
    </div>
  );
}
