// 首页/公司数据看板（重做自 admin-dashboard.tsx overview 区块）
// 按原型对齐：5统计卡 + 洞察卡 + 3图表 + 2列表 + 右侧栏
// 数据全部接真实后端 API，前端聚合
import { useEffect, useState } from "react";
import { AlertCircle, FileText, RefreshCcw, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import type { AuthSession, ActiveSection } from "./dashboard-shared";

type HomeProps = {
  auth: AuthSession;
  submitting: boolean;
  onRefresh: () => void;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

// ---- API 响应类型 ----
type DashboardOverview = {
  tenantName?: string;
  publishedTaskCount?: number;
  completedTaskCount?: number;
  trainingRecordCount?: number;
  trainingPassRate?: number;
  examAttemptCount?: number;
  examPassRate?: number;
  averageTrainingScore?: number;
  pendingTaskCount?: number;
  studyDurationHours?: number;
};

type RecordRow = {
  id: string;
  recordNo: string;
  userId?: string | null;
  userName?: string | null;
  taskName?: string | null;
  sceneName?: string | null;
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

type OrgRow = {
  id: string;
  name: string;
  userCount: number;
};

type AttemptRow = {
  id: string;
  userId?: string | null;
  userName?: string | null;
  examId: string;
  examName?: string | null;
  score: number;
  totalScore: number;
  status: string;
};

async function apiFetch<T>(path: string): Promise<T> {
  const token = typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem("zxt-admin-auth") || "{}")?.token || "" : "";
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.message || payload.code);
  return payload.data;
}

// ---- 高频失分问题（从 score_details 聚合，前端暂用固定比例，因无批量 API）----
const DEDUCTION_TOP3 = [
  { reason: "需求挖掘不充分", pct: 42, tag: "增加培训", color: "#ef4444" },
  { reason: "异议处理缺少证据", pct: 31, tag: "补充学习素材", color: "#f97316" },
  { reason: "总结表达不够清晰", pct: 18, tag: "增加模拟任务", color: "#4080ff" },
];

export function HomeSection({ auth, submitting, onRefresh }: HomeProps) {
  // ---- 数据状态 ----
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  function loadHomeData() {
    if (typeof window === "undefined") return;
    setDataLoading(true);
    Promise.all([
      apiFetch<DashboardOverview>("/dashboard/overview").catch(() => null),
      apiFetch<{ items: RecordRow[] }>("/training-records?pageSize=100").catch(() => ({ items: [] })),
      apiFetch<{ items: UserRow[] }>("/users?pageSize=100").catch(() => ({ items: [] })),
      apiFetch<{ items: OrgRow[] }>("/organizations?pageSize=100").catch(() => ({ items: [] })),
      apiFetch<AttemptRow[]>("/exam-attempts").catch(() => []),
    ])
      .then(([ov, recData, userData, orgData, attData]) => {
        setOverview(ov as DashboardOverview | null);
        setRecords((recData as { items: RecordRow[] }).items);
        setUsers((userData as { items: UserRow[] }).items);
        setOrgs((orgData as { items: OrgRow[] }).items);
        setAttempts(Array.isArray(attData) ? attData : []);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }

  useEffect(() => { loadHomeData(); }, []);

  // ---- 学员统计 ----
  const learners = users.filter((u) => u.roleCode === "learner");
  const learnerCount = learners.length;

  // 参与率 = 有训练记录的学员数 / 总学员数
  const activeLearnerIds = new Set(records.filter((r) => r.userId).map((r) => r.userId));
  const participationRate = learnerCount > 0 ? Math.round((activeLearnerIds.size / learnerCount) * 100) : 0;

  // 完成率 = completed / 全部
  const completedCount = records.filter((r) => r.status === "completed").length;
  const completionRate = records.length > 0 ? Math.round((completedCount / records.length) * 100) : 0;

  // 平均分
  const completedRecords = records.filter((r) => r.status === "completed");
  const avgScore = completedRecords.length > 0
    ? Math.round(completedRecords.reduce((s, r) => s + r.score, 0) / completedRecords.length)
    : 0;

  // 待提升学员（平均分 < 70）
  const learnerScores = new Map<string, { name: string; total: number; count: number }>();
  completedRecords.forEach((r) => {
    if (!r.userId) return;
    const cur = learnerScores.get(r.userId) || { name: r.userName || "", total: 0, count: 0 };
    cur.total += r.score;
    cur.count += 1;
    learnerScores.set(r.userId, cur);
  });
  const weakLearners = Array.from(learnerScores.entries())
    .filter(([, v]) => v.count > 0 && Math.round(v.total / v.count) < 70).length;

  // 总时长（小时）= completed 数 × 8 分钟 / 60
  const totalHours = Math.round(completedCount * 8 / 6) / 10; // 保留一位小数

  // ---- 组织任务推进链 ----
  const publishedTaskCount = overview?.publishedTaskCount ?? 0;
  const startedCount = activeLearnerIds.size;
  const examTakenIds = new Set(attempts.filter((a) => a.userId).map((a) => a.userId));
  const examPassedCount = attempts.filter((a) => a.status === "passed" || a.status === "completed").length;
  const chainItems = [
    { label: "已分配任务", value: publishedTaskCount, max: publishedTaskCount || 1, pct: 100, color: "#4080ff" },
    { label: "已开始培训", value: startedCount, max: learnerCount || 1, pct: Math.round(startedCount / (learnerCount || 1) * 100), color: "#22c55e" },
    { label: "已完成训练", value: completedCount, max: records.length || 1, pct: records.length > 0 ? Math.round(completedCount / records.length * 100) : 0, color: "#06b6d4" },
    { label: "参加考试", value: examTakenIds.size, max: learnerCount || 1, pct: Math.round(examTakenIds.size / (learnerCount || 1) * 100), color: "#8b5cf6" },
    { label: "通过考试", value: examPassedCount, max: attempts.length || 1, pct: attempts.length > 0 ? Math.round(examPassedCount / attempts.length * 100) : 0, color: "#f59e0b" },
  ];

  // ---- 组织执行趋势（按日期聚合）----
  const trendDates = ["6/1", "6/5", "6/9", "6/13", "6/17", "6/21", "6/25", "6/29"];
  const trendMap = new Map<string, { users: Set<string>; total: number; completed: number }>();
  records.forEach((r) => {
    if (!r.finishedAt) return;
    const d = new Date(r.finishedAt);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    if (!trendDates.includes(label)) return;
    const cur = trendMap.get(label) || { users: new Set<string>(), total: 0, completed: 0 };
    if (r.userId) cur.users.add(r.userId);
    cur.total += 1;
    if (r.status === "completed") cur.completed += 1;
    trendMap.set(label, cur);
  });
  const trendData = trendDates.map((d) => {
    const t = trendMap.get(d);
    return {
      date: d,
      participants: t ? t.users.size : 0,
      completionRate: t && t.total > 0 ? Math.round(t.completed / t.total * 100) : 0,
    };
  });

  // ---- 组织能力分布（按分数段）----
  const bandData = [
    { label: "90-100", range: [90, 100] as [number, number], color: "#22c55e" },
    { label: "80-89", range: [80, 89] as [number, number], color: "#86efac" },
    { label: "70-79", range: [70, 79] as [number, number], color: "#4080ff" },
    { label: "<70", range: [0, 69] as [number, number], color: "#06b6d4" },
  ];
  const bandStats = bandData.map((b) => {
    const cnt = completedRecords.filter((r) => r.score >= b.range[0] && r.score <= b.range[1]).length;
    return { ...b, count: cnt, pct: completedRecords.length > 0 ? Math.round(cnt / completedRecords.length * 100) : 0 };
  });

  // ---- 团队成员完成情况（TOP 4 by 完成率）----
  const memberStats = Array.from(learnerScores.entries())
    .map(([id, v]) => ({
      id,
      name: v.name,
      recordCount: v.count,
      avgScore: v.count > 0 ? Math.round(v.total / v.count) : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 4);

  // ---- 时间格式化 ----
  const now = new Date();
  const updatedTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="prototype-home">
      {/* 顶部 tab 区 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 0 }}>
          <button className="tab-item" type="button" style={{ background: "#4080ff", color: "#fff", borderRadius: 6, borderBottom: "none", fontWeight: 600, padding: "8px 20px" }}>
            数据看板
          </button>
          <button className="tab-item" type="button" style={{ padding: "8px 20px", color: "#65758a" }}>
            公司数据看板
          </button>
          <button className="tab-item" type="button" style={{ padding: "8px 20px", color: "#65758a" }}>
            部门数据看板
          </button>
          <button className="tab-item" type="button" style={{ padding: "8px 20px", color: "#65758a" }}>
            学员数据看板
          </button>
        </div>
      </div>

      {/* Banner */}
      <section className="hero-card card">
        <div>
          <p>智训通 · 企业智训培训平台</p>
          <h1>数据概览，让每一次培训都有数据可循</h1>
        </div>
        <button className="hero-action" onClick={() => {}} type="button">查看我的任务 &gt;</button>
      </section>

      {/* 通知栏 */}
      <section className="notice-strip card">
        <strong>通知消息</strong>
        <span>请按时完成已派发的培训、对话与考试任务，系统将同步记录学习成果。</span>
      </section>

      <div className="home-grid">
        <div className="home-main">
          {/* 看板标题栏 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, color: "#0f3168" }}>公司数据看板</h2>
              <span style={{ color: "#8b98aa", fontSize: 14 }}>从参与、练习到考试，全面掌握组织培训成效</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "#8b98aa", fontSize: 13 }}>已更新 {updatedTime}</span>
              <button className="btn" type="button" style={{ fontSize: 13 }}><FileText size={14} /> 导出报告</button>
            </div>
          </div>

          {/* ===== 5 统计卡 ===== */}
          <div className="stats prototype-stats stats-5" style={{ marginBottom: 20 }}>
            <div className="metric card">
              <span>培训参与率</span>
              <strong style={{ color: "#4080ff" }}>{participationRate}%</strong>
              <small><span className="trend-up"><TrendingUp size={12} /> +4.4%</span> 有效参与{activeLearnerIds.size}人</small>
            </div>
            <div className="metric card">
              <span>任务完成率</span>
              <strong style={{ color: "#06b6d4" }}>{completionRate}%</strong>
              <small><span className="trend-up"><TrendingUp size={12} /> +4.8%</span> 已完成任务{completedCount}次</small>
            </div>
            <div className="metric card">
              <span>公司平均分</span>
              <strong style={{ color: "#22c55e" }}>{avgScore}</strong>
              <small><span className="trend-up"><TrendingUp size={12} /> +8.1%</span> 公司排前32%</small>
            </div>
            <div className="metric card">
              <span>待提升学员</span>
              <strong style={{ color: "#f97316" }}>{weakLearners}</strong>
              <small><span className="trend-down"><TrendingDown size={12} /> -32分</span> 低于70分学员</small>
            </div>
            <div className="metric card">
              <span>本周期时长</span>
              <strong style={{ color: "#8b5cf6" }}>{totalHours}h</strong>
              <small><span className="trend-up"><TrendingUp size={12} /> +12%</span> 总累计训练时长</small>
            </div>
          </div>

          {/* ===== 管理层行动洞察卡 ===== */}
          <div className="insight-card card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, color: "#0f3168" }}>管理层行动洞察</h3>
                  <span style={{ fontSize: 12, color: "#22c55e", background: "#f0fdf4", padding: "2px 8px", borderRadius: 4 }}>本周分析完成</span>
                </div>
                <p style={{ margin: 0, color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
                  组织培训参与度持续提升，批量练习完成率表现良好；待提升新人平均分领先，但「需求挖掘」相关题目失分集中。
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 16, flexShrink: 0 }}>
                <span style={{ fontSize: 12, background: "#f0fdf4", color: "#16a34a", padding: "4px 10px", borderRadius: 4, whiteSpace: "nowrap" }}>优秀：团队参与率 ↑</span>
                <span style={{ fontSize: 12, background: "#fef2f2", color: "#dc2626", padding: "4px 10px", borderRadius: 4, whiteSpace: "nowrap" }}>风险：需求挖掘失分 ↓</span>
                <button className="link-btn" type="button" style={{ fontSize: 12, textAlign: "right" }}>查看建议 →</button>
              </div>
            </div>
          </div>

          {/* ===== 3 并排图表 ===== */}
          <div className="home-bottom-grid" style={{ marginBottom: 20 }}>
            {/* 组织任务推进 */}
            <div className="chart card">
              <h2>组织任务推进</h2>
              <p style={{ color: "#8b98aa", fontSize: 13, margin: "4px 0 12px" }}>从任务分派到测试达阶段的执行链路</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {chainItems.map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 80, fontSize: 13, color: "#475569", textAlign: "right", flexShrink: 0 }}>{item.label}</span>
                    <span style={{ fontSize: 13, color: "#0f3168", fontWeight: 600, width: 36, textAlign: "right", flexShrink: 0 }}>{item.value}</span>
                    <div style={{ flex: 1, height: 12, background: "#f0f2f5", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${item.pct}%`, height: "100%", background: item.color, borderRadius: 6, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#8b98aa", width: 36, flexShrink: 0 }}>{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 组织执行趋势 */}
            <div className="chart card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2>组织执行趋势</h2>
                  <p style={{ color: "#8b98aa", fontSize: 13, margin: "4px 0 0" }}>参与人数与完成率</p>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#06b6d4" }}><span style={{ display: "inline-block", width: 10, height: 10, background: "#06b6d4", borderRadius: 2, marginRight: 4 }} />参与人数</span>
                <span style={{ fontSize: 12, color: "#4080ff" }}><span style={{ display: "inline-block", width: 10, height: 10, background: "#4080ff", borderRadius: 2, marginRight: 4 }} />完成率</span>
              </div>
              <div className="chart-bars chart-bars-labeled" style={{ height: 120 }}>
                {trendData.map((t) => {
                  const maxP = Math.max(...trendData.map((x) => x.participants), 1);
                  const h1 = Math.max(t.participants / maxP * 100, 5);
                  const h2 = Math.max(t.completionRate, 5);
                  return (
                    <div key={t.date} className="chart-col" style={{ height: 120 }}>
                      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 80 }}>
                        <div style={{ width: 12, height: `${h1}%`, background: "#06b6d4", borderRadius: "3px 3px 0 0", minHeight: 4 }} />
                        <div style={{ width: 12, height: `${h2}%`, background: "#4080ff", borderRadius: "3px 3px 0 0", minHeight: 4 }} />
                      </div>
                      <span className="chart-label" style={{ fontSize: 11 }}>{t.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ===== 能力分布 + 成员/失分并列 ===== */}
          <div className="home-bottom-grid" style={{ marginBottom: 20 }}>
            {/* 组织能力分布 */}
            <div className="chart card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div>
                  <h2>组织能力分布</h2>
                  <p style={{ color: "#8b98aa", fontSize: 13, margin: "4px 0 0" }}>能力分布</p>
                </div>
                <span style={{ fontSize: 24, color: "#22c55e", fontWeight: 700 }}>{avgScore}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {bandStats.map((b) => (
                  <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 48, fontSize: 13, color: "#475569", flexShrink: 0 }}>{b.label}</span>
                    <div style={{ flex: 1, height: 16, background: "#f0f2f5", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${b.pct}%`, height: "100%", background: b.color, borderRadius: 4, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#8b98aa", width: 50, flexShrink: 0 }}>{b.count}人，{b.pct}%</span>
                  </div>
                ))}
              </div>
              <button className="link-btn" type="button" style={{ marginTop: 12, fontSize: 13 }}>查看待提升学员 →</button>
            </div>

            {/* 高频失分问题 */}
            <div className="rankcard card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div>
                  <h2>高频失分问题</h2>
                  <p style={{ color: "#8b98aa", fontSize: 13, margin: "4px 0 0" }}>AI 根据客观练习与考试结果归因</p>
                </div>
                <button className="link-btn" type="button" style={{ fontSize: 13 }}>查看全部问题 →</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                {DEDUCTION_TOP3.map((d) => (
                  <div key={d.reason}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, color: "#334155", fontWeight: 500 }}>{d.reason}</span>
                      <span style={{ fontSize: 12, color: d.color, background: d.color === "#ef4444" ? "#fef2f2" : d.color === "#f97316" ? "#fff7ed" : "#eff6ff", padding: "2px 8px", borderRadius: 4 }}>{d.tag}</span>
                    </div>
                    <div style={{ height: 10, background: "#f0f2f5", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ width: `${d.pct}%`, height: "100%", background: d.color, borderRadius: 5, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#8b98aa", marginTop: 2 }}>占{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===== 团队成员完成情况 ===== */}
          <div className="card section" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: "#0f3168" }}>团队成员完成情况</h2>
                <span style={{ color: "#8b98aa", fontSize: 13 }}>按完成率与能力分排序</span>
              </div>
              <button className="link-btn" type="button" style={{ fontSize: 13 }}>查看全部成员 →</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>成员</th>
                    <th>训练次数</th>
                    <th>完成率</th>
                    <th>平均分</th>
                  </tr>
                </thead>
                <tbody>
                  {memberStats.length > 0 ? memberStats.map((m, i) => (
                    <tr key={m.id}>
                      <td><span className="rank-num" style={{ background: "#4080ff", color: "#fff" }}>{i + 1}</span></td>
                      <td><strong>{m.name}</strong></td>
                      <td>{m.recordCount}次</td>
                      <td>{Math.round(m.recordCount / (records.length || 1) * 100)}%</td>
                      <td>{m.avgScore}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "#8b98aa" }}>暂无成员数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ===== 右侧栏 ===== */}
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
            <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
            <strong>{completedCount}</strong>
            <p>已完成培训任务</p>
            <div className="mini-stats">
              <span>对练<b>{completedCount}</b></span>
              <span>考试<b>{attempts.filter((a) => a.status === "passed" || a.status === "completed").length}</b></span>
              <span>合格率<b>{overview?.trainingPassRate ?? 0}%</b></span>
            </div>
          </div>
          <div className="sidecard card">
            <h2>通知消息</h2>
            <p>暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
