"use client";

import { useState } from "react";
import type { ExamRecord } from "@/lib/sceneProgress";
import MobilePageAction from "./MobilePageAction";
import UnifiedTabs from "./UnifiedTabs";

interface ExamReportProps {
  record: ExamRecord;
  sceneName: string;
  taskName?: string;
  onClose: () => void;
}

/** 格式化 ISO 时间为 YYYY-MM-DD HH:mm（参考图格式） */
function fmtTimeFull(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 环形进度（绿色，考试报告） */
function RingProgress({ value, size = 80, stroke = 6, color = "#27ae60" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(Math.max(value, 0), 100) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f2f3f5" strokeWidth={stroke} />
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

/** 合格/未合格标签 */
function PassTag({ passed }: { passed: boolean }) {
  return <span className={`er-tag ${passed ? "ok" : "no"}`}>{passed ? "合格" : "未合格"}</span>;
}

/** 点评文本 → 问题定位 + 改进建议（启发式拆分，兼容任意 comment 内容） */
function splitComment(comment: string): { issue: string; advice: string } {
  const c = (comment || "").trim();
  if (!c) return { issue: "", advice: "" };
  const m = c.match(/(.+?)[；;。]\s*建议[:：]?\s*(.+)$/);
  if (m) return { issue: m[1], advice: m[2] };
  const m2 = c.match(/^建议[:：]?\s*(.+)$/);
  if (m2) return { issue: "", advice: m2[1] };
  return { issue: c, advice: "" };
}

/** 场景考试报告：考试报告 + 对话记录 双 tab（参考图一比一还原） */
export default function ExamReport({ record, sceneName, taskName, onClose }: ExamReportProps) {
  const [tab, setTab] = useState<"report" | "transcript">("report");
  const score = record?.score ?? 0;
  const passScore = record?.passScore ?? 60;
  const passed = record?.passed ?? score >= passScore;
  const rounds = record?.rounds ?? [];
  const subTitle = taskName ? `${taskName}·${sceneName}` : sceneName;

  return (
    <div className="er-shell">
      {/* ===== 顶部导航 ===== */}
      <header className="er-head">
        <MobilePageAction kind="back" variant="immersive" onClick={onClose} />
        <div className="er-head-text">
          <h1>场景考试报告</h1>
          <p>{subTitle}</p>
        </div>
        <MobilePageAction kind="close" variant="immersive" onClick={onClose} aria-label="关闭报告" />
      </header>

      {/* ===== 顶部得分区 ===== */}
      <div className="er-score">
        <div className="er-score-num">
          <b>{score}</b>
          <span>分</span>
        </div>
        <div className="er-score-meta">
          <span>本次考试成绩</span>
          <em>{fmtTimeFull(record?.finishedAt)}</em>
        </div>
      </div>

      {/* ===== Tab ===== */}
      <UnifiedTabs
        ariaLabel="场景考试报告内容"
        className="unified-tabs--report"
        items={[
          { value: "report", label: "考试报告" },
          { value: "transcript", label: "对话记录" },
        ]}
        onChange={setTab}
        value={tab}
      />

      {tab === "report" ? (
        /* ===== 考试报告 tab ===== */
        <div className="er-report-body">
          {/* 评估标题区 */}
          <div className="er-eval-head">
            <div className="er-eval-text">
              <h3>本次考试评估</h3>
              <p>共完成{rounds.length || 3}轮正式考试对话，系统已生成综合报告</p>
            </div>
            <PassTag passed={passed} />
          </div>

          {/* 综合得分卡 */}
          <div className="er-total-card">
            <div className="er-ring">
              <RingProgress value={score} color={passed ? "#27ae60" : "#f5a623"} />
              <div className="er-ring-center">
                <b>{score}</b>
                <span>综合得分</span>
              </div>
            </div>
            <div className="er-total-text">
              <b>{passed ? "达到考试合格要求" : "未达到考试合格要求"}</b>
              <p>本次考试共完成{rounds.length || 3}轮正式对话，以下为整体表现分析。</p>
              <div className="er-total-status">
                <span>
                  完成轮次 <em>{rounds.length || "-"}</em>
                </span>
                <span className="er-dot"></span>
                <span>
                  考试状态 <em className={passed ? "ok" : "no"}>{passed ? "合格" : "未合格"}</em>
                </span>
              </div>
            </div>
          </div>

          {/* 考试整体总结 */}
          <div className="er-card">
            <div className="er-card-title">
              <i></i>
              考试整体总结
            </div>
            <p className="er-card-body">
              本次考试围绕场景目标完成{rounds.length || 3}轮正式对话，系统已记录每轮回答表现与整体合格状态。通过线为 {passScore} 分，本轮综合得分 {score} 分。
            </p>
          </div>

          {/* 考试合格状态 */}
          <div className="er-card">
            <div className="er-card-title">
              <i></i>
              考试合格状态
            </div>
            <div className="er-pass-row">
              <span>
                {score} ·
              </span>
              <PassTag passed={passed} />
            </div>
          </div>

          <button className="er-close-btn" type="button" onClick={onClose}>
            关闭报告
          </button>
        </div>
      ) : (
        /* ===== 对话记录 tab ===== */
        <div className="er-transcript">
          <div className="er-tip">{record?.mode === "text" ? "文本形式考试：逐题作答，提交后自动评分" : "语音形式考试：实时听写，静音后自动提交"}</div>

          {rounds.length === 0 ? (
            <div className="er-empty">暂无对话记录</div>
          ) : (
            rounds.map((r) => {
              const { issue, advice } = splitComment(r.comment);
              return (
                <div className="er-turn" key={r.round}>
                  {/* AI 提问 */}
                  <div className="er-msg ai">
                    <span className="er-avatar ai" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="1.7">
                        <rect x="4.5" y="7" width="15" height="11" rx="3.2" />
                        <circle cx="9.2" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                        <circle cx="14.8" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                        <path d="M12 4.5v2.5" />
                        <circle cx="12" cy="3.6" r="1.1" fill="#fff" stroke="none" />
                        <path d="M7 16.6h.01M11.5 16.6h.01M16 16.6h.01" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                    <div className="er-msg-main">
                      <span className="er-time">{fmtTimeFull(record?.finishedAt)}</span>
                      <div className="er-bubble ai">{r.question}</div>
                    </div>
                  </div>

                  {/* 学员回答 */}
                  <div className="er-msg user">
                    <span className="er-avatar user" aria-hidden="true"></span>
                    <div className="er-msg-main">
                      <span className="er-time">{fmtTimeFull(record?.finishedAt)}</span>
                      <div className="er-bubble user">
                        <span className="er-wave" aria-hidden="true">
                          <i></i>
                          <i></i>
                          <i></i>
                          <i></i>
                        </span>
                        {r.answer}
                      </div>
                    </div>
                  </div>

                  {/* 点评卡 */}
                  <div className="er-fb">
                    <div className="er-fb-head">
                      <b>本次回答反馈</b>
                      <span>{r.score}分</span>
                    </div>
                    {(issue || advice) && (
                      <>
                        <div className="er-fb-divider"></div>
                        {issue && (
                          <div className="er-fb-row">
                            <em>问题定位：</em>
                            {issue}
                          </div>
                        )}
                        {advice && (
                          <div className="er-fb-row">
                            <em>改进建议：</em>
                            {advice}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}

          <button className="er-close-btn" type="button" onClick={onClose}>
            关闭报告
          </button>
        </div>
      )}
    </div>
  );
}
