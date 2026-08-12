"use client";

import type { ExamRecord } from "@/lib/sceneProgress";

interface ExamReportProps {
  record: ExamRecord;
  sceneName: string;
  onClose: () => void;
}

/** 格式化 ISO 时间为 MM月DD日 HH:mm */
function fmtTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 考试报告：总分 + 通过状态 + 逐轮评分 */
export default function ExamReport({ record, sceneName, onClose }: ExamReportProps) {
  const score = record?.score ?? 0;
  const passed = record?.passed ?? score >= (record?.passScore ?? 60);
  const rounds = record?.rounds ?? [];
  const avgRounds = rounds.length
    ? Math.round(rounds.reduce((a, r) => a + (Number(r.score) || 0), 0) / rounds.length)
    : score;

  return (
    <div className="pr-shell">
      {/* ===== 头部 ===== */}
      <header className="pr-head">
        <div className="pr-head-text">
          <h1>场景考试报告</h1>
          <p>{sceneName}</p>
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
          <span>本次考试综合成绩</span>
          <em>{fmtTime(record?.finishedAt)}</em>
        </div>
      </div>

      {/* ===== 结论卡 ===== */}
      <div className="pr-section-head">
        <h3>本次考试评估</h3>
        <span className={`pr-pass-tag ${passed ? "ok" : "no"}`}>{passed ? "合格" : "未合格"}</span>
      </div>
      <div className="pr-total-card">
        <div className="pr-ring-wrap">
          <div className="pr-ring">
            <div className="pr-ring-center">
              <b>{score}</b>
              <span>综合得分</span>
            </div>
          </div>
        </div>
        <div className="pr-total-text">
          <b>{passed ? "表现达到合格要求，继续保持" : "未达到通过线，建议加强对练后重新考试"}</b>
          <p>满分 100 分，通过线 {record?.passScore ?? 60} 分。系统按每轮回答要点与表达质量综合评分。</p>
          <div className="pr-total-stats">
            <span>
              轮均分 <b>{avgRounds}</b>
            </span>
            <span>
              作答轮数 <b>{rounds.length || "-"}</b>
            </span>
          </div>
        </div>
      </div>

      {/* ===== 逐轮评分 ===== */}
      <div className="pr-sec-title">
        <i></i>
        逐轮评分
      </div>
      {rounds.length === 0 ? (
        <div className="pr-empty">暂无作答记录</div>
      ) : (
        rounds.map((r) => (
          <div className="pr-dim-card" key={r.round}>
            <div className="pr-dim-top">
              <span className="pr-dim-dot" style={{ background: r.score >= 85 ? "#10b981" : r.score >= 70 ? "#3b82f6" : "#f59e0b" }}></span>
              <b>第 {r.round} 轮</b>
              <span className="pr-dim-weight">综合考察</span>
              <span className="pr-dim-score">{r.score}</span>
            </div>
            <div className="pr-dim-bar">
              <i className={r.score >= 80 ? "good" : "warn"} style={{ width: `${Math.min(Math.max(r.score, 0), 100)}%` }}></i>
            </div>
            <p className="pr-dim-desc">
              <b style={{ color: "#334155" }}>问题：</b>
              {r.question}
            </p>
            <p className="pr-dim-desc">
              <b style={{ color: "#334155" }}>回答：</b>
              {r.answer}
            </p>
            <p className="pr-dim-desc">
              <b style={{ color: "#334155" }}>点评：</b>
              {r.comment}
            </p>
          </div>
        ))
      )}

      {/* ===== 本次整体成绩 ===== */}
      <div className="pr-final-score">
        <b>{score}</b>
        <span>本次整体成绩</span>
        <span className={`pr-pass-tag ${passed ? "ok" : "no"}`}>{passed ? "合格" : "未合格"}</span>
      </div>

      <button className="pr-close-report" type="button" onClick={onClose}>
        关闭报告
      </button>
    </div>
  );
}
