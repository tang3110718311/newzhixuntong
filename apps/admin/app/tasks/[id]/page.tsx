"use client";

import { useEffect, useState } from "react";
import type { ApiResponse, AuthSession } from "@zxt/shared";
import { ArrowLeft, Clock, BarChart3, Building2 } from "lucide-react";
import AppShell, { type RightRailData } from "@/components/AppShell";
import { getPathId, navigateTo } from "@/lib/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const AUTH_STORAGE_KEY = "zxt-admin-auth";

// ---------- 类型 ----------

type TaskRow = {
  id: string;
  name: string;
  code: string;
  type: string;
  description: string;
  status: string;
  startAt?: string | null;
  endAt: string | null;
  publishAt?: string | null;
  completedAt?: string | null;
  createdBy?: string | null;
  creatorName?: string | null;
  creatorOrgName?: string | null;
  participantCount: number;
  sceneCount: number;
  completedSceneCount: number;
  progressPercent: number;
  primarySceneType?: string | null;
  primaryMode?: string | null;
};

type TaskSceneRow = {
  id: string;
  sceneId: string;
  sceneName: string | null;
  sceneCode: string | null;
  sceneType: string | null;
  mode: string | null;
  status: string | null;
  sortOrder: number;
  requiredTrainTimes: number;
  passScore: number;
  completedTrainCount: number;
};

type TaskParticipantRow = {
  id: string;
  participantType: "user" | "org";
  userId: string | null;
  userName: string | null;
  mobile: string | null;
  orgId: string | null;
  orgName: string | null;
  status: string;
  finishedAt: string | null;
};

type TaskDetail = {
  task: TaskRow;
  scenes: TaskSceneRow[];
  participants: TaskParticipantRow[];
};

type TrainingRecord = {
  id: string;
  sceneId: string;
  score: number;
  status: string;
  createdAt: string;
};

// ---------- 工具函数 ----------

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const raw = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_STORAGE_KEY) : null;
  const token = raw ? (JSON.parse(raw) as { token: string }).token : "";
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.success) throw new Error(payload.message || payload.code);
  return payload.data;
}

function getAuth(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return dateStr;
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    completed: "已完成", draft: "待发布", published: "进行中",
    overdue: "已逾期", in_progress: "进行中", not_started: "未开始",
  };
  return map[status] || status;
}

function statusBadgeClass(status: string) {
  if (status === "completed") return "green";
  if (status === "overdue") return "danger";
  if (status === "published" || status === "in_progress") return "info";
  return "default";
}

// ---------- 学习步骤组件 ----------

function StepItem({ num, title, desc, actionLabel, onAction, disabled, state }: {
  num: number; title: string; desc: string;
  actionLabel: string; onAction?: () => void; disabled?: boolean;
  state?: "current" | "done" | "locked";
}) {
  const st = state ?? (disabled ? "locked" : "current");
  // 原型三态：current 蓝渐变白字 / done 绿色 / locked 半透明灰
  const bg = st === "current" ? "linear-gradient(110deg,#327de7,#3676df)" : st === "done" ? "#f7fdf9" : "#fafbfc";
  const border = st === "current" ? "#327de7" : st === "done" ? "#bce9d3" : "#e4ebf5";
  const titleColor = st === "current" ? "#fff" : st === "done" ? "#172b4d" : "#8b98aa";
  const descColor = st === "current" ? "#dbeaff" : "#8291a5";
  const numBg = st === "current" ? "rgba(255,255,255,0.25)" : st === "done" ? "#e4f8ed" : "#eef1f5";
  const numColor = st === "current" ? "#fff" : st === "done" ? "#27a66d" : "#a0aab8";
  const btnBg = st === "current" ? "#fff" : st === "done" ? "#52c41a" : "#d9d9d9";
  const btnColor = st === "current" ? "#327de7" : "#fff";
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 10,
      padding: "15px 16px", borderRadius: 13,
      border: `1px solid ${border}`,
      background: bg,
      minWidth: 0, opacity: st === "locked" ? 0.58 : 1,
      boxShadow: st === "current" ? "0 10px 24px rgba(47,116,235,0.2)" : "0 5px 16px rgba(65,94,156,0.04)",
      transition: "all 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800,
          background: numBg, color: numColor,
        }}>
          {st === "done" ? "✓" : st === "locked" ? "🔒" : num}
        </span>
        <h3 style={{ margin: 0, fontSize: 13, color: titleColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h3>
      </div>
      <p style={{ margin: "0 0 0 38px", fontSize: 11, color: descColor, lineHeight: 1.6 }}>{desc}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        style={{
          marginLeft: 38, padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
          border: "none", cursor: disabled ? "not-allowed" : "pointer",
          background: btnBg, color: btnColor, alignSelf: "flex-start",
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

// ---------- 主组件 ----------

export default function TaskDetailPage() {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [error, setError] = useState("");
  const [rightRail, setRightRail] = useState<RightRailData | undefined>(undefined);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [recordTab, setRecordTab] = useState<"practice" | "exam">("practice");
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);

  const taskId = typeof window !== "undefined"
    ? getPathId("tasks")
    : "";

  useEffect(() => {
    if (!taskId) return;
    setError("");
    apiFetch<TaskDetail>(`/tasks/${taskId}`)
      .then((d) => {
        setDetail(d);
        setSelectedSceneId(d.scenes[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载任务详情失败"));

    loadRightRailData().then(setRightRail);
  }, [taskId]);

  useEffect(() => {
    if (!selectedSceneId || !detail) return;
    apiFetch<{ items: TrainingRecord[] }>(`/training-records?taskId=${detail.task.id}&sceneId=${selectedSceneId}&pageSize=50`)
      .then((res) => setTrainingRecords(res.items || []))
      .catch(() => setTrainingRecords([]));
  }, [selectedSceneId, detail]);

  const currentScene = detail?.scenes.find((s) => s.id === selectedSceneId) || detail?.scenes[0] || null;

  function startPractice(scene: TaskSceneRow) {
    if (!scene?.sceneId) return;
    const params = new URLSearchParams({ sceneId: scene.sceneId, taskId: detail!.task.id });
    navigateTo(`/practice?${params.toString()}`);
  }

  if (!detail) {
    return (
      <AppShell
        activeNavKey="my-tasks"
        onNavClick={(key: string) => { navigateTo("/?section=" + key); }}
        rightRail={rightRail}
        breadcrumb={{ label: "我的任务", childLabel: "任务详情" }}
      >
        {error && <div className="notice">{error}</div>}
        <div className="empty" style={{ padding: 40 }}>加载中...</div>
      </AppShell>
    );
  }

  const task = detail.task;

  return (
    <AppShell
      activeNavKey="my-tasks"
      onNavClick={(key: string) => { navigateTo("/?section=" + key); }}
      rightRail={rightRail}
      breadcrumb={{ label: "我的任务", childLabel: "任务详情" }}
    >
      {error && <div className="notice">{error}</div>}

      {/* ===== 1. 顶部标题区 ===== */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 20, color: "#172b4d", fontWeight: 700 }}>{task.name}</h1>
            <span style={{
              padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 500,
              background: task.status === "completed" ? "#f6ffed" : task.status === "overdue" ? "#fff7e6" : "#e6f4ff",
              color: task.status === "completed" ? "#52c41a" : task.status === "overdue" ? "#e6a23c" : "#327de7",
            }}>
              {statusLabel(task.status)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => { navigateTo("/?section=my-tasks"); }}
            style={{
              padding: "6px 16px", borderRadius: 6, fontSize: 13,
              border: "1px solid #d9d9d9", background: "#fff", color: "#52657f", cursor: "pointer",
            }}
          >
            返回我的任务
          </button>
        </div>
        <p style={{ margin: "4px 0 0", color: "#8b98aa", fontSize: 13 }}>任务编号: {task.code || task.id}</p>
      </div>

      {/* ===== 2. 任务描述（原型：蓝色左边条卡片） ===== */}
      <div className="card" style={{ padding: "20px 25px", marginBottom: 20, borderLeft: "5px solid #357feb" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "#172b4d", fontWeight: 600 }}>任务描述</h3>
        <p style={{ color: "#52657f", lineHeight: 1.7, marginBottom: 16, fontSize: 14 }}>
          {task.description || "完成场景学习、对练与考试。"}
        </p>
        <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} color="#8b98aa" />
            <div>
              <div style={{ color: "#8b98aa", fontSize: 12, marginBottom: 2 }}>截止时间</div>
              <strong style={{ fontSize: 14, color: "#172b4d" }}>{formatDate(task.endAt)}</strong>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={16} color="#8b98aa" />
            <div>
              <div style={{ color: "#8b98aa", fontSize: 12, marginBottom: 2 }}>整体进度</div>
              <strong style={{ fontSize: 14, color: "#172b4d" }}>{task.progressPercent}%（{task.completedSceneCount}/{task.sceneCount} 场景）</strong>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Building2 size={16} color="#8b98aa" />
            <div>
              <div style={{ color: "#8b98aa", fontSize: 12, marginBottom: 2 }}>发布部门</div>
              <strong style={{ fontSize: 14, color: "#172b4d" }}>{task.creatorOrgName || "—"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 3. 场景学习 ===== */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, color: "#172b4d", fontWeight: 600 }}>场景学习</h2>
          <span style={{ color: "#8b98aa", fontSize: 13 }}>选择场景进行学习，按顺序完成</span>
        </div>
        {/* 标签条：一行最多3个，超出换行，必须按顺序完成 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8, width: "100%" }}>
          {detail.scenes.map((scene, i) => {
            const active = scene.id === currentScene?.id;
            const completed = scene.completedTrainCount >= scene.requiredTrainTimes;
            // 顺序锁定：第0个始终可点；后面的只有前一个已完成才解锁
            const prevScene = i > 0 ? detail.scenes[i - 1] : null;
            const locked = i > 0 && (prevScene?.completedTrainCount ?? 0) < (prevScene?.requiredTrainTimes ?? 1);
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => { if (!locked) setSelectedSceneId(scene.id); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 14px", borderRadius: 8,
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: locked ? "not-allowed" : "pointer",
                  border: "none", outline: "none",
                  minWidth: 0, opacity: locked ? 0.45 : 1,
                  background: completed
                    ? (active ? "#52c41a" : "#f6ffed")
                    : (active ? "linear-gradient(110deg, #327de7 0%, #3676df 100%)" : "#f7f8fa"),
                  color: locked
                    ? "#bfbfbf"
                    : completed
                      ? (active ? "#fff" : "#52c41a")
                      : (active ? "#fff" : "#52657f"),
                  boxShadow: active && !locked ? "0 2px 8px rgba(50,125,231,0.25)" : "0 1px 2px rgba(0,0,0,0.04)",
                  transition: "all 0.2s",
                  width: "calc(33.33% - 8px)",
                  flexShrink: 0,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: locked
                    ? "#e8e8e8"
                    : completed
                      ? (active ? "rgba(255,255,255,0.3)" : "#52c41a")
                      : (active ? "rgba(255,255,255,0.25)" : "#d9d9d9"),
                  color: locked
                    ? "#bfbfbf"
                    : completed
                      ? "#fff"
                      : (active ? "#fff" : "#8b98aa"),
                }}>
                  {locked ? "🔒" : completed ? "✓" : i + 1}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {scene.sceneName || "场景名称"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 4. 场景详情 ===== */}
      {currentScene && (
        <div className="card" style={{ padding: 20 }}>
          {/* 场景标题+标签 */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: "#172b4d", fontWeight: 700 }}>{currentScene.sceneName || "场景名称"}</h2>
              <p style={{ margin: "4px 0 0", color: "#8b98aa", fontSize: 13 }}>
                {currentScene.sceneType === "free" ? "自由对练场景" : "任务对练场景"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 12, background: "#f5f5f5", color: "#52657f" }}>合格标准 ≥{currentScene.passScore}%</span>
              <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 12, background: "#f5f5f5", color: "#52657f" }}>
                任务类型 {currentScene.sceneType === "free" ? "自由对练" : "任务对练"}
              </span>
              <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 12, background: "#f5f5f5", color: "#52657f" }}>
                回答形式 {currentScene.mode === "text" ? "文本回答" : "语音回答"}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* 左侧：学习步骤流（原型横排 3 tab + 箭头） */}
            <div>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: "#172b4d", fontWeight: 600 }}>场景学习</h3>
                <span style={{ fontSize: 12, color: "#8b98aa" }}>{currentScene.sceneName || "场景名称"}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 26px 1fr 26px 1fr", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <StepItem
                  num={1}
                  title="资料学习"
                  desc="查看学习资料，掌握场景要点。"
                  actionLabel="开始学习"
                  onAction={() => {}}
                  state="current"
                />
                <span style={{ textAlign: "center", color: "#aebbd0", fontSize: 24, fontWeight: 300 }}>›</span>
                <StepItem
                  num={2}
                  title="AI对练"
                  desc="与AI进行模拟对练训练。"
                  actionLabel="开始对练"
                  onAction={() => startPractice(currentScene)}
                  state="current"
                />
                <span style={{ textAlign: "center", color: "#aebbd0", fontSize: 24, fontWeight: 300 }}>›</span>
                <StepItem
                  num={3}
                  title="场景考试"
                  desc="完成场景相关综合能力测评。"
                  actionLabel="开始考试"
                  disabled
                  state="locked"
                />
              </div>

              <p style={{
                background: "#f0f6ff", borderRadius: 6,
                padding: "10px 12px", fontSize: 12, color: "#4b8ce9", marginTop: 8,
              }}>
                资料学习和AI对练均可直接开始，完成AI对练后解锁场景考试。
              </p>
            </div>

            {/* 右侧：场景学习记录 */}
            <div>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: "#172b4d", fontWeight: 600 }}>场景学习记录</h3>
                <span style={{ fontSize: 12, color: "#8b98aa" }}>{currentScene.sceneName || "场景名称"}</span>
              </div>
              <div style={{ display: "flex", gap: 16, borderBottom: "1px solid #e4e7ed", marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setRecordTab("practice")}
                  style={{
                    padding: "0 0 8px", border: "none", background: "transparent",
                    fontSize: 13, cursor: "pointer",
                    color: recordTab === "practice" ? "#327de7" : "#8b98aa",
                    fontWeight: recordTab === "practice" ? 600 : 400,
                    borderBottom: recordTab === "practice" ? "2px solid #327de7" : "2px solid transparent",
                  }}
                >
                  对练记录
                </button>
                <button
                  type="button"
                  onClick={() => setRecordTab("exam")}
                  style={{
                    padding: "0 0 8px", border: "none", background: "transparent",
                    fontSize: 13, cursor: "pointer",
                    color: recordTab === "exam" ? "#327de7" : "#8b98aa",
                    fontWeight: recordTab === "exam" ? 600 : 400,
                    borderBottom: recordTab === "exam" ? "2px solid #327de7" : "2px solid transparent",
                  }}
                >
                  考试记录
                </button>
              </div>

              {recordTab === "practice" ? (
                trainingRecords.length > 0 ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {trainingRecords.map((rec) => (
                      <div key={rec.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 12px", borderRadius: 6, border: "1px solid #e4e7ed",
                      }}>
                        <div>
                          <strong style={{ fontSize: 14 }}>对练 #{rec.id.slice(-4)}</strong>
                          <span style={{ marginLeft: 8, fontSize: 12, color: "#8b98aa" }}>{formatDate(rec.createdAt)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: rec.score >= currentScene.passScore ? "#52c41a" : "#f5222d" }}>
                            {rec.score}分
                          </span>
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 12,
                            background: rec.score >= currentScene.passScore ? "#f6ffed" : "#fff1f0",
                            color: rec.score >= currentScene.passScore ? "#52c41a" : "#f5222d",
                          }}>
                            {rec.score >= currentScene.passScore ? "合格" : "不合格"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 32, textAlign: "center", color: "#8b98aa", fontSize: 13 }}>
                    完成AI对练后显示对练记录
                  </div>
                )
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "#8b98aa", fontSize: 13 }}>
                  完成场景考试后显示考试记录
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ---------- 右侧面板数据 ----------

async function loadRightRailData(): Promise<RightRailData> {
  try {
    const auth = getAuth();
    return {
      userName: auth?.user?.name || "管理员",
      completedRecordCount: 0,
      practiceRecordCount: 0,
      examCount: 0,
      passRate: "0%",
      pendingAppealCount: 0,
      tenantName: auth?.user?.tenantName || "智训通本地验证租户",
    };
  } catch {
    return {
      userName: "管理员", completedRecordCount: 0, practiceRecordCount: 0,
      examCount: 0, passRate: "0%", pendingAppealCount: 0, tenantName: "智训通本地验证租户",
    };
  }
}
