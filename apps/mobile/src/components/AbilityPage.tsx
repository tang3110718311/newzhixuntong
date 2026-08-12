"use client";

import { useEffect, useState } from "react";
import { dashboardApi, recordApi } from "@/lib/api";

interface AbilityPageProps {
  showToast: (msg: string) => void;
}

export default function AbilityPage({ showToast }: AbilityPageProps) {
  const [board, setBoard] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([dashboardApi.learner(), recordApi.list({ pageSize: 100 })])
      .then(([b, r]) => {
        setBoard(b);
        setRecords(r.items || []);
      })
      .catch(() => showToast("能力数据加载失败"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <>
        <div className="mobile-head">
          <div>
            <h1>综合能力</h1>
            <p>根据任务、对练与考试结果形成个人成长画像</p>
          </div>
        </div>
        <div className="empty">加载中…</div>
      </>
    );
  }

  const avg = board?.examAverage ?? 0;
  const rank = board?.achievements?.rank ?? 0;
  const totalRecords = board?.achievements?.total ?? records.length;
  const passed = records.filter((r) => r.passed === 1).length;
  const completion = records.length ? Math.round((passed / records.length) * 100) : 0;
  const weakPoints = board?.weakPoints || [];
  const insights = board?.insight;

  return (
    <>
      <div className="mobile-head">
        <div>
          <h1>综合能力</h1>
          <p>根据任务、对练与考试结果形成个人成长画像</p>
        </div>
        <button className="head-action" onClick={() => showToast("能力数据已更新")}>
          ↻
        </button>
      </div>
      <div className="ability-hero">
        <h2>你的学习能力持续提升</h2>
        <p>
          已完成 {totalRecords} 项训练内容，任务完成质量和沟通表达能力持续提升。
        </p>
        <div className="ability-score">
          <div className="score-ring">
            <b>{Math.round(avg) || 0}</b>
          </div>
          <span>
            综合能力评分
            <br />
            当前平均 {Math.round(avg) || 0} 分
          </span>
        </div>
      </div>
      <div className="metric-grid">
        <div className="metric">
          <b>{totalRecords}</b>
          <span>累计完成训练</span>
        </div>
        <div className="metric">
          <b>{completion}%</b>
          <span>任务完成率</span>
        </div>
        <div className="metric">
          <b>{rank || 0}</b>
          <span>同岗位排名</span>
        </div>
        <div className="metric">
          <b>{board?.achievements?.streak ?? 0}</b>
          <span>连续学习天数</span>
        </div>
      </div>

      <div className="ability-card">
        <h3>能力维度</h3>
        <div className="radar-wrap">
          <RadarChart scores={[avg * 0.9, avg, avg * 0.85, avg * 0.95, avg * 0.88]} />
        </div>
      </div>

      {weakPoints.length > 0 && (
        <div className="ability-card">
          <h3>存在问题总结</h3>
          <div className="issue-list">
            {weakPoints.map((w: any, i: number) => (
              <div className="issue-item" key={i}>
                <span className="issue-num">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <b>{w.title}</b>
                  <p>
                    {w.suggestion}（场景：{w.scene}）
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="trend-card">
        <h3 style={{ fontSize: 14, margin: 0 }}>训练记录趋势</h3>
        <TrendChart records={records} />
      </div>

      <div className="ability-card">
        <h3>下一步成长建议</h3>
        <div className="advice-overall">
          <strong>总体建议：</strong>
          {insights?.text || "围绕“需求分析—专业表达—场景应用”建立连续训练闭环，优先补齐薄弱能力，再将已掌握的知识迁移到真实任务中。"}
        </div>
        <div className="advice-list">
          {weakPoints.map((w: any, i: number) => (
            <div className="advice-item" key={i}>
              <span className="advice-icon">{i + 1}</span>
              <div>
                <b>强化{w.title}</b>
                <p>{w.suggestion}</p>
              </div>
            </div>
          ))}
          {weakPoints.length === 0 && (
            <div className="advice-item">
              <span className="advice-icon">1</span>
              <div>
                <b>保持训练节奏</b>
                <p>持续完成派发任务与对练，巩固当前能力水平。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ===== 雷达图 =====
function RadarChart({ scores }: { scores: number[] }) {
  const labels = ["专业知识", "执行效率", "问题解决", "沟通表达", "学习应用"];
  const cx = 170;
  const cy = 118;
  const R = 68;
  const angle = (i: number) => (Math.PI * 2 * i) / 5 - Math.PI / 2;
  const pt = (i: number, r: number) => {
    const a = angle(i);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  };
  const outer = labels.map((_, i) => pt(i, R)).join(" ");
  const inner = labels.map((_, i) => pt(i, R * 0.7)).join(" ");
  const data = scores
    .map((s, i) => pt(i, (s / 100) * R))
    .join(" ");
  return (
    <svg className="radar-svg" viewBox="0 0 340 230" role="img" aria-label="能力维度雷达图">
      <polygon points={outer} fill="none" stroke="#e7eef8" strokeWidth={1} />
      <polygon points={inner} fill="none" stroke="#e7eef8" strokeWidth={1} />
      {[0, 1, 2, 3, 4].map((i) => {
        const p1 = pt(i, R);
        const [x1, y1] = p1.split(",").map(Number);
        return <line key={i} x1={cx} y1={cy} x2={x1} y2={y1} stroke="#edf2f8" strokeWidth={1} />;
      })}
      <polygon points={data} fill="#4b91f329" stroke="#2678f3" strokeWidth={2.5} />
      {scores.map((s, i) => {
        const [x, y] = pt(i, (s / 100) * R).split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r={4} fill="#2678f3" />;
      })}
      {labels.map((l, i) => {
        const [x, y] = pt(i, R + 14).split(",").map(Number);
        const anchor = Math.abs(x - cx) < 8 ? "middle" : x < cx ? "end" : "start";
        return (
          <text key={l} x={x} y={y} textAnchor={anchor} className="radar-label" fontSize={12} fill="#536782" fontWeight={600}>
            {l}
          </text>
        );
      })}
      {scores.map((s, i) => {
        const [x, y] = pt(i, (s / 100) * R - 10).split(",").map(Number);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" className="radar-score" fontSize={12} fill="#2678f3" fontWeight={800}>
            {Math.round(s)}
          </text>
        );
      })}
    </svg>
  );
}

// ===== 趋势图 =====
function TrendChart({ records }: { records: any[] }) {
  const recent = records.slice(-6);
  const max = 100;
  const min = 50;
  const W = 360;
  const H = 150;
  const padL = 32;
  const padR = 20;
  const padT = 20;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const pts = recent.map((r, i) => ({
    x: padL + (innerW * i) / Math.max(recent.length - 1, 1),
    y: padT + innerH - ((Math.min(r.score, max) - min) / (max - min)) * innerH,
    score: r.score,
    label: (r.sceneName || "训练").slice(0, 6),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const area = `${line} L${pts[pts.length - 1]?.x ?? padL} ${padT + innerH} L${pts[0]?.x ?? padL} ${padT + innerH} Z`;
  return (
    <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="训练记录趋势折线图">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b91f3" stopOpacity=".22" />
          <stop offset="1" stopColor="#4b91f3" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2].map((i) => {
        const y = padT + (innerH * i) / 2;
        return (
          <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#edf2f8" />
        );
      })}
      {pts.length > 1 && (
        <>
          <path d={area} fill="url(#trendFill)" />
          <path d={line} fill="none" stroke="#2678f3" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#2678f3" strokeWidth={2} />
          <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={11} fill="#2678f3" fontWeight={700}>
            {p.score}
          </text>
          <text x={p.x} y={H - 8} textAnchor="middle" fontSize={11} fill="#8090a7">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
