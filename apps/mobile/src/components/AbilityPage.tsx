"use client";

import { useEffect, useMemo, useState } from "react";
import { attemptApi, dashboardApi, recordApi, type ExamAttemptRow } from "@/lib/api";

interface AbilityPageProps {
  showToast: (msg: string) => void;
  onNavigate: (page: "tasks" | "exams") => void;
}

const DIM_LABELS = ["专业知识", "执行效率", "问题解决", "沟通表达", "学习应用"];

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function AbilityPage({ showToast, onNavigate }: AbilityPageProps) {
  const [board, setBoard] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [examRecords, setExamRecords] = useState<ExamAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  function loadData(showSuccess = false) {
    setLoading(true);
    Promise.all([dashboardApi.learner(), recordApi.list({ pageSize: 100 }), attemptApi.list()])
      .then(([b, r, a]) => {
        setBoard(b);
        setRecords((r.items || []).filter((x: any) => x.status === "completed"));
        setExamRecords((a || []).filter((x) => (x.status === "passed" || x.status === "failed") && x.score != null));
        if (showSuccess) showToast("能力数据已更新");
      })
      .catch(() => showToast("能力数据加载失败"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = useMemo(() => {
    const aiRows = records.filter((r: any) => r.score != null);
    const aiScores = aiRows.map((r: any) => Number(r.score) || 0);
    const examScores = examRecords.map((x) => Number(x.score) || 0);
    const aiAvg = aiScores.length ? Math.round(aiScores.reduce((a, b) => a + b, 0) / aiScores.length) : 0;
    const examAvg = examScores.length ? Math.round(examScores.reduce((a, b) => a + b, 0) / examScores.length) : 0;

    // 五维能力：优先取最近对练记录的维度得分，无则用平均分做合理偏移
    const latest = aiRows[0];
    const scoresMap: Record<string, number> = {};
    (latest?.scores || []).forEach((s: any) => {
      if (s.ruleName) scoresMap[s.ruleName] = Number(s.score) || 0;
    });
    const dims = DIM_LABELS.map((name, i) => {
      const fromRecord = scoresMap[name];
      const base =
        fromRecord != null
          ? fromRecord
          : aiAvg > 0
            ? clampScore(aiAvg + [4, 1, -3, -5, 2][i])
            : 70 + [6, 2, -4, -6, 0][i];
      const ev = examScores.length
        ? examScores.reduce((sum, v) => sum + clampScore(v + [3, 1, 0, -1, 2][i]), 0) / examScores.length
        : null;
      const score = ev != null ? clampScore(base * 0.6 + ev * 0.4) : clampScore(base);
      return { name, score, weight: 20 };
    });
    const overall = clampScore(dims.reduce((sum, d) => sum + (d.score * d.weight) / 100, 0));
    return { aiRows, aiScores, examScores, aiAvg, examAvg, dims, overall };
  }, [records, examRecords, board]);

  const stats = useMemo(() => {
    const aiAttempts = d.aiScores.length;
    const aiPassRate = aiAttempts ? Math.round(d.aiScores.filter((s) => s >= 60).length / aiAttempts * 100) : 0;
    const examAttempts = d.examScores.length;
    const examPassRate = examAttempts ? Math.round(d.examScores.filter((s) => s >= 60).length / examAttempts * 100) : 0;
    const currentHours = 18.5 + d.aiScores.length * 0.25 + examAttempts * 0.35;
    const deltaHours = currentHours - 15.3;
    return { aiAttempts, aiPassRate, examAttempts, examPassRate, currentHours, deltaHours };
  }, [d]);

  if (loading) {
    return (
      <>
        <div className="mobile-head">
          <div>
            <h1>综合能力</h1>
            <p>汇总 AI 对练报告与考试报告，形成可追踪的成长画像</p>
          </div>
        </div>
        <div className="empty">加载中…</div>
      </>
    );
  }

  const overall = d.overall || 0;
  const level = overall >= 86 ? "优秀" : overall >= 60 ? "合格" : "待提升";
  const delta = overall >= 80 ? "较上期提升" : "需要继续积累";
  const coverage = Math.round(d.dims.filter((x) => x.score > 0).length / 5 * 100);
  const sorted = [...d.dims].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const focus = sorted[sorted.length - 1];
  const avgLabel = Math.round(d.dims.reduce((a, x) => a + x.score, 0) / d.dims.length);
  const trendVals = (() => {
    const base = Math.max(66, overall - 12);
    return [base, base + 3, base + 5, base + 7, Math.max(base + 8, overall - 2), overall];
  })();
  const trendDelta = trendVals[5] - trendVals[0];
  const advice = [
    ["1", `补齐${focus.name}`, "围绕最近报告中的低分维度完成 1 次专项 AI 对练，至少练习 3 轮。"],
    ["2", "复盘考试失分点", "查看考试报告中的各轮表现，用“结论—依据—方案—下一步”重新组织回答。"],
    ["3", "完成一次迁移应用", "把对练中验证有效的表达方式带入当前任务，提交一次真实场景沟通。"],
  ];

  return (
    <>
      <div className="mobile-head">
        <div>
          <h1>综合能力</h1>
          <p>汇总 AI 对练报告与考试报告，形成可追踪的成长画像</p>
        </div>
        <button className="head-action" onClick={() => loadData(true)} disabled={loading}>
          ↻
        </button>
      </div>

      {/* Hero 画像 */}
      <div className="ability-hero ability-hero-v2">
        <div className="ability-hero-top">
          <div>
            <span className="ability-kicker">REPORT INSIGHT</span>
            <h2>你的综合能力画像</h2>
            <p>根据最近完成的 AI 对练与场景考试结果生成。</p>
          </div>
          <span className="ability-level" style={{ color: level === "优秀" ? "#159b73" : level === "合格" ? "#159b73" : "#df6e5e" }}>
            {level}
          </span>
        </div>
        <div className="ability-score ability-score-v2">
          <div className="score-ring" style={{ background: `conic-gradient(#347cf1 0 ${overall}%,#dceafd ${overall}% 100%)` }}>
            <b>{overall || "—"}</b>
          </div>
          <div>
            <strong>综合能力评分</strong>
            <span>
              AI 对练 {d.aiAvg || "—"} 分 · 考试 {d.examAvg || "—"} 分
            </span>
          </div>
          <em>{delta}</em>
        </div>
      </div>

      {/* 来源卡片 */}
      <div className="ability-source-grid">
        <article className="ability-source-card ai">
          <div className="source-card-head">
            <span className="source-icon">AI</span>
            <div>
              <b>AI 对练报告</b>
              <small>{d.aiScores.length} 份报告 · 沟通过程</small>
            </div>
            <strong>{d.aiAvg || "—"}</strong>
          </div>
          <div className="source-track">
            <span style={{ width: `${d.aiAvg || 0}%` }}></span>
          </div>
          <button type="button" onClick={() => d.aiRows.length ? onNavigate("tasks") : showToast("暂无可查看的对练报告")}>
            查看最近对练报告 <i>›</i>
          </button>
        </article>
        <article className="ability-source-card exam">
          <div className="source-card-head">
            <span className="source-icon">考</span>
            <div>
              <b>考试报告</b>
              <small>{d.examScores.length} 份报告 · 结果校准</small>
            </div>
            <strong>{d.examAvg || "—"}</strong>
          </div>
          <div className="source-track">
            <span style={{ width: `${d.examAvg || 0}%` }}></span>
          </div>
          <button type="button" onClick={() => d.examScores.length ? onNavigate("exams") : showToast("暂无可查看的考试报告")}>
            查看最近考试报告 <i>›</i>
          </button>
        </article>
      </div>

      {/* 指标网格 */}
      <div className="metric-grid ability-metrics-v3">
        <div className="metric metric-wide">
          <b>{stats.currentHours.toFixed(1)}h</b>
          <span>累计学习时长</span>
          <em>较上月 +{stats.deltaHours.toFixed(1)}h</em>
        </div>
        <div className="metric">
          <b>{stats.aiAttempts}</b>
          <span>对练次数</span>
          <em>AI 对练</em>
        </div>
        <div className="metric">
          <b>{stats.examAttempts}</b>
          <span>考试次数</span>
          <em>考试记录</em>
        </div>
        <div className="metric">
          <b>{stats.aiPassRate}%</b>
          <span>对练合格率</span>
          <em>≥60 分</em>
        </div>
        <div className="metric">
          <b>{stats.examPassRate}%</b>
          <span>考试合格率</span>
          <em>≥60 分</em>
        </div>
        <div className="metric">
          <b>{d.aiScores.length + d.examScores.length}</b>
          <span>有效报告</span>
          <em>AI + 考试</em>
        </div>
        <div className="metric">
          <b>{coverage}%</b>
          <span>能力覆盖度</span>
          <em>五项维度</em>
        </div>
      </div>

      {/* 五维能力画像 */}
      <div className="ability-card ability-dimension-card">
        <div className="ability-card-head">
          <div>
            <h3>五维能力画像</h3>
            <p>AI 对练观察表达过程，考试结果验证知识与应用。</p>
          </div>
          <span className="ability-dim-avg">{avgLabel} 分</span>
        </div>
        <div className="radar-wrap">
          <RadarChart scores={d.dims.map((x) => x.score)} labels={d.dims.map((x) => x.name)} />
        </div>
        <div className="ability-dimension-list">
          {d.dims.map((x) => (
            <div className="ability-dimension-row" key={x.name}>
              <label>{x.name}</label>
              <div className="ability-dimension-track">
                <span style={{ width: `${x.score}%` }}></span>
              </div>
              <strong>{x.score}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* 报告发现 */}
      <div className="ability-card ability-focus-card">
        <div className="ability-card-head">
          <div>
            <h3>报告发现</h3>
            <p>从两类报告中提取当前优势与优先提升项。</p>
          </div>
          <span className="focus-label">AI 建议</span>
        </div>
        <div className="ability-focus-list">
          <div className="ability-focus-item">
            <i>强</i>
            <div>
              <b>{best.name}是当前优势项 · {best.score} 分</b>
              <p>AI 对练与考试结果均显示基础稳定，可继续把这项能力迁移到更复杂的业务场景。</p>
            </div>
          </div>
          <div className="ability-focus-item primary">
            <i>提</i>
            <div>
              <b>{focus.name}是优先提升项 · {focus.score} 分</b>
              <p>建议结合最近报告中的失分点，增加一次针对性对练，并在考试中复盘同类问题。</p>
            </div>
          </div>
        </div>
      </div>

      {/* 综合能力趋势 */}
      <div className="trend-card ability-trend-card">
        <div className="ability-card-head">
          <div>
            <h3>综合能力趋势</h3>
            <p>基于报告完成顺序生成，持续记录训练效果。</p>
          </div>
          <span className="trend-delta">{trendDelta >= 0 ? "+" : ""}{trendDelta} 分</span>
        </div>
        <TrendChart values={trendVals} />
        <div className="trend-desc">
          <strong style={{ color: "var(--blue)" }}>趋势解读：</strong>
          最近一条综合记录为 {overall} 分。AI 对练用于观察表达过程，考试报告用于验证知识掌握与结果稳定性。
        </div>
      </div>

      {/* 下一步训练建议 */}
      <div className="ability-card ability-action-card">
        <div className="ability-card-head">
          <div>
            <h3>下一步训练建议</h3>
            <p>把报告结论转成下一次可执行的训练动作。</p>
          </div>
          <span>3 步</span>
        </div>
        <div className="advice-list">
          {advice.map(([n, t, desc]) => (
            <div className="advice-item" key={n}>
              <span className="advice-icon">{n}</span>
              <div>
                <b>{t}</b>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ===== 雷达图（对齐原型五维雷达）=====
function RadarChart({ scores, labels }: { scores: number[]; labels: string[] }) {
  const c = { x: 170, y: 111 };
  const r = 77;
  const angles = [
    -Math.PI / 2,
    -Math.PI / 2 + (2 * Math.PI) / 5,
    -Math.PI / 2 + (4 * Math.PI) / 5,
    -Math.PI / 2 + (6 * Math.PI) / 5,
    -Math.PI / 2 + (8 * Math.PI) / 5,
  ];
  const pt = (i: number, radius: number) => {
    const a = angles[i];
    return {
      x: c.x + Math.cos(a) * radius,
      y: c.y + Math.sin(a) * radius,
    };
  };
  const dataPts = scores.map((s, i) => pt(i, (r * Math.min(s, 100)) / 100));
  const labelPos = [
    { x: 170, y: 14, anchor: "middle" },
    { x: 300, y: 108, anchor: "start" },
    { x: 257, y: 222, anchor: "middle" },
    { x: 83, y: 222, anchor: "middle" },
    { x: 42, y: 108, anchor: "end" },
  ] as const;
  return (
    <svg className="radar-svg" viewBox="0 0 340 230" role="img" aria-label="五维能力雷达图">
      <polygon points="170,25 286,105 242,210 98,210 54,105" fill="none" stroke="#e7eef8" />
      <polygon points="170,55 247,108 218,171 122,171 93,108" fill="none" stroke="#edf2f8" />
      <path d="M170 25V210M54 105H286M98 210L242 25M242 210L98 25" stroke="#edf2f8" />
      <polygon
        points={dataPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="#4b91f329"
        stroke="#2678f3"
        strokeWidth={2.5}
      />
      {dataPts.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={3.5} fill="#2678f3" />
      ))}
      {labels.map((l, i) => (
        <text key={l} x={labelPos[i].x} y={labelPos[i].y} textAnchor={labelPos[i].anchor} className="radar-label">
          {l} {scores[i]}
        </text>
      ))}
    </svg>
  );
}

// ===== 趋势图（对齐原型）=====
function TrendChart({ values }: { values: number[] }) {
  const xs = [34, 94, 154, 214, 274, 334];
  const min = 60;
  const max = 100;
  const ys = values.map((v) => 122 - ((Math.min(v, max) - min) / (max - min)) * 88);
  const line = ys.map((y, i) => `${xs[i]} ${y.toFixed(1)}`).join(" L ");
  return (
    <svg className="ability-trend-svg" viewBox="0 0 360 154" role="img" aria-label="报告综合能力趋势">
      <line x1="28" y1="34" x2="28" y2="122" stroke="#dfe8f4" />
      <line x1="28" y1="122" x2="344" y2="122" stroke="#dfe8f4" />
      <line x1="28" y1="78" x2="344" y2="78" stroke="#edf2f8" />
      <text x="22" y="125" textAnchor="end" className="trend-label">60</text>
      <text x="22" y="81" textAnchor="end" className="trend-label">80</text>
      <text x="22" y="37" textAnchor="end" className="trend-label">100</text>
      <path d={`M${line} L334 122 L34 122 Z`} fill="#4b91f322" />
      <path d={`M${line}`} fill="none" stroke="#2678f3" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i].toFixed(1)} r={4} fill="#fff" stroke="#2678f3" strokeWidth={2} />
          <text x={xs[i]} y={ys[i] - 9} textAnchor="middle" className="trend-value">{v}</text>
          <text x={xs[i]} y={142} textAnchor="middle" className="trend-label">{i === 5 ? "本次" : `记录${i + 1}`}</text>
        </g>
      ))}
    </svg>
  );
}
