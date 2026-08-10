"use client";

import { useEffect, useState } from "react";
import type { ApiResponse, AuthSession } from "@zxt/shared";
import { ArrowLeft, Play, MessageSquare, FileCheck, ChevronRight, Shield } from "lucide-react";
import AppShell, { type RightRailData } from "@/components/AppShell";

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
    return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
      + " "
      + d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    completed: "已完成",
    draft: "待发布",
    published: "进行中",
    overdue: "已逾期",
    in_progress: "进行中",
    not_started: "未开始",
  };
  return map[status] || status;
}

function statusBadgeClass(status: string) {
  if (status === "completed") return "green";
  if (status === "overdue") return "danger";
  if (status === "published" || status === "in_progress") return "info";
  return "default";
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
    ? new URL(window.location.href).pathname.split("/")[2] || ""
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

  // 加载训练记录
  useEffect(() => {
    if (!selectedSceneId || !detail) return;
    // 调用 training-records API 获取对练记录
    apiFetch<{ items: TrainingRecord[] }>(`/training-records?taskId=${detail.task.id}&sceneId=${selectedSceneId}&pageSize=50`)
      .then((res) => setTrainingRecords(res.items || []))
      .catch(() => setTrainingRecords([]));
  }, [selectedSceneId, detail]);

  const currentScene = detail?.scenes.find((s) => s.id === selectedSceneId) || detail?.scenes[0] || null;

  function startPractice(scene: TaskSceneRow) {
    if (!scene?.sceneId) return;
    const params = new URLSearchParams({ sceneId: scene.sceneId, taskId: detail!.task.id });
    window.location.href = `/practice?${params.toString()}`;
  }

  if (!detail) {
    return (
      <AppShell
        activeNavKey="my-tasks"
        onNavClick={(key: string) => { window.location.href = "/?section=" + key; }}
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
      onNavClick={(key: string) => { window.location.href = "/?section=" + key; }}
      rightRail={rightRail}
      breadcrumb={{ label: "我的任务", childLabel: "任务详情" }}
    >
      {error && <div className="notice">{error}</div>}

      {/* 顶部标题区 */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 className="page-title">{task.name}</h1>
            <span className={`badge ${statusBadgeClass(task.status)}`}>{statusLabel(task.status)}</span>
          </div>
          <p className="page-desc">任务编号: {task.code || task.id}</p>
        </div>
        <div className="toolbar">
          <button className="btn" type="button" onClick={() => { window.location.href = "/?section=my-tasks"; }}>
            <ArrowLeft size={16} /> 返回我的任务
          </button>
        </div>
      </div>

      {/* 任务描述区块 */}
      <div className="card section" style={{ marginBottom: 20 }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>任务描述</h3>
        <p style={{ color: "#52657f", lineHeight: 1.7, marginBottom: 16 }}>{task.description || "完成场景学习、对练与考试。"}</p>
        <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
          <div>
            <span style={{ color: "#8b98aa", fontSize: 13 }}>截止时间</span><br />
            <strong>{formatDate(task.endAt)}</strong>
          </div>
          <div>
            <span style={{ color: "#8b98aa", fontSize: 13 }}>整体进度</span><br />
            <strong>{task.progressPercent}%（{task.completedSceneCount}/{task.sceneCount} 场景）</strong>
          </div>
          <div>
            <span style={{ color: "#8b98aa", fontSize: 13 }}>所属部门</span><br />
            <strong>{task.creatorOrgName || "—"}</strong>
          </div>
        </div>
      </div>

      {/* 场景学习区块 */}
      <div className="card section" style={{ marginBottom: 20 }}>
        <div className="section-head compact" style={{ marginBottom: 16 }}>
          <h2 className="section-title">场景学习</h2>
          <span style={{ color: "#8b98aa", fontSize: 13 }}>选择场景进行学习，按顺序完成</span>
        </div>
        {detail.scenes.map((scene, i) => {
          const active = scene.id === currentScene?.id;
          const sceneStatus = scene.completedTrainCount >= scene.requiredTrainTimes ? "已完成" : "进行中";
          return (
            <div
              key={scene.id}
              onClick={() => setSelectedSceneId(scene.id)}
              style={{
                border: active ? "1px solid #4080ff" : "1px solid var(--border, #e4e7ed)",
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
                cursor: "pointer",
                background: active ? "#f5f9ff" : "#fff",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 6,
                background: active ? "#4080ff" : "#c0c4cc",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <strong>{scene.sceneName || "场景名称"}</strong>
                {scene.sceneType && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: "#8b98aa" }}>
                    {scene.sceneType === "free" ? "自由对练" : "任务对练"}
                  </span>
                )}
              </div>
              <span className={`badge ${sceneStatus === "已完成" ? "green" : "info"}`}>
                {sceneStatus}
              </span>
            </div>
          );
        })}
      </div>

      {/* 场景详情区块 */}
      {currentScene && (
        <div className="card section">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h2 className="section-title">{currentScene.sceneName || "场景名称"}</h2>
              <p style={{ color: "#8b98aa", fontSize: 13, marginTop: 4 }}>
                {currentScene.sceneType === "free" ? "自由对练场景" : "任务对练场景"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className="badge default">合格标准 ≥{currentScene.passScore}%</span>
              <span className="badge default">任务类型 {currentScene.sceneType === "free" ? "自由对练" : "任务对练"}</span>
              <span className="badge default">回答形式 {currentScene.mode === "text" ? "文本回答" : "语音回答"}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* 左侧：学习步骤流 */}
            <div>
              <div className="section-head compact" style={{ marginBottom: 12 }}>
                <h3 className="section-title">场景学习</h3>
                <span style={{ color: "#8b98aa", fontSize: 13 }}>{currentScene.sceneName || "场景名称"}</span>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {/* 资料学习 */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 0", borderTop: "1px solid var(--border, #e4e7ed)",
                }}>
                  <div>
                    <strong>资料学习</strong><br />
                    <span style={{ fontSize: 12, color: "#8b98aa" }}>查看学习资料，掌握场景要点。</span>
                  </div>
                  <button className="btn" type="button">开始学习</button>
                </div>
                {/* AI对练 */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 0", borderTop: "1px solid var(--border, #e4e7ed)",
                }}>
                  <div>
                    <strong>AI对练</strong><br />
                    <span style={{ fontSize: 12, color: "#8b98aa" }}>与AI进行模拟对话训练。</span>
                  </div>
                  <button className="btn primary" type="button" onClick={() => startPractice(currentScene)}>
                    开始对练
                  </button>
                </div>
                {/* 场景考试 */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 0", borderTop: "1px solid var(--border, #e4e7ed)",
                }}>
                  <div>
                    <strong>场景考试</strong><br />
                    <span style={{ fontSize: 12, color: "#8b98aa" }}>完成场景相关综合能力测评。</span>
                  </div>
                  <button className="btn" type="button" disabled>开始考试</button>
                </div>
              </div>
              <p style={{
                background: "#fdf6ec", borderRadius: 6,
                padding: "10px 12px", fontSize: 12, color: "#e6a23c", marginTop: 12,
              }}>
                资料学习和AI对练均可直接开始，完成AI对练后解锁场景考试。
              </p>
            </div>

            {/* 右侧：场景学习记录 */}
            <div>
              <div className="section-head compact" style={{ marginBottom: 12 }}>
                <h3 className="section-title">场景学习记录</h3>
                <span style={{ color: "#8b98aa", fontSize: 13 }}>{currentScene.sceneName || "场景名称"}</span>
              </div>
              <div style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--border, #e4e7ed)", marginBottom: 16 }}>
                <button
                  className="link-btn"
                  type="button"
                  onClick={() => setRecordTab("practice")}
                  style={recordTab === "practice" ? { color: "#4080ff", fontWeight: 600, borderBottom: "2px solid #4080ff", paddingBottom: 8 } : {}}
                >
                  对练记录
                </button>
                <button
                  className="link-btn"
                  type="button"
                  onClick={() => setRecordTab("exam")}
                  style={recordTab === "exam" ? { color: "#4080ff", fontWeight: 600, borderBottom: "2px solid #4080ff", paddingBottom: 8 } : {}}
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
                        padding: "10px 12px", borderRadius: 6,
                        border: "1px solid var(--border, #e4e7ed)",
                      }}>
                        <div>
                          <strong style={{ fontSize: 14 }}>对练 #{rec.id.slice(-4)}</strong>
                          <span style={{ marginLeft: 8, fontSize: 12, color: "#8b98aa" }}>{formatDate(rec.createdAt)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: rec.score >= currentScene.passScore ? "#52c41a" : "#f5222d" }}>
                            {rec.score}分
                          </span>
                          <span className={`badge ${rec.score >= currentScene.passScore ? "green" : "danger"}`}>
                            {rec.score >= currentScene.passScore ? "合格" : "不合格"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty" style={{ padding: 24 }}>完成AI对练后显示对练记录</div>
                )
              ) : (
                <div className="empty" style={{ padding: 24 }}>完成场景考试后显示考试记录</div>
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
