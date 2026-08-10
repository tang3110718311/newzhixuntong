// 数据统计区块（部门/学员两个视角，拆分自 admin-dashboard.tsx）
// 接真实后端 API：overview + organizations + training-records + users
import { useEffect, useState } from "react";
import { FileText, RefreshCcw, X } from "lucide-react";
import { DataTable, type AuthSession, type ActiveSection } from "./dashboard-shared";

type StatisticsProps = {
  activeSection: ActiveSection;
  auth: AuthSession;
  submitting: boolean;
  completedRecordCount: number;
  pendingAppealCount: number;
  recordsCount: number;
  onSwitchTab: (section: "statistics-dept" | "statistics-learner") => void;
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

type OrgRow = {
  id: string;
  name: string;
  userCount: number;
};

type RecordRow = {
  id: string;
  recordNo: string;
  userId?: string | null;
  userName?: string | null;
  taskName?: string | null;
  sceneName?: string | null;
  score: number;
  status: string;
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

// ---- 聚合类型 ----
type DeptAgg = {
  name: string;
  taskCount: number;
  peopleCount: number;
  completionRate: number;
  passRate: number;
};

type LearnerAgg = {
  id: string;
  name: string;
  mobile: string;
  orgName: string;
  score: number;
  pass: boolean;
  recordCount: number;
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

export function StatisticsSection({
  activeSection,
  auth,
  submitting,
  completedRecordCount,
  pendingAppealCount,
  recordsCount,
  onSwitchTab,
  onRefresh,
}: StatisticsProps) {
  const isDept = activeSection === "statistics-dept";

  // ---- 数据状态 ----
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<RecordRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // ---- 聚合数据 ----
  const [deptAgg, setDeptAgg] = useState<DeptAgg[]>([]);
  const [learnerAgg, setLearnerAgg] = useState<LearnerAgg[]>([]);

  function loadStatsData() {
    if (typeof window === "undefined") return;
    setDataLoading(true);
    Promise.all([
      apiFetch<DashboardOverview>("/dashboard/overview").catch(() => null),
      apiFetch<{ items: OrgRow[] }>("/organizations?pageSize=100").catch(() => ({ items: [] })),
      apiFetch<{ items: RecordRow[] }>("/training-records?pageSize=100").catch(() => ({ items: [] })),
      apiFetch<{ items: UserRow[] }>("/users?pageSize=100").catch(() => ({ items: [] })),
    ])
      .then(([overviewData, orgData, recordData, userData]) => {
        const ov = overviewData as DashboardOverview | null;
        const orgItems = (orgData as { items: OrgRow[] }).items;
        const recItems = (recordData as { items: RecordRow[] }).items;
        const userItems = (userData as { items: UserRow[] }).items;

        setOverview(ov);
        setOrgs(orgItems);
        setTrainingRecords(recItems);
        setUsers(userItems);

        // ---- 部门聚合 ----
        const orgMap = new Map<string, DeptAgg>();
        orgItems.forEach((org) => {
          orgMap.set(org.id, { name: org.name, taskCount: 0, peopleCount: org.userCount, completionRate: 0, passRate: 0 });
        });
        // 按组织统计训练记录
        const userOrgMap = new Map<string, string>();
        userItems.forEach((u) => {
          if (u.orgId) userOrgMap.set(u.id, u.orgId);
        });
        const orgRecordCounts = new Map<string, { total: number; completed: number; passed: number }>();
        recItems.forEach((r) => {
          const oid = r.userId ? userOrgMap.get(r.userId) : undefined;
          if (!oid) return;
          const cur = orgRecordCounts.get(oid) || { total: 0, completed: 0, passed: 0 };
          cur.total += 1;
          if (r.status === "completed") cur.completed += 1;
          if (r.score >= 80) cur.passed += 1;
          orgRecordCounts.set(oid, cur);
        });
        orgRecordCounts.forEach((rec, oid) => {
          const dept = orgMap.get(oid);
          if (dept) {
            dept.taskCount = rec.completed;
            dept.completionRate = rec.total > 0 ? Math.round((rec.completed / rec.total) * 100) : 0;
            dept.passRate = rec.total > 0 ? Math.round((rec.passed / rec.total) * 100) : 0;
          }
        });
        setDeptAgg(Array.from(orgMap.values()));

        // ---- 学员聚合 ----
        const learnerScores = new Map<string, { name: string; mobile: string; orgName: string; totalScore: number; recordCount: number; passCount: number }>();
        userItems
          .filter((u) => u.roleCode === "learner")
          .forEach((u) => {
            learnerScores.set(u.id, { name: u.name, mobile: u.mobile, orgName: u.orgName || "未分配", totalScore: 0, recordCount: 0, passCount: 0 });
          });
        recItems.forEach((r) => {
          if (!r.userId) return;
          const ls = learnerScores.get(r.userId);
          if (!ls) return;
          ls.totalScore += r.score;
          ls.recordCount += 1;
          if (r.score >= 80) ls.passCount += 1;
        });
        const la: LearnerAgg[] = [];
        learnerScores.forEach((ls, id) => {
          la.push({
            id,
            name: ls.name,
            mobile: ls.mobile,
            orgName: ls.orgName,
            score: ls.recordCount > 0 ? Math.round(ls.totalScore / ls.recordCount) : 0,
            pass: ls.recordCount > 0 && ls.passCount === ls.recordCount,
            recordCount: ls.recordCount,
          });
        });
        setLearnerAgg(la);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }

  useEffect(() => {
    loadStatsData();
  }, []);

  // ---- 部门视图数据 ----
  const deptTaskCount = overview?.publishedTaskCount ?? 0;
  const deptLearnerCount = users.filter((u) => u.roleCode === "learner").length;
  const deptCompletionRate = overview?.completedTaskCount && overview?.publishedTaskCount
    ? Math.round(((overview.completedTaskCount) / overview.publishedTaskCount) * 100) : 0;
  const deptExamPassRate = overview?.examPassRate ?? 0;

  // 按完成率排序的部门（取前5做柱状图/排名）
  const deptSorted = [...deptAgg].sort((a, b) => b.completionRate - a.completionRate);
  const topDepts = deptSorted.slice(0, 5);
  const rankDepts = deptSorted.slice(0, 4);

  // ---- 学员视图数据 ----
  const learnerTotal = learnerAgg.length;
  const learnerAvgHours = overview?.studyDurationHours ?? 0;
  const learnerCompletionRate = trainingRecords.length > 0
    ? Math.round((trainingRecords.filter((r) => r.status === "completed").length / trainingRecords.length) * 100) : 0;
  const learnerExcellentRate = learnerAgg.length > 0
    ? Math.round((learnerAgg.filter((l) => l.score >= 90).length / learnerAgg.length) * 100) : 0;

  // 按均分排序的学员（柱状图显示全部，排名取前4）
  const learnerSorted = [...learnerAgg].filter((l) => l.recordCount > 0).sort((a, b) => b.score - a.score);
  const topLearners = learnerSorted;
  const rankLearners = learnerSorted.slice(0, 4);

  // 部门名称截断
  const shortName = (n: string, max = 5) => n.length > max ? n.slice(0, max) + "…" : n;

  // ---- 时间格式化 ----
  function formatTime(iso: string): string {
    if (!iso || iso === "—") return iso;
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return iso;
    }
  }

  // ---- 导出 CSV ----
  function exportCSV() {
    if (isDept) {
      const header = "部门,任务数,参与人数,完成率,考试合格率\n";
      const rows = deptAgg.map((d) => `${d.name},${d.taskCount},${d.peopleCount},${d.completionRate}%,${d.passRate}%`).join("\n");
      downloadCSV(header + rows, "部门数据统计.csv");
    } else {
      const header = "姓名,手机号,部门,成绩,合格情况\n";
      const rows = learnerAgg.filter((l) => l.recordCount > 0).map((l) => `${l.name},${l.mobile},${l.orgName},${l.score}分,${l.score >= 80 ? "合格" : "不合格"}`).join("\n");
      downloadCSV(header + rows, "学员数据统计.csv");
    }
  }
  function downloadCSV(content: string, filename: string) {
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- 查看报告弹窗 ----
  const [reportUserId, setReportUserId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<{ userName: string; records: Array<{ recordNo: string; sceneName: string; score: number; status: string; finishedAt: string }> } | null>(null);

  async function viewReport(userId: string, userName: string) {
    setReportUserId(userId);
    setReportDetail(null);
    try {
      const data = await apiFetch<{ items: Array<{ recordNo: string; sceneName?: string | null; score: number; status: string; finishedAt?: string | null; userName?: string | null }> }>(`/training-records?pageSize=100&userId=${userId}`);
      setReportDetail({
        userName,
        records: (data as { items: Array<{ recordNo: string; sceneName?: string | null; score: number; status: string; finishedAt?: string | null }> }).items.map((r) => ({
          recordNo: r.recordNo,
          sceneName: r.sceneName || "—",
          score: r.score,
          status: r.status,
          finishedAt: formatTime(r.finishedAt || "—"),
        })),
      });
    } catch {
      setReportDetail({ userName, records: [] });
    }
  }

  return (
    <section className="page-section">
      <div className="home-grid">
        <div className="home-main">
          <div className="page-header">
            <div>
              <h1 className="page-title">数据统计</h1>
              <p className="page-desc">从部门和学员两个视角查看培训执行效果。</p>
            </div>
            <div className="toolbar">
              <button className="btn" type="button" onClick={exportCSV} disabled={isDept ? deptAgg.length === 0 : learnerAgg.length === 0}><FileText size={16} /> 导出报表</button>
              <button className="btn" type="button" onClick={() => { onRefresh(); loadStatsData(); }} disabled={submitting || dataLoading}><RefreshCcw size={16} /> 刷新数据</button>
            </div>
          </div>

          <div className="tab-bar" style={{ borderBottom: "none", gap: 8, marginBottom: 20 }}>
            <button className="tab-item" type="button"
              onClick={() => onSwitchTab("statistics-dept")}
              style={isDept ? { background: "#4080ff", color: "#fff", borderRadius: 6, borderBottom: "none", fontWeight: 600 } : {}}>
              部门数据
            </button>
            <button className="tab-item" type="button"
              onClick={() => onSwitchTab("statistics-learner")}
              style={!isDept ? { background: "#4080ff", color: "#fff", borderRadius: 6, borderBottom: "none", fontWeight: 600 } : {}}>
              学员统计
            </button>
          </div>

          {isDept ? (
            <>
              <div className="stats prototype-stats stats-4" style={{ marginBottom: 24 }}>
                <div className="metric card"><span>培训任务数</span><strong>{deptTaskCount}</strong><small>2026年度</small></div>
                <div className="metric card"><span>参与学员数</span><strong style={{ color: "#4080ff" }}>{deptLearnerCount}</strong><small>累计参与</small></div>
                <div className="metric card"><span>任务完成率</span><strong>{deptCompletionRate}%</strong><small style={{ color: "#22c55e" }}>较上月 +0%</small></div>
                <div className="metric card"><span>考试合格率</span><strong style={{ color: "#22c55e" }}>{deptExamPassRate}%</strong><small style={{ color: "#ef4444" }}>较上月 -0%</small></div>
              </div>

              <div className="home-bottom-grid" style={{ marginBottom: 24 }}>
                <div className="chart card">
                  <h2>各部门任务完成率</h2>
                  {topDepts.length > 0 ? (
                    <div className="chart-bars chart-bars-labeled">
                      {topDepts.map((dept) => (
                        <div key={dept.name} className="chart-col">
                          <div className="chart-bar" style={{ height: `${Math.max(dept.completionRate, 5)}%` }} />
                          <span className="chart-label">{shortName(dept.name)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: 32, color: "#8b98aa" }}>暂无部门数据</div>
                  )}
                </div>
                <div className="rankcard card">
                  <h2>重点指标排名</h2>
                  {rankDepts.length > 0 ? rankDepts.map((dept, i) => (
                    <div key={dept.name} className="rank-row"><span className="rank-num" style={{ background: "#4080ff", color: "#fff" }}>{i + 1}</span><span className="rank-label">{dept.name}</span><strong style={{ color: "#1a202c" }}>{dept.completionRate}%</strong></div>
                  )) : (
                    <div style={{ textAlign: "center", padding: 32, color: "#8b98aa" }}>暂无排名数据</div>
                  )}
                </div>
              </div>

              <div className="card section">
                <h2 className="section-title" style={{ marginBottom: 16 }}>部门列表</h2>
                <DataTable headers={["部门", "任务数", "参与人数", "完成率", "考试合格率", "趋势"]}>
                  {deptAgg.length > 0 ? deptAgg.map((row) => (
                    <tr key={row.name}>
                      <td><strong>{row.name}</strong></td>
                      <td>{row.taskCount}</td>
                      <td>{row.peopleCount}</td>
                      <td>{row.completionRate}%</td>
                      <td>{row.passRate}%</td>
                       <td><span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 12, background: "#f0fdf4", color: "#16a34a" }}>+0%</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "#8b98aa" }}>暂无部门数据</td></tr>
                  )}
                </DataTable>
              </div>
            </>
          ) : (
            <>
              <div className="stats prototype-stats stats-4" style={{ marginBottom: 24 }}>
                <div className="metric card"><span>学员总数</span><strong>{learnerTotal}</strong><small>2026年度</small></div>
                <div className="metric card"><span>人均学习时长</span><strong style={{ color: "#4080ff" }}>{learnerAvgHours}h</strong><small>累计参与</small></div>
                <div className="metric card"><span>学习完成率</span><strong>{learnerCompletionRate}%</strong><small style={{ color: "#22c55e" }}>较上月 +0%</small></div>
                <div className="metric card"><span>优秀率</span><strong style={{ color: "#22c55e" }}>{learnerExcellentRate}%</strong><small style={{ color: "#ef4444" }}>较上月 -0%</small></div>
              </div>

              <div className="home-bottom-grid" style={{ marginBottom: 24 }}>
                <div className="chart card">
                  <h2>学员成绩 TOP5</h2>
                  {topLearners.length > 0 ? (
                    <div className="chart-bars chart-bars-labeled">
                      {topLearners.map((l) => (
                        <div key={l.id} className="chart-col">
                          <div className="chart-bar" style={{ height: `${Math.max(l.score, 5)}%` }} />
                          <span className="chart-label">{shortName(l.name, 4)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: 32, color: "#8b98aa" }}>暂无学员数据</div>
                  )}
                </div>
                <div className="rankcard card">
                  <h2>重点指标排名</h2>
                  {rankLearners.length > 0 ? rankLearners.map((l, i) => (
                    <div key={l.id} className="rank-row"><span className="rank-num" style={{ background: "#4080ff", color: "#fff" }}>{i + 1}</span><span className="rank-label">{l.name}</span><strong style={{ color: "#1a202c" }}>{l.score}%</strong></div>
                  )) : (
                    <div style={{ textAlign: "center", padding: 32, color: "#8b98aa" }}>暂无排名数据</div>
                  )}
                </div>
              </div>

              <div className="card section">
                <h2 className="section-title" style={{ marginBottom: 16 }}>学员成绩</h2>
                <DataTable headers={["姓名", "手机号", "成绩", "合格情况", "操作"]}>
                  {learnerAgg.filter((l) => l.recordCount > 0).length > 0 ? (
                    learnerAgg.filter((l) => l.recordCount > 0).map((row) => (
                      <tr key={row.id}>
                        <td><strong>{row.name}</strong></td>
                        <td className="muted-text">{row.mobile.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}</td>
                        <td>{row.score}分</td>
                        <td><span className={`pass-tag ${row.pass ? "pass-yes" : "pass-no"}`}>{row.score >= 80 ? "合格" : "不合格"}</span></td>
                        <td><button className="link-btn" type="button" onClick={() => viewReport(row.id, row.name)}>查看报告</button></td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "#8b98aa" }}>暂无学员成绩数据</td></tr>
                  )}
                </DataTable>
              </div>
            </>
          )}
        </div>

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
            <strong>{completedRecordCount}</strong>
            <p>已完成培训任务</p>
            <div className="mini-stats"><span>对练<b>{recordsCount}</b></span><span>考试<b>{overview?.examAttemptCount ?? 0}</b></span><span>合格率<b>{overview?.trainingPassRate ?? 0}%</b></span></div>
          </div>
          <div className="sidecard card">
            <h2>通知消息</h2>
            <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
          </div>
          {/* 查看报告弹窗 */}
          {reportUserId && (
            <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => { setReportUserId(null); setReportDetail(null); }}>
              <div className="modal-card card" style={{ width: 560, maxHeight: "80vh", overflow: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()}>
                <button type="button" style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer" }} onClick={() => { setReportUserId(null); setReportDetail(null); }}><X size={18} /></button>
                <h2 style={{ marginBottom: 16 }}>{reportDetail?.userName || "学员"}训练报告</h2>
                {!reportDetail ? (
                  <div style={{ textAlign: "center", padding: 32, color: "#8b98aa" }}>加载中…</div>
                ) : reportDetail.records.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 32, color: "#8b98aa" }}>暂无训练记录</div>
                ) : (
                  <table>
                    <thead>
                      <tr><th>记录编号</th><th>场景</th><th>成绩</th><th>状态</th><th>完成时间</th></tr>
                    </thead>
                    <tbody>
                      {reportDetail.records.map((r, i) => (
                        <tr key={i}>
                          <td className="muted-text">{r.recordNo}</td>
                          <td>{r.sceneName}</td>
                          <td>{r.score}分</td>
                          <td>{r.status === "completed" ? "已完成" : r.status}</td>
                          <td className="muted-text">{r.finishedAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
