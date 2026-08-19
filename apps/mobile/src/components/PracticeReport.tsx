"use client";

import { useEffect, useMemo, useState } from "react";
import { recordApi } from "@/lib/api";
import PracticeChat, { type PracticeChatMsg } from "./PracticeChat";
import MobilePageAction from "./MobilePageAction";

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

  // 对话记录 tab：把历史 turns/turnScores 转成 AI 对练页同款消息列表，渲染时直接复用 PracticeChat。
  // 当 turnScores 为空（实时评分超时导致）时，使用 overallScores（整场评分）在最后一轮兜底展示。
  const transcriptMessages = useMemo<PracticeChatMsg[]>(() => {
    if (!detail) return [];
    const turnScores: Array<{ roundNo: number; scores: TranscriptTurnScore[] }> = detail.turnScores ?? [];
    const suggestions: string[] = Array.isArray(detail.suggestions) ? detail.suggestions : [];
    const messages: PracticeChatMsg[] = [];
    let learnerIdx = 0;
    const totalTurns = (detail.turns ?? []).filter((t: any) => t.speaker === "learner").length;
    const hasAnyTurnScores = turnScores.length > 0;

    (detail.turns ?? []).forEach((t: any, i: number) => {
      const time = fmtChatTime(t.startedAt || detail.record?.startedAt);
      const text = t.text || "";
      if (t.speaker === "ai") {
        messages.push({ id: `turn-${i}-ai`, who: "ai", text, time });
        return;
      }

      if (t.speaker !== "learner") return;
      learnerIdx += 1;
      messages.push({ id: `turn-${i}-learner`, who: "user", text, time, isVoice: Number(t.durationMs) > 0 });

      // 优先使用 turnScores（每轮评分），兜底使用 overallScores（整场评分，仅在最后一轮展示）
      let dimensions: Array<{ name: string; score: number; maxScore: number; level: "excellent" | "pass" | "developing"; reason: string }> = [];
      if (hasAnyTurnScores) {
        const ts = turnScores.find((x) => x.roundNo === learnerIdx);
        dimensions =
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
      } else if (learnerIdx === totalTurns && (detail.scores ?? []).length > 0) {
        // 兜底：turnScores 为空时，在最后一轮展示整场评分
        dimensions = (detail.scores ?? []).map((s: { ruleName?: string | null; score: number | null; level?: string | null; deductionReason?: string }) => ({
          name: s.ruleName || "评分维度",
          score: Number(s.score) || 0,
          maxScore: 100,
          level: normalizeLevel(Number(s.score) || 0, 100, s.level || undefined),
          reason: s.deductionReason || "",
        }));
      }

      const turnTotal = dimensions.length ? dimensions.reduce((a, s) => a + (Number(s.score) || 0), 0) : null;
      const issues = dimensions.map((s) => s.reason).filter(Boolean);
      const advice = suggestions[learnerIdx - 1] ? [suggestions[learnerIdx - 1]] : suggestions[0] ? [suggestions[0]] : [];

      if (turnTotal != null || dimensions.length > 0 || issues.length > 0 || advice.length > 0) {
        messages.push({
          id: `turn-${i}-feedback`,
          who: "feedback",
          text: advice.join("；"),
          score: turnTotal,
          dimensions,
          issues,
          advice,
        });
      }
    });

    return messages;
  }, [detail]);


  // 历史记录入口（recordId）：直接拉取详情，加载期间仅显示轻量加载提示，不出现"生成报告中"中转弹窗
  if (recordId && !detail && !failed) {
    return (
      <div className="pr-shell">
        <div className="pr-light-loading" role="status" aria-live="polite">
          <div className="pr-light-spinner" />
          <p>正在加载报告…</p>
        </div>
      </div>
    );
  }

  // 中转页：仅 sessionId 模式（刚练完、后台异步评分轮询中）显示"生成报告中"
  if (!recordId && sessionId && !detail && !failed) {
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
      {/* ===== 顶部导航（复用任务详情返回样式） ===== */}
      <header className="pr-head">
        <MobilePageAction kind="back" onClick={onClose} />
        <div className="pr-head-text">
          <h1>AI对练报告</h1>
          <p>{subTitle}</p>
        </div>
        <MobilePageAction kind="close" variant="overlay" onClick={onClose} aria-label="关闭报告" />
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
      ) : transcriptMessages.length === 0 ? (
        /* ===== 对话记录 tab ===== */
        <div className="pr-transcript">
          <div className="pr-empty">暂无对话记录</div>
        </div>
      ) : (
        /* ===== 对话记录 tab：直接复用 AI 对练页对话记录 ===== */
        <PracticeChat messages={transcriptMessages} />
      )}
    </div>
  );
}
