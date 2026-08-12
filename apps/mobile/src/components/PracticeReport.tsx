"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/** 格式化 ISO 时间为 MM月DD日 HH:mm */
function fmtTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 环形进度（报告页总得分卡） */
function RingProgress({ value, size = 70, stroke = 7, color = "#10b981" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(Math.max(value, 0), 100) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
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

/** 能力雷达图（SVG 多边形） */
function RadarChart({ items, size = 168 }: { items: Array<{ name: string; score: number; maxScore: number }>; size?: number }) {
  const n = items.length;
  const cx = size / 2;
  const cy = size / 2;
  const R = Math.min(size / 2 - 24, 66);
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
        <polygon key={k} points={ringPts(k)} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {items.map((_, i) => {
        const [x, y] = pt(i, R).split(",");
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
      })}
      <polygon points={dataPts} fill="rgba(37,99,235,.22)" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** 合格/未合格标签 */
function PassTag({ passed }: { passed: boolean }) {
  return <span className={`pr-pass-tag ${passed ? "ok" : "no"}`}>{passed ? "合格" : "未合格"}</span>;
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

  const passScore = scene?.scene?.passScore ?? 80;
  const score = detail?.record?.score ?? 0;
  const passed = score >= passScore;
  const overallScores: Array<{ ruleName: string | null; score: number; level?: string | null; deductionReason?: string; evidenceText?: string }> =
    detail?.scores ?? [];
  const avgScore = overallScores.length ? Math.round(overallScores.reduce((a, s) => a + (Number(s.score) || 0), 0) / overallScores.length) : score;

  // 对话记录 tab：第 n 条学员消息 = 第 n 轮，匹配 turnScores
  const learnerSeqRef = useRef(0);
  learnerSeqRef.current = 0;
  const transcript = useMemo(() => {
    if (!detail) return [];
    const turnScores: Array<{ roundNo: number; scores: Array<{ ruleName: string | null; score: number; deductionReason?: string; level?: string }> }> =
      detail.turnScores ?? [];
    let learnerIdx = 0;
    return (detail.turns ?? []).map((t: any, i: number) => {
      if (t.speaker === "learner") {
        learnerIdx += 1;
        const ts = turnScores.find((x) => x.roundNo === learnerIdx);
        const turnTotal = ts?.scores?.reduce((a, s) => a + (Number(s.score) || 0), 0) ?? null;
        const reasons = (ts?.scores?.map((s) => s.deductionReason).filter(Boolean) as string[]) ?? [];
        return { ...t, key: i, turnTotal, reasons };
      }
      return { ...t, key: i };
    });
  }, [detail]);

  // 中转页：对练报告生成中
  if (!detail && !failed) {
    return (
      <div className="pr-shell">
        <div className="pr-pending">
          <div className="pr-spinner" aria-hidden="true"></div>
          <h2>对练报告生成中</h2>
          <p>正在分析你的对练表现与能力维度，请稍候…</p>
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

  return (
    <div className="pr-shell">
      {/* ===== 头部 ===== */}
      <header className="pr-head">
        <div className="pr-head-text">
          <h1>AI对练报告</h1>
          <p>
            {taskName}·{sceneName}
          </p>
        </div>
        <button className="pr-close" type="button" onClick={onClose} aria-label="关闭报告">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {/* ===== 得分概览条 ===== */}
      <div className="pr-score-brief">
        <div className="pr-score-num">
          <b>{score}</b>
          <span>分</span>
        </div>
        <div className="pr-score-meta">
          <span>本次整体成绩</span>
          <em>{fmtTime(detail.record?.finishedAt)}</em>
        </div>
      </div>

      {/* ===== Tab 切换 ===== */}
      <div className="pr-tabs">
        <button className={`pr-tab ${tab === "report" ? "active" : ""}`} type="button" onClick={() => setTab("report")}>
          AI对练报告
        </button>
        <button className={`pr-tab ${tab === "transcript" ? "active" : ""}`} type="button" onClick={() => setTab("transcript")}>
          对话记录
        </button>
      </div>

      {tab === "report" ? (
        <div className="pr-report-body">
          {/* 本次 AI 对练评估 */}
          <div className="pr-section-head">
            <h3>本次AI对练评估</h3>
            <PassTag passed={passed} />
          </div>
          <p className="pr-formula">综合得分 = 各能力维度得分 × 后台配置权重</p>

          {/* 总得分卡 */}
          <div className="pr-total-card">
            <div className="pr-ring-wrap">
              <div className="pr-ring">
                <RingProgress value={score} />
                <div className="pr-ring-center">
                  <b>{score}</b>
                  <span>综合得分</span>
                </div>
              </div>
            </div>
            <div className="pr-total-text">
              <b>{passed ? "表现达到合格要求，继续保持优势能力" : "表现未达合格线，建议针对短板加强练习"}</b>
              <p>
                系统依据评分维度与后台配置权重，综合评估你本次对练各能力维度的表现。得分越高代表该维度行为越规范。
              </p>
              <div className="pr-total-stats">
                <span>
                  能力均分 <b>{avgScore}</b>
                </span>
                <span>
                  评价维度 <b>{overallScores.length}</b>
                </span>
              </div>
            </div>
          </div>

          {/* 能力维度分析 */}
          <div className="pr-sec-title">
            <i></i>
            能力维度分析
          </div>
          <div className="pr-dims">
            {overallScores.map((s, i) => {
              const maxScore = 100; // 权重见下方展示，进度条按得分比例
              const pct = Math.min(Math.max((Number(s.score) || 0) / maxScore, 0), 1) * 100;
              const isGood = (Number(s.score) || 0) >= 80;
              const dotColors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];
              return (
                <div className="pr-dim-card" key={i}>
                  <div className="pr-dim-top">
                    <span className="pr-dim-dot" style={{ background: dotColors[i % dotColors.length] }}></span>
                    <b>{s.ruleName || `维度${i + 1}`}</b>
                    <span className="pr-dim-weight">权重{s.ruleName ? "按后台配置" : ""}</span>
                    <span className="pr-dim-score">{s.score}</span>
                  </div>
                  <div className="pr-dim-bar">
                    <i className={isGood ? "good" : "warn"} style={{ width: `${pct}%` }}></i>
                  </div>
                  <p className="pr-dim-desc">{s.deductionReason || "该维度依据对话中的行为锚点进行评估。"}</p>
                  {s.level && (
                    <div className="pr-dim-level">
                      {s.level === "excellent" ? (
                        <span className="pr-diamond good">◆ 优势项：表现优秀，可作标杆</span>
                      ) : s.level === "pass" ? (
                        <span className="pr-diamond mid">◆ 达标项：基本符合要求</span>
                      ) : (
                        <span className="pr-diamond warn">◆ 待提升：该维度存在明显短板</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 综合评价 */}
          {detail.capabilityProfile && (
            <>
              <div className="pr-sec-title">
                <i></i>
                综合评价
              </div>
              <div className="pr-summary-card">{detail.capabilityProfile}</div>
            </>
          )}

          {/* 能力画像（雷达图） */}
          {overallScores.length >= 3 && (
            <>
              <div className="pr-sec-title">
                <i></i>
                能力画像
              </div>
              <div className="pr-radar-card">
                <RadarChart items={overallScores.map((s) => ({ name: s.ruleName || "维度", score: Number(s.score) || 0, maxScore: 100 }))} />
                <div className="pr-radar-list">
                  {overallScores.map((s, i) => (
                    <div className="pr-radar-item" key={i}>
                      <span>{s.ruleName || `维度${i + 1}`}</span>
                      <b>{s.score}</b>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 表现反馈 */}
          {(detail.highlights?.length || detail.weaknesses?.length || detail.suggestions?.length) && (
            <>
              <div className="pr-sec-title">
                <i></i>
                表现反馈
              </div>
              <div className="pr-feedback-grid">
                {(detail.highlights?.length > 0 || detail.suggestions?.length > 0) && (
                  <div className="pr-fb-card good">
                    <h4>表现较好</h4>
                    <ul>
                      {(detail.highlights?.length ? detail.highlights : detail.suggestions).slice(0, 3).map((t: string, i: number) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.weaknesses?.length > 0 && (
                  <div className="pr-fb-card warn">
                    <h4>提升建议</h4>
                    <ul>
                      {detail.weaknesses.slice(0, 3).map((t: string, i: number) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 本次整体成绩 */}
          <div className="pr-final-score">
            <b>{score}</b>
            <span>本次整体成绩</span>
            <PassTag passed={passed} />
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
                <div className="pr-trn ai" key={t.key}>
                  <span className="pr-trn-avatar ai" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="1.7">
                      <rect x="4.5" y="7" width="15" height="11" rx="3.2" />
                      <circle cx="9.2" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                      <circle cx="14.8" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                      <path d="M12 4.5v2.5" />
                      <circle cx="12" cy="3.6" r="1.1" fill="#fff" stroke="none" />
                    </svg>
                  </span>
                  <div className="pr-trn-main">
                    <span className="pr-trn-time">{fmtTime(detail.record?.startedAt)}</span>
                    <div className="pr-trn-bubble ai">{t.text}</div>
                  </div>
                </div>
              );
            }
            return (
              <div className="pr-trn-wrap" key={t.key}>
                <div className="pr-trn user">
                  <div className="pr-trn-main">
                    <span className="pr-trn-time">{fmtTime(detail.record?.startedAt)}</span>
                    <div className="pr-trn-bubble user">
                      <span className="pr-trn-wave" aria-hidden="true">
                        <i></i>
                        <i></i>
                        <i></i>
                      </span>
                      {t.text}
                    </div>
                  </div>
                  <span className="pr-trn-avatar user" aria-hidden="true"></span>
                </div>
                <div className="pr-trn-feedback">
                  <div className="pr-feedback-head">
                    <b>实时点评</b>
                    <span>{t.turnTotal != null ? `${t.turnTotal}分` : "—"}</span>
                  </div>
                  {t.reasons && t.reasons.length > 0 && (
                    <div className="pr-feedback-sec">
                      <span>评分依据</span>
                      <p>{t.reasons.join("；")}</p>
                    </div>
                  )}
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
