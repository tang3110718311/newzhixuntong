// 申诉管理区块（拆分自 admin-dashboard.tsx，渲染行为与原文件完全一致）
import { FormEvent, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCcw, Save, X } from "lucide-react";
import { DataTable, Field, type Appeal as AppealType, type AuthSession, type TrainingRecord, statusBadge } from "./dashboard-shared";

export type AppealForm = { bizId: string; reason: string };

type AppealsProps = {
  auth: AuthSession;
  records: TrainingRecord[];
  appeals: AppealType[];
  appealForm: AppealForm;
  submitting: boolean;
  completedRecordCount: number;
  pendingAppealCount: number;
  loadData: () => void;
  handleCreateAppeal: (event: FormEvent<HTMLFormElement>) => void;
  setAppealForm: (form: AppealForm) => void;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

function bizTypeLabel(bizType: string) {
  return bizType === "training_record" ? "对练结果" : bizType === "exam" ? "考试成绩" : "任务记录";
}

function appealStatusLabel(status: string) {
  const map: Record<string, string> = { pending: "待处理", in_progress: "处理中", approved: "已通过", rejected: "已驳回" };
  return map[status] || status;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function AppealsSection({
  auth,
  records,
  appeals,
  appealForm,
  submitting,
  completedRecordCount,
  pendingAppealCount,
  loadData,
  handleCreateAppeal,
  setAppealForm,
}: AppealsProps) {
  const [handlingAppeal, setHandlingAppeal] = useState<string | null>(null);
  const [detailAppeal, setDetailAppeal] = useState<AppealType | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 训练记录详情（对话回放 + 评分明细）
  const [recordExpanded, setRecordExpanded] = useState(false);
  const [recordDetail, setRecordDetail] = useState<{ turns: Array<{ speaker: string; text: string }>; scores: Array<{ ruleName: string; score: number; deductionReason: string; evidenceText: string }> } | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);

  async function loadRecordDetail(bizId: string) {
    if (recordDetail) return; // 已加载过不重复拉
    setRecordLoading(true);
    try {
      const token = typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem("zxt-admin-auth") || "{}")?.token || "" : "";
      const res = await fetch(`${API_BASE}/training-records/${bizId}`, {
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.message);
      const data = payload.data;
      setRecordDetail({ turns: data.turns || [], scores: data.scores || [] });
    } catch (err) {
      console.error("加载训练记录失败:", err);
      setRecordDetail({ turns: [], scores: [] });
    } finally {
      setRecordLoading(false);
    }
  }

  function openDetail(appeal: AppealType) {
    setDetailAppeal(appeal);
    setRecordExpanded(false);
    setRecordDetail(null);
  }

  // 统计卡从 appeals 聚合
  const totalCount = appeals.length;
  const pendingCount = appeals.filter((a) => a.status === "pending").length;
  const inProgressCount = appeals.filter((a) => a.status === "in_progress").length;
  const resolvedCount = appeals.filter((a) => a.status === "approved" || a.status === "rejected").length;

  async function handleAppealAction(appealId: string, status: "approved" | "rejected") {
    setActionLoading(true);
    try {
      const token = typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem("zxt-admin-auth") || "{}")?.token || "" : "";
      const response = await fetch(`${API_BASE}/appeals/${appealId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.message || payload.code);
      await loadData();
      setHandlingAppeal(null);
    } catch (err) {
      console.error("申诉操作失败:", err);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="page-section">
      <div className="home-grid">
        <div className="home-main">
          <div className="page-header">
            <div>
              <h1 className="page-title">申诉管理</h1>
              <p className="page-desc">处理学员对任务、考试及学习结果提出的申诉。</p>
            </div>
            <div className="toolbar">
              <button className="btn" type="button" onClick={loadData} disabled={submitting}><RefreshCcw size={16} /> 刷新列表</button>
            </div>
          </div>

          <div className="stats prototype-stats stats-4">
            <div className="metric card"><span>申诉总数</span><strong>{totalCount}</strong><small>累计提交</small></div>
            <div className="metric card"><span>待处理</span><strong>{pendingCount}</strong><small>需要及时跟进</small></div>
            <div className="metric card"><span>处理中</span><strong>{inProgressCount}</strong><small>已受理</small></div>
            <div className="metric card"><span>已处理</span><strong>{resolvedCount}</strong><small>处理完成</small></div>
          </div>

          <div className="card section">
            <DataTable headers={["申诉编号", "申诉人", "申诉类型", "提交时间", "状态", "处理人", "操作"]}>
              {appeals.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#8b98aa" }}>暂无申诉记录</td></tr>
              ) : (
                appeals.map((row) => (
                  <tr key={row.id}>
                    <td className="muted-text">{row.recordNo || row.id.slice(0, 12)}</td>
                    <td>{row.userName || "未知"}</td>
                    <td>{bizTypeLabel(row.bizType)}</td>
                    <td className="muted-text">{formatDate(row.createdAt)}</td>
                    <td>{statusBadge(row.status)}</td>
                    <td className="muted-text">{row.handlerName || "—"}</td>
                    <td>
                      <div className="action-row">
                        <button className="link-btn" type="button" onClick={() => openDetail(row)}>查看</button>
                        {row.status === "pending" && (
                          <button className="link-btn" type="button" onClick={() => setHandlingAppeal(row.id)}>受理</button>
                        )}
                        {(row.status === "pending" || row.status === "in_progress") && (
                          <button className="link-btn" type="button" onClick={() => handleAppealAction(row.id, "approved")} disabled={actionLoading}>通过</button>
                        )}
                        {(row.status === "pending" || row.status === "in_progress") && (
                          <button className="link-btn" type="button" onClick={() => handleAppealAction(row.id, "rejected")} disabled={actionLoading}>驳回</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          </div>

          {/* 查看详情弹窗 */}
          {detailAppeal && (
            <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setDetailAppeal(null)}>
              <div className="modal-card card" style={{ width: 640, maxHeight: "85vh", overflow: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()}>
                <button type="button" style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer" }} onClick={() => setDetailAppeal(null)}><X size={18} /></button>
                <h2 style={{ marginBottom: 16 }}>申诉详情</h2>
                <div style={{ display: "grid", gap: 12 }}>
                  <div><strong>申诉编号：</strong>{detailAppeal.recordNo || detailAppeal.id.slice(0, 12)}</div>
                  <div><strong>申诉人：</strong>{detailAppeal.userName || "未知"}</div>
                  <div><strong>申诉类型：</strong>{bizTypeLabel(detailAppeal.bizType)}</div>
                  <div><strong>关联场景：</strong>{detailAppeal.sceneName || "—"}</div>
                  <div><strong>关联任务：</strong>{detailAppeal.taskName || "—"}</div>
                  <div><strong>评分：</strong>{detailAppeal.score ?? "—"}</div>
                  <div><strong>状态：</strong>{appealStatusLabel(detailAppeal.status)}</div>
                  <div><strong>申诉原因：</strong>{detailAppeal.reason}</div>
                  <div><strong>处理人：</strong>{detailAppeal.handlerName || "—"}</div>
                  <div><strong>处理时间：</strong>{formatDate(detailAppeal.handledAt)}</div>
                  <div><strong>提交时间：</strong>{formatDate(detailAppeal.createdAt)}</div>
                </div>

                {/* 查看训练记录折叠面板 */}
                <div style={{ marginTop: 20, borderTop: "1px solid #eee", paddingTop: 16 }}>
                  <button type="button" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#4e63f0", padding: 0 }}
                    onClick={() => {
                      const next = !recordExpanded;
                      setRecordExpanded(next);
                      if (next && detailAppeal.bizId) loadRecordDetail(detailAppeal.bizId);
                    }}>
                    {recordExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    查看训练记录
                  </button>

                  {recordExpanded && (
                    <div style={{ marginTop: 12 }}>
                      {recordLoading ? (
                        <div style={{ textAlign: "center", padding: 24, color: "#8b98aa" }}>加载中…</div>
                      ) : !recordDetail ? null : (
                        <>
                          {/* 评分明细 */}
                          {recordDetail.scores.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#333" }}>评分明细</h3>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead>
                                  <tr style={{ background: "#f5f7fa" }}>
                                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #eee" }}>评分维度</th>
                                    <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #eee" }}>得分</th>
                                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #eee" }}>扣分原因</th>
                                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #eee" }}>证据文本</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {recordDetail.scores.map((s, i) => (
                                    <tr key={i}>
                                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #f0f0f0" }}>{s.ruleName || "—"}</td>
                                      <td style={{ padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #f0f0f0", color: s.deductionReason ? "#e53e3e" : "#333", fontWeight: s.deductionReason ? 600 : 400 }}>{s.score}</td>
                                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #f0f0f0", color: s.deductionReason ? "#e53e3e" : "#8b98aa" }}>{s.deductionReason || "—"}</td>
                                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #f0f0f0", color: "#555", fontSize: 12 }}>{s.evidenceText || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* 对话回放 */}
                          {recordDetail.turns.length > 0 ? (
                            <div>
                              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#333" }}>对话回放</h3>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflow: "auto", padding: "8px 0" }}>
                                {recordDetail.turns.map((turn, i) => (
                                  <div key={i} style={{ display: "flex", justifyContent: turn.speaker === "learner" ? "flex-end" : "flex-start" }}>
                                    <div style={{
                                      maxWidth: "75%",
                                      padding: "8px 12px",
                                      borderRadius: 8,
                                      fontSize: 13,
                                      lineHeight: 1.6,
                                      background: turn.speaker === "ai" ? "#f0f4f8" : "#4e63f0",
                                      color: turn.speaker === "ai" ? "#333" : "#fff",
                                    }}>
                                      <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.7 }}>{turn.speaker === "ai" ? "AI" : "学员"}</div>
                                      {turn.text}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{ textAlign: "center", padding: 16, color: "#8b98aa" }}>无对话记录</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 受理确认弹窗 */}
          {handlingAppeal && (
            <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setHandlingAppeal(null)}>
              <div className="modal-card card" style={{ width: 400, position: "relative" }} onClick={(e) => e.stopPropagation()}>
                <button type="button" style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer" }} onClick={() => setHandlingAppeal(null)}><X size={18} /></button>
                <h2 style={{ marginBottom: 16 }}>确认受理</h2>
                <p style={{ marginBottom: 16, color: "#8b98aa" }}>受理后将进入处理流程，请选择操作：</p>
                <div style={{ display: "flex", gap: 12 }}>
                  <button className="btn primary" type="button" onClick={() => handleAppealAction(handlingAppeal, "approved")} disabled={actionLoading}>通过</button>
                  <button className="btn" type="button" onClick={() => handleAppealAction(handlingAppeal, "rejected")} disabled={actionLoading}>驳回</button>
                  <button className="btn" type="button" onClick={() => setHandlingAppeal(null)}>取消</button>
                </div>
              </div>
            </div>
          )}

          <div className="card section" style={{ padding: 20 }}>
            <div className="section-head compact" style={{ marginBottom: 16 }}>
              <div>
                <h2 className="section-title" style={{ fontSize: 20 }}>新增复核申诉</h2>
                <p className="section-note">用于学员对训练评分有异议时，由后台代录并进入处理流。</p>
              </div>
            </div>
            <form className="form-card" onSubmit={handleCreateAppeal} style={{ display: "grid", gap: 16 }}>
              <Field label="关联训练记录"><select value={appealForm.bizId} onChange={(e) => setAppealForm({ ...appealForm, bizId: e.target.value })} required>{records.map((record) => <option value={record.id} key={record.id}>{record.recordNo} · {record.userName || "未知学员"} · {record.score}分</option>)}</select></Field>
              <Field label="申诉原因"><textarea value={appealForm.reason} onChange={(e) => setAppealForm({ ...appealForm, reason: e.target.value })} placeholder="如：学员认为情绪安抚评分偏低，请管理员结合对话证据复核。" required /></Field>
              <button className="btn primary" disabled={submitting || !appealForm.bizId || appealForm.reason.trim().length < 5} type="submit"><Save size={16} /> 提交复核</button>
            </form>
          </div>
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
            <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
          </div>
          <div className="sidecard card">
            <h2>通知消息</h2>
            <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
