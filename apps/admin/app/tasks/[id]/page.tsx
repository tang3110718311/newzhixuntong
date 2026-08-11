"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiResponse, AuthSession } from "@zxt/shared";
import {
  Clock,
  CalendarDays,
  Users,
  PlayCircle,
  MessageSquare,
  FileCheck2,
  AlertCircle,
  Check,
  ArrowLeft,
  X,
  Phone,
  Mail,
  HelpCircle,
} from "lucide-react";
import AppShell, { type RightRailData } from "@/components/AppShell";
import { getPathId, navigateTo } from "@/lib/navigation";

// ---------- 主题色（按原型偏紫蓝） ----------
const PRIMARY = "#4E63F0";
const PRIMARY_DARK = "#3a4ed8";
const PRIMARY_LIGHT = "#eef0ff";
const PRIMARY_LIGHT2 = "#f5f6ff";
const ACCENT_GRADIENT = "linear-gradient(90deg,#4E63F0 0%,#6F84FF 100%)";

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

type SceneLearnStep = "video" | "practice" | "exam";
type StepStatus = "done" | "current" | "locked";

const STEP_META: Record<
  SceneLearnStep,
  { title: string; desc: string; cta: string; Icon: any }
> = {
  video: {
    title: "视频学习",
    desc: "观看场景相关视频，掌握知识点。",
    cta: "开始学习",
    Icon: PlayCircle,
  },
  practice: {
    title: "AI 对练",
    desc: "与 AI 进行模拟对练训练。",
    cta: "开始对练",
    Icon: MessageSquare,
  },
  exam: {
    title: "场景考试",
    desc: "完成场景相关综合能力测评。",
    cta: "开始考试",
    Icon: FileCheck2,
  },
};

const STEP_ORDER: SceneLearnStep[] = ["video", "practice", "exam"];

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
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

function diffHours(start?: string | null, end?: string | null): string {
  if (!start || !end) return "—";
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (Number.isNaN(ms) || ms <= 0) return "—";
    const hours = Math.round(ms / 36e5);
    if (hours < 24) return `${hours} 小时`;
    const days = Math.round(hours / 24);
    return `${days} 天`;
  } catch {
    return "—";
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

// ---------- 右下角悬浮"问"按钮 ----------

function SupportWidget() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div
          style={{
            position: "fixed",
            right: 28,
            bottom: 88,
            width: 280,
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 12px 40px rgba(15,23,42,.16)",
            padding: 18,
            zIndex: 9999,
            border: "1px solid #e4e7ed",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <strong style={{ fontSize: 14, color: "#172b4d" }}>需要帮助？</strong>
            <X
              size={16}
              color="#8b98aa"
              onClick={() => setOpen(false)}
              style={{ cursor: "pointer" }}
            />
          </div>
          <p
            style={{
              margin: "0 0 14px",
              fontSize: 12,
              color: "#52657f",
              lineHeight: 1.6,
            }}
          >
            您可以联系平台管理员或客服，获取一对一支持。客服工作日 9:00–18:00 在线。
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a
              href="tel:400-000-0000"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                background: PRIMARY_LIGHT2,
                color: PRIMARY_DARK,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              <Phone size={14} /> 联系客服（400-000-0000）
            </a>
            <a
              href="mailto:support@xingyiwulian.cn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                background: PRIMARY_LIGHT2,
                color: PRIMARY_DARK,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              <Mail size={14} /> support@xingyiwulian.cn
            </a>
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label="帮助"
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          right: 28,
          bottom: 28,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: ACCENT_GRADIENT,
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 28px rgba(78,99,240,.45)",
          zIndex: 9999,
          transition: "transform .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? <X size={20} /> : <span style={{ fontSize: 20, fontWeight: 700 }}>问</span>}
      </button>
    </>
  );
}

// ---------- 组件：信息字段块 ----------

function FieldBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: PRIMARY_LIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={16} color={PRIMARY} />
      </div>
      <div>
        <div style={{ color: "#8b98aa", fontSize: 12, marginBottom: 2 }}>{label}</div>
        <strong style={{ fontSize: 14, color: "#172b4d" }}>{value}</strong>
      </div>
    </div>
  );
}

// ---------- 组件：步骤列表项（按原型的纵向一行：序号+标题+描述 + 右侧按钮）----------

function StepRow({
  stepKey,
  status,
  onAction,
  disabled,
}: {
  stepKey: SceneLearnStep;
  status: StepStatus;
  onAction?: () => void;
  disabled?: boolean;
}) {
  const meta = STEP_META[stepKey];
  const Icon = meta.Icon;
  const num = STEP_ORDER.indexOf(stepKey) + 1;

  const rowBg = status === "done" ? "#f7fdf9" : status === "locked" ? "#fafbfc" : "#fff";
  const rowBorder = status === "done" ? "#bce9d3" : status === "locked" ? "#e4ebf5" : PRIMARY;
  const titleColor = status === "locked" ? "#a0aab8" : "#172b4d";
  const descColor = "#8b98aa";

  const numBg =
    status === "done"
      ? "#27a66d"
      : status === "locked"
        ? "#eef1f5"
        : PRIMARY_LIGHT;
  const numColor =
    status === "done" ? "#fff" : status === "locked" ? "#a0aab8" : PRIMARY;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        background: rowBg,
        border: `1px solid ${rowBorder}`,
        borderRadius: 12,
        opacity: status === "locked" ? 0.62 : 1,
        transition: "all .2s",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: numBg,
          color: numColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        {status === "done" ? <Check size={16} /> : num}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: titleColor,
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 2,
          }}
        >
          <Icon size={14} />
          <span>{meta.title}</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: descColor, lineHeight: 1.5 }}>{meta.desc}</p>
      </div>
      <button
        type="button"
        disabled={disabled || status === "locked"}
        onClick={onAction}
        style={{
          padding: "8px 22px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          border: "none",
          cursor: disabled || status === "locked" ? "not-allowed" : "pointer",
          background:
            status === "done"
              ? "#52c41a"
              : status === "locked"
                ? "#d9d9d9"
                : PRIMARY,
          color: "#fff",
          flexShrink: 0,
          boxShadow:
            status === "current" ? "0 4px 12px rgba(78,99,240,.25)" : "none",
          transition: "all .2s",
        }}
      >
        {status === "done" ? "已完成" : meta.cta}
      </button>
    </div>
  );
}

// ---------- 主组件 ----------

export default function TaskDetailPage() {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [error, setError] = useState("");
  const [rightRail, setRightRail] = useState<RightRailData | undefined>(undefined);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);

  const taskId = typeof window !== "undefined" ? getPathId("tasks") : "";
  const currentScene = detail?.scenes?.[0] || null;

  useEffect(() => {
    if (!taskId) return;
    setError("");
    apiFetch<TaskDetail>(`/tasks/${taskId}`)
      .then((d) => setDetail(d))
      .catch((err) => setError(err instanceof Error ? err.message : "加载任务详情失败"));

    loadRightRailData().then(setRightRail);
  }, [taskId]);

  useEffect(() => {
    if (!currentScene || !detail) return;
    apiFetch<{ items: TrainingRecord[] }>(
      `/training-records?taskId=${detail.task.id}&sceneId=${currentScene.sceneId}&pageSize=50`,
    )
      .then((res) => setTrainingRecords(res.items || []))
      .catch(() => setTrainingRecords([]));
  }, [currentScene?.id, detail?.task.id]);

  // 步骤完成态判断
  const stepStatusMap = useMemo<Record<SceneLearnStep, StepStatus>>(() => {
    if (!currentScene) {
      return { video: "locked", practice: "locked", exam: "locked" };
    }
    const passedRecords = trainingRecords.filter(
      (r) => r.status === "passed" || r.score >= (currentScene.passScore || 60),
    );
    const videoDone = passedRecords.length > 0; // 简化：AI 对练通过即视为"学完理论知识模块"
    const practiceDone = currentScene.completedTrainCount >= currentScene.requiredTrainTimes;
    const examDone = false; // 当前没有考试记录
    return {
      video: videoDone ? "done" : "current",
      practice: practiceDone ? "done" : videoDone ? "current" : "locked",
      exam: examDone ? "done" : practiceDone ? "current" : "locked",
    };
  }, [currentScene, trainingRecords]);

  function startPractice() {
    if (!currentScene?.sceneId || !detail) return;
    const params = new URLSearchParams({
      sceneId: currentScene.sceneId,
      taskId: detail.task.id,
    });
    navigateTo(`/practice?${params.toString()}`);
  }

  function startVideo() {
    if (!currentScene?.sceneId || !detail) return;
    const params = new URLSearchParams({
      sceneId: currentScene.sceneId,
      taskId: detail.task.id,
    });
    navigateTo(`/practice?${params.toString()}&mode=intro`);
  }

  function startExam() {
    if (!currentScene?.sceneId || !detail) return;
    navigateTo(`/scenes/${currentScene.sceneId}/exam`);
  }

  if (!detail) {
    return (
      <AppShell
        activeNavKey="my-tasks"
        onNavClick={(key: string) => {
          navigateTo("/?section=" + key);
        }}
        rightRail={rightRail}
        breadcrumb={{ label: "我的任务", childLabel: "任务详情" }}
      >
        {error && <div className="notice">{error}</div>}
        <div className="empty" style={{ padding: 40 }}>
          加载中...
        </div>
      </AppShell>
    );
  }

  const task = detail.task;
  const audience =
    task.participantCount > 0
      ? `我 + ${task.creatorOrgName || "服务部"}（${task.participantCount} 人）`
      : `我 + ${task.creatorOrgName || "服务部"}`;
  const estimated = diffHours(task.startAt, task.endAt);

  return (
    <AppShell
      activeNavKey="my-tasks"
      onNavClick={(key: string) => {
        navigateTo("/?section=" + key);
      }}
      rightRail={rightRail}
      breadcrumb={{ label: "我的任务", childLabel: "任务详情" }}
    >
      {error && <div className="notice">{error}</div>}

      {/* ===== 1. 顶部标题区（按原型：标题 + 徽章 + 右侧"返回培训任务"按钮）===== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              color: "#172b4d",
              fontWeight: 700,
            }}
          >
            {task.name}
          </h1>
          <span
            style={{
              padding: "2px 10px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              background: PRIMARY_LIGHT,
              color: PRIMARY,
            }}
          >
            {statusLabel(task.status)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigateTo("/?section=my-tasks")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 16px",
            borderRadius: 6,
            fontSize: 13,
            border: "1px solid #d9d9d9",
            background: "#fff",
            color: "#52657f",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={14} />
          返回培训任务
        </button>
      </div>

      {/* ===== 2. 任务摘要（按原型：3 字段 = 截止时间 / 预计时长 / 适用人群 + 5px 主色左边条）===== */}
      <div
        style={{
          padding: "22px 26px",
          background: "#fff",
          borderRadius: 12,
          borderLeft: `5px solid ${PRIMARY}`,
          boxShadow: "0 5px 16px rgba(65,94,156,.04)",
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 15,
            color: "#172b4d",
            fontWeight: 600,
          }}
        >
          任务描述
        </h3>
        <p
          style={{
            color: "#52657f",
            lineHeight: 1.7,
            marginBottom: 16,
            fontSize: 14,
            maxWidth: 920,
          }}
        >
          {task.description || "完成场景学习、对练与考试。"}
        </p>
        <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
          <FieldBlock icon={Clock} label="截止时间" value={formatDate(task.endAt)} />
          <FieldBlock icon={CalendarDays} label="预计时长" value={estimated} />
          <FieldBlock icon={Users} label="适用人群" value={audience} />
        </div>
      </div>

      {/* ===== 3. 蓝色步骤横条（按原型："✓ 学完理论知识模块"）===== */}
      <div
        style={{
          background: ACCENT_GRADIENT,
          color: "#fff",
          borderRadius: 12,
          padding: "14px 22px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          boxShadow: "0 6px 18px rgba(78,99,240,.25)",
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "rgba(255,255,255,.22)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Check size={15} />
        </span>
        <strong style={{ fontSize: 14 }}>学完理论知识模块</strong>
        <span
          style={{
            marginLeft: 8,
            fontSize: 12,
            padding: "2px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,.18)",
            color: "#fff",
          }}
        >
          基础知识
        </span>
      </div>

      {/* ===== 4. 客户场景应对对练大卡 ===== */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 5px 16px rgba(65,94,156,.04)",
        }}
      >
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: 16,
            color: "#172b4d",
            fontWeight: 600,
          }}
        >
          客户场景应对对练
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* 左：场景学习（纵向列表） */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, color: "#172b4d", fontWeight: 600 }}>
                场景学习
              </h3>
              <span style={{ fontSize: 12, color: "#8b98aa" }}>
                {currentScene?.sceneName || "—"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {STEP_ORDER.map((stepKey) => (
                <StepRow
                  key={stepKey}
                  stepKey={stepKey}
                  status={stepStatusMap[stepKey]}
                  onAction={() => {
                    if (stepKey === "video") startVideo();
                    else if (stepKey === "practice") startPractice();
                    else startExam();
                  }}
                  disabled={!currentScene?.sceneId}
                />
              ))}
            </div>

            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                background: "#fff7e6",
                color: "#ad6800",
                borderRadius: 8,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertCircle size={14} />
              本场景要求先完成视频学习，再开展 AI 对练；通过 AI 对练后解锁场景考试。
            </div>
          </div>

          {/* 右：场景学习记录 */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, color: "#172b4d", fontWeight: 600 }}>
                场景学习记录
              </h3>
              <span style={{ fontSize: 12, color: "#8b98aa" }}>
                {currentScene?.sceneName || "—"}
              </span>
            </div>

            {trainingRecords.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {trainingRecords.slice(0, 6).map((rec) => {
                  const passed =
                    rec.status === "passed" ||
                    rec.score >= (currentScene?.passScore || 60);
                  return (
                    <div
                      key={rec.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        borderRadius: 8,
                        border: "1px solid #e4e7ed",
                        background: "#fff",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, color: "#172b4d" }}>
                          对练 #{rec.id.slice(-4)}
                        </strong>
                        <div style={{ fontSize: 11, color: "#8b98aa", marginTop: 2 }}>
                          {formatDate(rec.createdAt)}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: passed ? "#52c41a" : "#f5222d",
                          }}
                        >
                          {rec.score} 分
                        </span>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            background: passed ? "#f6ffed" : "#fff1f0",
                            color: passed ? "#52c41a" : "#f5222d",
                          }}
                        >
                          {passed ? "合格" : "不合格"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: "48px 16px",
                  textAlign: "center",
                  color: "#8b98aa",
                  fontSize: 13,
                  background: "#fafbfc",
                  borderRadius: 8,
                  border: "1px dashed #e4e7ed",
                }}
              >
                <HelpCircle
                  size={28}
                  color="#cbd5e1"
                  style={{ display: "block", margin: "0 auto 8px" }}
                />
                暂无对练记录
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== 5. 底部橙黄色 banner（按原型）===== */}
      <div
        style={{
          marginTop: 16,
          padding: "12px 18px",
          background: "#fff7e6",
          color: "#ad6800",
          borderRadius: 8,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid #ffe7ba",
        }}
      >
        <AlertCircle size={16} />
        实有记录：当前任务未开始学习，请尽快开始
      </div>

      {/* ===== 6. 右下角悬浮"问"按钮 ===== */}
      <SupportWidget />
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
      userName: "管理员",
      completedRecordCount: 0,
      practiceRecordCount: 0,
      examCount: 0,
      passRate: "0%",
      pendingAppealCount: 0,
      tenantName: "智训通本地验证租户",
    };
  }
}
