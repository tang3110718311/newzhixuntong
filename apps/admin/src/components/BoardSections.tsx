import { useCallback, useEffect, useState } from "react";
import type { ApiResponse } from "@zxt/shared";

// ============================================================
// 数据看板组件（对齐原型 zxt-static-pages）
// CompanyBoardSection / DeptBoardSection / LearnerBoardSection
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

async function apiFetch<T>(path: string): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("zxt-admin-auth") : null;
  let tokenValue = "";
  if (token) {
    try {
      tokenValue = (JSON.parse(token) as { token?: string }).token || "";
    } catch {
      tokenValue = "";
    }
  }
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: tokenValue ? { Authorization: `Bearer ${tokenValue}` } : {},
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.success) {
    throw new Error(payload.message || payload.code);
  }
  return payload.data;
}

// ---------- 类型（与 packages/database/src/board-stats.ts 对应） ----------
export type BoardMetric = { label: string; value: number; suffix: string; delta: number; deltaLabel: string };
export type FunnelStep = { label: string; value: number; percent: number };
export type TrendDay = { date: string; participants: number; completed: number };
export type ScoreBucket = { label: string; count: number; percent: number };
export type MemberRank = { rank: number; name: string; recordCount: number; completionRate: number; avgScore: number };
export type WeakPoint = { title: string; scene: string; rate: number; suggestion: string };
export type Insight = { title: string; summary: string; strength: string; risk: string };
export type CompanyBoardData = {
  companyName: string;
  updatedAt: string;
  metrics: BoardMetric[];
  insight: Insight;
  funnel: FunnelStep[];
  trend: TrendDay[];
  abilityTotal: number;
  abilityBuckets: ScoreBucket[];
  members: MemberRank[];
  weakPoints: WeakPoint[];
};
export type DeptBoardData = CompanyBoardData & { depts: { id: string; name: string }[]; deptId: string | null };
export type LearnerBoardData = {
  userName: string;
  orgName: string;
  updatedAt: string;
  metrics: BoardMetric[];
  progress: { scene: string; score: number }[];
  examAverage: number;
  examBuckets: ScoreBucket[];
  insight: { text: string; stat1: { value: string; label: string }; stat2: { value: string; label: string }; stat3: { value: string; label: string } };
  weakPoints: WeakPoint[];
  achievements: { total: number; rank: number; streak: number };
  rankNote: string;
};

function useBoardData<T>(path: string | null): { data: T | null; loading: boolean; error: string; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    apiFetch<T>(path)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function exportJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function InsightCard({ insight, icon, chipLabel }: { insight: Insight; icon: string; chipLabel: string }) {
  return (
    <div className="co-insight card">
      <div className="co-insight-icon">{icon}</div>
      <div className="co-insight-main">
        <div className="co-insight-title">
          <b>{insight.title}</b>
          <span>{chipLabel}</span>
        </div>
        <p>{insight.summary}</p>
      </div>
      <div className="co-insight-side">
        <span className="co-chip good">{insight.strength}</span>
        <span className="co-chip risk">{insight.risk}</span>
        <button className="co-link inline" type="button">查看建议 →</button>
      </div>
    </div>
  );
}

function FunnelCard({ funnel }: { funnel: FunnelStep[] }) {
  return (
    <div className="co-card card">
      <div className="co-task-head row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3>组织任务推进</h3>
          <p className="co-sub">从任务分配到能力达标的执行链路</p>
        </div>
      </div>
      {funnel.map((step) => (
        <div className="co-funnel-row" key={step.label}>
          <span>{step.label}</span>
          <div className="co-funnel-bar"><i style={{ width: `${Math.min(step.percent, 100)}%` }} /></div>
          <em>{step.value}</em>
          <strong>{step.percent}%</strong>
        </div>
      ))}
    </div>
  );
}

function TrendCard({ trend }: { trend: TrendDay[] }) {
  const max = Math.max(1, ...trend.map((d) => Math.max(d.participants, d.completed)));
  return (
    <div className="co-card card">
      <h3>组织执行趋势</h3>
      <p className="co-sub">参与人数与完成率</p>
      <div className="co-trend">
        {trend.map((d) => (
          <div className="co-trend-group" key={d.date} data-date={d.date}>
            <i style={{ height: `${Math.max((d.participants / max) * 160, 2)}px` }} title={`参与 ${d.participants} 人`} />
            <i style={{ height: `${Math.max((d.completed / max) * 160, 2)}px` }} title={`完成 ${d.completed} 次`} />
          </div>
        ))}
      </div>
      <div className="co-legend">
        <span><i />参与人数</span>
        <span><i className="blue" />完成次数</span>
      </div>
    </div>
  );
}

function AbilityCard({ total, buckets, title, sub }: { total: number; buckets: ScoreBucket[]; title: string; sub: string }) {
  return (
    <div className="co-card card">
      <h3>{title}</h3>
      <p className="co-sub">{sub}<span className="co-total">平均 {formatNumber(total)}</span></p>
      {buckets.map((b) => (
        <div className="co-score-row" key={b.label}>
          <span>{b.label}</span>
          <div className="co-score-bar"><i style={{ width: `${Math.min(b.percent, 100)}%` }} /></div>
          <strong>{b.count}</strong>
          <em>{b.percent}%</em>
        </div>
      ))}
    </div>
  );
}

function MembersCard({ members }: { members: MemberRank[] }) {
  return (
    <div className="co-card card">
      <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3>团队成员完成情况</h3>
          <p className="co-sub">按完成率与能力分排序</p>
        </div>
        <button className="co-link inline" type="button">查看全部成员 →</button>
      </div>
      <table className="co-table">
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
          {members.map((m) => (
            <tr key={m.rank}>
              <td><span className="co-rank">{String(m.rank).padStart(2, "0")}</span></td>
              <td>{m.name}</td>
              <td>{m.recordCount}</td>
              <td className="green">{m.completionRate}%</td>
              <td className="blue">{m.avgScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeakPointsCard({ weakPoints, emptyText }: { weakPoints: WeakPoint[]; emptyText: string }) {
  return (
    <div className="co-card card">
      <h3>高频失分问题</h3>
      <p className="co-sub">AI 根据组织训练与考试结果归因</p>
      {weakPoints.length === 0 ? (
        <div className="board-loading" style={{ padding: "24px 0" }}>{emptyText}</div>
      ) : (
        weakPoints.map((w, i) => (
          <div className="co-error-row" key={w.title}>
            <span className={`co-error-rank ${i === 1 ? "orange" : i === 2 ? "blue" : ""}`}>{i + 1}</span>
            <div className="co-error-info">
              <b>{w.title}</b>
              <span>{w.scene}</span>
            </div>
            <div className="co-error-meter">
              <div><i style={{ width: `${Math.min(w.rate, 100)}%` }} /></div>
              <strong>{w.rate}%</strong>
            </div>
            <small>{w.suggestion}</small>
          </div>
        ))
      )}
    </div>
  );
}

// ================= 公司数据看板 =================
export function CompanyBoardSection() {
  const { data, loading, error, reload } = useBoardData<CompanyBoardData>("/dashboard/company");
  if (loading) return <div className="board-loading">数据看板加载中…</div>;
  if (error || !data) return <div className="board-error">加载失败：{error || "暂无数据"}</div>;
  const metricClasses = ["", "active", "green", "orange", ""];
  return (
    <div className="co-dashboard board-page">
      <div className="co-head">
        <div>
          <h1>公司数据看板</h1>
          <p>从参与、练习到考试，全面掌握组织培训成效</p>
        </div>
        <div className="co-updated"><i />已更新 {data.updatedAt}</div>
        <div className="co-actions">
          <span className="co-select">公司：{data.companyName} ⌄</span>
          <span className="co-select co-time">近 30 天 ⌄</span>
          <button className="btn gray" type="button" onClick={() => exportJson("company-board.json", data)}>导出报告</button>
        </div>
      </div>
      <div className="co-metrics">
        {data.metrics.map((m, i) => (
          <div className={`co-metric ${metricClasses[i % 5]}`} key={m.label}>
            <label>{m.label}</label>
            <strong>{formatNumber(m.value)}{m.suffix}</strong>
            <small><span className={`co-delta ${m.delta >= 0 ? "green" : "orange"}`}>{m.delta >= 0 ? `↑ ${m.delta}` : `↓ ${Math.abs(m.delta)}`}</span> {m.deltaLabel}</small>
          </div>
        ))}
      </div>
      <InsightCard insight={data.insight} icon="◈" chipLabel="本周分析完成" />
      <div className="co-grid co-top">
        <FunnelCard funnel={data.funnel} />
        <TrendCard trend={data.trend} />
        <AbilityCard total={data.abilityTotal} buckets={data.abilityBuckets} title="组织能力分布" sub="能力分布" />
      </div>
      <div className="co-grid co-bottom">
        <MembersCard members={data.members} />
        <WeakPointsCard weakPoints={data.weakPoints} emptyText="暂无失分数据" />
      </div>
    </div>
  );
}

// ================= 部门数据看板 =================
export function DeptBoardSection() {
  const [deptId, setDeptId] = useState<string | null>(null);
  const { data, loading, error, reload } = useBoardData<DeptBoardData>(`/dashboard/department${deptId ? `?orgId=${encodeURIComponent(deptId)}` : ""}`);
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => setDeptId(e.target.value || null);
  if (loading && !data) return <div className="board-loading">部门数据看板加载中…</div>;
  if (error || !data) return <div className="board-error">加载失败：{error || "暂无数据"}</div>;
  const metricClasses = ["", "active", "green", "orange", ""];
  return (
    <div className="co-dashboard board-page">
      <div className="co-head">
        <div>
          <h1>部门数据看板</h1>
          <p>按组织部门分析 AI 对话陪练参与、完成、考试与能力差距</p>
        </div>
        <div className="co-updated"><i />已更新 {data.updatedAt}</div>
        <div className="co-actions">
          <select className="co-select" value={data.deptId || ""} onChange={handleChange}>
            {data.depts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <span className="co-select co-time">近 30 天 ⌄</span>
          <button className="btn gray" type="button" onClick={() => exportJson("dept-board.json", data)}>导出报告</button>
        </div>
      </div>
      <div className="co-metrics">
        {data.metrics.map((m, i) => (
          <div className={`co-metric ${metricClasses[i % 5]}`} key={m.label}>
            <label>{m.label}</label>
            <strong>{formatNumber(m.value)}{m.suffix}</strong>
            <small><span className={`co-delta ${m.delta >= 0 ? "green" : "orange"}`}>{m.delta >= 0 ? `↑ ${m.delta}` : `↓ ${Math.abs(m.delta)}`}</span> {m.deltaLabel}</small>
          </div>
        ))}
      </div>
      <InsightCard insight={data.insight} icon="◈" chipLabel="本周分析完成" />
      <div className="co-grid co-top">
        <FunnelCard funnel={data.funnel} />
        <TrendCard trend={data.trend} />
        <AbilityCard total={data.abilityTotal} buckets={data.abilityBuckets} title="团队能力分布" sub="能力分布" />
      </div>
      <div className="co-grid co-bottom">
        <MembersCard members={data.members} />
        <WeakPointsCard weakPoints={data.weakPoints} emptyText="暂无失分数据" />
      </div>
    </div>
  );
}

// ================= 学员数据看板 =================
export function LearnerBoardSection({ learners, authUserId }: { learners: { id: string; name: string }[]; authUserId: string }) {
  const fallback = learners.find((u) => u.id === authUserId) ? authUserId : learners[0]?.id || authUserId;
  const [userId, setUserId] = useState(fallback);
  const { data, loading, error } = useBoardData<LearnerBoardData>(userId ? `/dashboard/learner?userId=${encodeURIComponent(userId)}` : null);
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => setUserId(e.target.value);
  if (loading && !data) return <div className="board-loading">学员数据看板加载中…</div>;
  if (error || !data) return <div className="board-error">加载失败：{error || "暂无数据"}</div>;
  const metricClasses = ["", "teal", "purple", "orange"];
  const lineColors = ["", "teal", "purple", "orange", "coral", "gold", "indigo"];
  return (
    <div className="learner-dashboard board-page">
      <div className="learner-head">
        <div>
          <h1>学员数据看板</h1>
          <p>查看个人训练闭环、场景掌握度、考试成绩与 AI 改进建议</p>
        </div>
        <div className="learner-updated"><i />已更新 {data.updatedAt}</div>
        <div className="learner-actions">
          <select className="learner-select" value={userId} onChange={handleChange}>
            {learners.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <span className="learner-select time">近 30 天 ⌄</span>
          <button className="btn gray" type="button" onClick={() => exportJson("learner-board.json", data)}>导出报告</button>
        </div>
      </div>
      <div className="learner-metrics">
        {data.metrics.map((m, i) => (
          <div className={`learner-metric ${metricClasses[i % 4]}`} key={m.label}>
            <label>{m.label}</label>
            <strong>{formatNumber(m.value)}{m.suffix}</strong>
            <small>{m.deltaLabel}</small>
          </div>
        ))}
      </div>
      <div className="learner-insight">
        <div className="learner-insight-copy">
          <h3>AI 智能洞察 · 我的训练建议</h3>
          <p>{data.insight.text}</p>
        </div>
        <div className="learner-insight-stats">
          <div>
            <strong>{data.insight.stat1.value}<em>分</em></strong>
            <small>{data.insight.stat1.label}</small>
          </div>
          <div>
            <strong>{data.insight.stat2.value}<em>%</em></strong>
            <small>{data.insight.stat2.label}</small>
          </div>
          <div>
            <strong>{data.insight.stat3.value}<em>次</em></strong>
            <small>{data.insight.stat3.label}</small>
          </div>
        </div>
      </div>
      <div className="learner-grid learner-main">
        <div className="learner-card card">
          <h3>训练轨迹</h3>
          <p className="sub">场景练习 → AI 反馈 → 再编辑提升 → 考试验证</p>
          {data.progress.length === 0 ? (
            <div className="board-loading" style={{ padding: "24px 0" }}>暂无训练数据</div>
          ) : (
            data.progress.map((p, i) => (
              <div className="learner-progress-row" key={p.scene}>
                <span>{p.scene}</span>
                <div className={`learner-line ${lineColors[(i + 1) % lineColors.length]}`}><i style={{ width: `${Math.min(p.score, 100)}%` }} /></div>
                <strong>{p.score}%</strong>
              </div>
            ))
          )}
        </div>
        <div className="learner-card card learner-score-card">
          <h3>考试成绩分析</h3>
          <p className="sub">能力分布</p>
          <div className="learner-average">平均分 <strong>{formatNumber(data.examAverage)}</strong></div>
          {data.examBuckets.map((b) => (
            <div className="learner-score-row" key={b.label}>
              <span>{b.label}</span>
              <div className={`learner-line ${lineColors[(data.examBuckets.indexOf(b) + 1) % lineColors.length]}`}><i style={{ width: `${Math.min(b.percent, 100)}%` }} /></div>
              <strong>{b.percent}%</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="learner-grid learner-bottom">
        <div className="learner-card card">
          <h3>高频失分</h3>
          <p className="sub">AI 定位个人薄弱点</p>
          {data.weakPoints.length === 0 ? (
            <div className="board-loading" style={{ padding: "16px 0" }}>暂无失分数据</div>
          ) : (
            data.weakPoints.map((w, i) => (
              <div className="learner-error-row" key={w.title}>
                <span className="co-error-rank">{i + 1}</span>
                <span>{w.title}</span>
                <div className="learner-line"><i style={{ width: `${Math.min(w.rate, 100)}%`, background: "linear-gradient(90deg,#ff8063,#f0ae34)" }} /></div>
                <strong>{w.rate}%</strong>
              </div>
            ))
          )}
        </div>
        <div className="learner-card card">
          <h3>训练成就排名</h3>
          <p className="sub">与同部门成员对比</p>
          <div className="learner-achievements">
            <div>
              <small>完成对练</small>
              <strong>{data.achievements.total} <em>次</em></strong>
            </div>
            <div>
              <small>部门排名</small>
              <strong>第 {data.achievements.rank} <em>名</em></strong>
            </div>
            <div>
              <small>连续学习</small>
              <strong>{data.achievements.streak} <em>天</em></strong>
            </div>
          </div>
          <div className="learner-ranking-note">{data.rankNote}</div>
        </div>
      </div>
    </div>
  );
}
