"use client";

import { useEffect, useMemo, useState } from "react";
import { recordApi } from "@/lib/api";

interface PracticeReportProps {
  /** 对练会话（练习完成后进入报告流程时使用，轮询 by-session 等待后台评分） */
  sessionId?: string;
  /** 训练记录 ID（从历史记录"查看报告"进入时使用，直接拉取详情，无需轮询） */
  recordId?: string;
  scene: any;
  task: any;
  onClose: () => void;
  showToast: (msg: string) => void;
}

/** 格式化 ISO 时间为 YYYY-MM-DD HH:mm（参考图格式） */
function fmtTimeFull(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtChatTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

type TranscriptTurnScore = {
  ruleName: string | null;
  score: number;
  maxScore?: number | null;
  deductionReason?: string;
  level?: string | null;
};

function normalizeLevel(score: number, maxScore = 100, level?: string | null): "excellent" | "pass" | "developing" {
  const raw = (level || "").toLowerCase();
  if (raw === "excellent" || raw === "pass" || raw === "developing") return raw;
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.9) return "excellent";
  if (ratio >= 0.6) return "pass";
  return "developing";
}

/** 环形进度（对练报告：绿色） */
function RingProgress({ value, size = 80, stroke = 6, color = "#27ae60" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(Math.max(value, 0), 100) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e6eb" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/** 能力雷达图（SVG 多边形，蓝色） */
function RadarChart({ items, size = 140 }: { items: Array<{ name: string; score: number; maxScore: number }>; size?: number }) {
  const n = items.length;
  const cx = size / 2;
  const cy = size / 2;
  const R = Math.min(size / 2 - 18, 52);
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number) => {
    const a = angle(i);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  };
  if (!n) return null;
  const ringPts = (k: number) => Array.from({ length: n }, (_, i) => pt(i, (R * k) / 3)).join(" ");
  const dataPts = items.map((it, i) => pt(i, R * Math.min(it.score / (it.maxScore || 1), 1))).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {[1, 2, 3].map((k) => (
        <polygon key={k} points={ringPts(k)} fill="none" stroke="#e5e6eb" strokeWidth="1" />
      ))}
      {items.map((_, i) => {
        const [x, y] = pt(i, R).split(",");
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e6eb" strokeWidth="1" />;
      })}
      <polygon points={dataPts} fill="rgba(66,123,255,.12)" stroke="#427bff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** 合格/未合格标签（对练报告：按原型三档 <60不合格 / 60-85合格 / >85优秀） */
function PassTag({ score }: { score: number }) {
  if (score > 85) return <span className="pr-tag ok">优秀</span>;
  if (score >= 60) return <span className="pr-tag ok">合格</span>;
  return <span className="pr-tag no">不合格</span>;
}

export default function PracticeReport({ sessionId, recordId, scene, task, onClose, showToast }: PracticeReportProps) {
  const [detail, setDetail] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"report" | "transcript">("report");

  // 历史记录入口：直接按记录 ID 拉取详情渲染（不轮询）
  useEffect(() => {
    if (recordId) {
      let cancelled = false;
      recordApi
        .detail(recordId)
        .then((data: any) => {
          if (!cancelled) setDetail(data);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [recordId]);

  // 轮询 by-session：评分后台异步生成，未完成前停留"报告生成中"中转页
  useEffect(() => {
    if (recordId || !sessionId) return;
    let cancelled = false;
    let tries = 0;
    const poll = () => {
      recordApi
        .bySession(sessionId)
        .then((data: any) => {
          if (cancelled) return;
          if (data?.record && data.record.status === "completed") {
            setDetail(data);
          } else if (tries < 60) {
            tries += 1;
            setTimeout(poll, 2000);
          } else {
            setFailed(true);
          }
        })
        .catch(() => {
          if (cancelled) return;
          if (tries < 60) {
            tries += 1;
            setTimeout(poll, 2000);
          } else {
            setFailed(true);
          }
        });
    };
    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, recordId]);

  const passScore = 60; // 对练报告合格线对齐原型（<60 不合格 / 60-85 合格 / >85 优秀）
  const score = detail?.record?.score ?? 0;
  const passed = score >= passScore;
  const overallScores: Array<{ ruleName: string | null; score: number; level?: string | null; deductionReason?: string; evidenceText?: string }> =
    detail?.scores ?? [];
  // 原型能力均分 = 综合得分（各维度加权后），对齐显示
  const avgScore = score;
  // 后端暂未返回权重：按维度数均分兜底（展示格式对齐原型「维度名（权重%）得分」）
  const dimWeight = overallScores.length ? Math.round(100 / overallScores.length) : 0;

  // 对话记录 tab：第 n 条学员消息 = 第 n 轮，匹配 turnScores；数据来源为 AI 对练页落库后的训练记录 turns/turnScores
  const transcript = useMemo(() => {
    if (!detail) return [];
    const turnScores: Array<{ roundNo: number; scores: TranscriptTurnScore[] }> = detail.turnScores ?? [];
    let learnerIdx = 0;
    return (detail.turns ?? []).map((t: any, i: number) => {
      const time = t.startedAt || detail.record?.startedAt;
      if (t.speaker === "learner") {
        learnerIdx += 1;
        const ts = turnScores.find((x) => x.roundNo === learnerIdx);
        const dimensions =
          ts?.scores?.map((s) => {
            const scoreValue = Number(s.score) || 0;
            const maxScore = Number(s.maxScore) || 100;
            return {
              name: s.ruleName || "评分维度",
              score: scoreValue,
              maxScore,
              level: normalizeLevel(scoreValue, maxScore, s.level),
              reason: s.deductionReason || "",
            };
          }) ?? [];
        const turnTotal = dimensions.length ? dimensions.reduce((a, s) => a + (Number(s.score) || 0), 0) : null;
        const reasons = dimensions.map((s) => s.reason).filter(Boolean);
        return { ...t, key: i, time, turnTotal, reasons, dimensions };
      }
      return { ...t, key: i, time };
    });
  }, [detail]);

  // 中转页：对练报告生成中（对齐原型 report-generating-modal）
  if (!detail && !failed) {
    return (
      <div className="pr-shell">
        <div className="report-generating-modal show" role="status" aria-live="polite">
          <div className="report-generating-panel">
            <div className="report-generating-spinner">
              <i></i>
              <i></i>
              <i></i>
            </div>
            <h3>生成报告中</h3>
            <p>正在整理本次 AI 对练内容，请稍候…</p>
            <div className="report-generating-steps">
              <span className="active">整理对话记录</span>
              <span>分析能力表现</span>
              <span>生成对练报告</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 生成超时兜底
  if (failed || !detail) {
    return (
      <div className="pr-shell">
        <div className="pr-pending">
          <div className="pr-pending-icon">!</div>
          <h2>报告生成超时</h2>
          <p>评分服务暂时繁忙，请稍后从训练记录中查看报告。</p>
          <button className="pr-close-report" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    );
  }

  const sceneName = detail.record?.sceneName || scene?.scene?.name || "场景对练";
  const taskName = detail.record?.taskName || task?.name || "";
  const subTitle = taskName ? `${taskName}·${sceneName}` : sceneName;

  return (
    <div className="pr-shell">
      {/* ===== 顶部导航（白底，标题居中） ===== */}
      <header className="pr-head">
        <button className="pr-head-btn" type="button" onClick={onClose} aria-label="返回">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="pr-head-text">
          <h1>AI对练报告</h1>
          <p>{subTitle}</p>
        </div>
        <button className="pr-head-close" type="button" onClick={onClose} aria-label="关闭报告">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {/* ===== 顶部得分区 ===== */}
      <div className="pr-score">
        <div className="pr-score-num">
          <b>{score}</b>
          <span>分</span>
        </div>
        <div className="pr-score-meta">
          <span>本次整体成绩</span>
          <em>{fmtTimeFull(detail.record?.finishedAt)}</em>
        </div>
      </div>

      {/* ===== Tab ===== */}
      <div className="pr-tabs">
        <button className={`pr-tab ${tab === "report" ? "active" : ""}`} type="button" onClick={() => setTab("report")}>
          AI对练报告
        </button>
        <button className={`pr-tab ${tab === "transcript" ? "active" : ""}`} type="button" onClick={() => setTab("transcript")}>
          对话记录
        </button>
      </div>

      {tab === "report" ? (
        /* ===== AI对练报告 tab ===== */
        <div className="pr-report-body">
          {/* 本次 AI 对练评估 */}
          <div className="pr-card">
            <div className="pr-eval-head">
              <div className="pr-eval-text">
                <h3>本次AI对练评估</h3>
                <p>综合得分 = 各能力维度得分 × 后台配置权重</p>
              </div>
              <PassTag score={score} />
            </div>

            <div className="pr-total-card">
              <div className="pr-ring">
                <RingProgress value={score} color={passed ? "#27ae60" : "#f5a623"} />
                <div className="pr-ring-center">
                  <b>{score}</b>
                  <span>综合得分</span>
                </div>
              </div>
              <div className="pr-total-text">
                <b>{passed ? "表现达到合格要求，继续保持优势能力" : "表现未达合格线，建议针对短板加强练习"}</b>
                <p>系统依据评分维度与后台配置权重，综合评估你本次对练各能力维度的表现。得分越高代表该维度行为越规范。</p>
                <div className="pr-total-stats">
                  能力均分 {avgScore}　评价维度 {overallScores.length}
                </div>
              </div>
            </div>
          </div>

          {/* 综合评价 */}
          {detail.capabilityProfile && (
            <div className="pr-card">
              <div className="pr-card-title">
                <i></i>
                综合评价
              </div>
              <p className="pr-summary">{detail.capabilityProfile}</p>
            </div>
          )}

          {/* 能力画像 */}
          {overallScores.length >= 3 && (
            <div className="pr-card">
              <div className="pr-card-title">
                <i></i>
                能力画像
              </div>
              <div className="pr-radar">
                <RadarChart items={overallScores.map((s) => ({ name: s.ruleName || "维度", score: Number(s.score) || 0, maxScore: 100 }))} />
                <div className="pr-radar-list">
                  {overallScores.map((s, i) => (
                    <div className="pr-radar-item" key={i}>
                      <span>
                        {s.ruleName || `维度${i + 1}`}（{dimWeight}%）
                      </span>
                      <b>{s.score}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 能力维度分析 */}
          {overallScores.length > 0 && (
            <div className="pr-card">
              <div className="pr-card-title">
                <i></i>
                能力维度分析
              </div>
              <div className="pr-dims">
                {overallScores.map((s, i) => {
                  const val = Number(s.score) || 0;
                  const isGood = val >= 80;
                  const pct = Math.min(Math.max(val / 100, 0), 1) * 100;
                  return (
                    <div className="pr-dim" key={i}>
                      <div className="pr-dim-top">
                        <span className={`pr-dim-dot ${isGood ? "good" : "warn"}`}></span>
                        <b>{s.ruleName || `维度${i + 1}`}</b>
                        <span className="pr-dim-weight">{dimWeight}%</span>
                        <span className="pr-dim-score">{s.score}</span>
                      </div>
                      <div className="pr-dim-bar">
                        <i className={isGood ? "good" : "warn"} style={{ width: `${pct}%` }}></i>
                      </div>
                      <p className="pr-dim-desc">{s.deductionReason || "该维度依据对话中的行为锚点进行评估。"}</p>
                      {s.level && (
                        <ul className="pr-dim-list">
                          <li>
                            {s.level === "excellent" ? "优势项：表现优秀，可作标杆" : s.level === "pass" ? "达标项：基本符合要求" : "待提升：该维度存在明显短板"}
                          </li>
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 表现反馈 */}
          {(detail.highlights?.length || detail.weaknesses?.length || detail.suggestions?.length) && (
            <div className="pr-card">
              <div className="pr-card-title">
                <i></i>
                表现反馈
              </div>
              <div className="pr-fb-grid">
                {(detail.highlights?.length > 0 || detail.suggestions?.length > 0) && (
                  <div className="pr-fb good">
                    <h4>表现较好</h4>
                    {(detail.highlights?.length ? detail.highlights : detail.suggestions).slice(0, 3).map((t: string, i: number) => (
                      <p key={i}>{t}</p>
                    ))}
                  </div>
                )}
                {detail.weaknesses?.length > 0 && (
                  <div className="pr-fb warn">
                    <h4>提升建议</h4>
                    {detail.weaknesses.slice(0, 3).map((t: string, i: number) => (
                      <p key={i}>{t}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 本次整体成绩 */}
          <div className="pr-card pr-final">
            <div className="pr-card-title">
              <i></i>
              本次整体成绩
            </div>
            <div className="pr-final-row">
              <b>{score}</b>
              <PassTag score={score} />
            </div>
          </div>

          <button className="pr-close-report" type="button" onClick={onClose}>
            关闭报告
          </button>
        </div>
      ) : (
        /* ===== 对话记录 tab ===== */
        <div className="pr-transcript">
          {transcript.length === 0 && <div className="pr-empty">暂无对话记录</div>}
          {transcript.map((t: any) => {
            if (t.speaker === "ai") {
              return (
                <div className="pv-msg ai" key={t.key}>
                  <span className="pv-avatar ai" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="1.7">
                      <rect x="4.5" y="7" width="15" height="11" rx="3.2" />
                      <circle cx="9.2" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                      <circle cx="14.8" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                      <path d="M12 4.5v2.5" />
                      <circle cx="12" cy="3.6" r="1.1" fill="#fff" stroke="none" />
                      <path d="M7 16.6h.01M11.5 16.6h.01M16 16.6h.01" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div className="pv-msg-main">
                    <span className="pv-time">{fmtChatTime(t.time)}</span>
                    <div className="pv-bubble">{t.text}</div>
                  </div>
                </div>
              );
            }
            return (
              <div className="pr-turn" key={t.key}>
                <div className="pv-msg user">
                  <span className="pv-avatar user" aria-hidden="true"></span>
                  <div className="pv-msg-main">
                    <span className="pv-time">{fmtChatTime(t.time)}</span>
                    <div className="pv-bubble">{Number(t.durationMs) > 0 && (
                      <span className="pv-voice-wave" aria-hidden="true">
                        <i></i>
                        <i></i>
                        <i></i>
                        <i></i>
                      </span>
                    )}{t.text}</div>
                  </div>
                </div>
                <div className="pv-msg feedback">
                  <div className="pv-feedback-card">
                    <div className="pv-feedback-head">
                      <b>实时点评</b>
                      <span>{t.turnTotal != null ? <><strong>{t.turnTotal}</strong>分</> : "—"}</span>
                    </div>
                    {t.dimensions && t.dimensions.length > 0 && (
                      <div className="pv-feedback-dimensions" aria-label="本轮评分维度">
                        {t.dimensions.map((dimension: any, index: number) => (
                          <span className={`pv-feedback-dimension ${dimension.level}`} key={`${dimension.name}-${index}`}>
                            <em>{dimension.name}</em>
                            <b>{dimension.score}/{dimension.maxScore}</b>
                          </span>
                        ))}
                      </div>
                    )}
                    {t.reasons?.length > 0 && (
                      <div className="pv-feedback-sec">
                        <span>问题定位</span>
                        <p>{t.reasons.join("；")}</p>
                      </div>
                    )}
                    {detail.suggestions?.length > 0 && (
                      <>
                        <div className="pv-feedback-divider"></div>
                        <div className="pv-feedback-sec green">
                          <span>改进建议</span>
                          <p>{detail.suggestions[0]}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <button className="pr-close-report" type="button" onClick={onClose}>
            关闭报告
          </button>
        </div>
      )}
    </div>
  );
}
