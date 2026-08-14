"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { ApiResponse } from "@zxt/shared";
import AppShell from "@/components/AppShell";
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

type ExamAttempt = {
  id: string;
  examId: string;
  examName: string;
  taskId: string | null;
  sceneId: string | null;
  userId: string | null;
  userName: string | null;
  score: number | null;
  totalScore: number;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

type SceneLearnStage = "study" | "practice" | "exam";
type SceneState = Record<SceneLearnStage, boolean>;

const STAGE_META: Record<SceneLearnStage, { label: string; desc: string; cta: string }> = {
  study: { label: "资料学习", desc: "查看学习资料，掌握场景要点。", cta: "开始学习" },
  practice: { label: "AI 对练", desc: "与 AI 进行模拟对话训练。", cta: "开始对练" },
  exam: { label: "场景考试", desc: "完成场景相关综合能力测评。", cta: "开始考试" },
};

const STAGE_ORDER: SceneLearnStage[] = ["study", "practice", "exam"];

function emptySceneState(): SceneState {
  return { study: false, practice: false, exam: false };
}

// ---------- 工具函数 ----------

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const raw = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_STORAGE_KEY) : null;
  const session = raw ? (JSON.parse(raw) as { token: string; user?: { id: string; name: string } }) : null;
  const token = session?.token || "";
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

function currentUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return "";
    const session = JSON.parse(raw) as { user?: { id?: string } };
    return session.user?.id || "";
  } catch {
    return "";
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

function sceneTypeLabel(type: string | null | undefined): string {
  const map: Record<string, string> = {
    free_practice: "自由对练",
    fixed_practice: "固定对练",
    free_exam: "自由考试",
    fixed_exam: "固定考试",
    scenario_training: "场景对练",
    mixed: "混合模式",
  };
  return map[type || ""] || "自由对练";
}

// ---------- 主组件 ----------

export default function TaskDetailPage() {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [error, setError] = useState("");
  const [trainingRecordsByScene, setTrainingRecordsByScene] = useState<Record<string, TrainingRecord[]>>({});
  const [examRecordsByScene, setExamRecordsByScene] = useState<Record<string, ExamAttempt[]>>({});
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recordTab, setRecordTab] = useState<"practice" | "exam">("practice");
  const [studyDone, setStudyDone] = useState<Record<string, boolean>>({});

  const taskId = typeof window !== "undefined" ? getPathId("tasks") : "";
  const scenes = detail?.scenes || [];
  const currentIdx = scenes.length ? Math.min(selectedSceneIdx, scenes.length - 1) : 0;
  const currentScene = scenes[currentIdx] || null;
  const task = detail?.task;

  useEffect(() => {
    if (!taskId) return;
    setError("");
    setDetail(null);
    setSelectedSceneIdx(0);
    setTrainingRecordsByScene({});
    setExamRecordsByScene({});
    apiFetch<TaskDetail>(`/tasks/${taskId}`)
      .then((d) => setDetail(d))
      .catch((err) => setError(err instanceof Error ? err.message : "加载任务详情失败"));
  }, [taskId]);

  useEffect(() => {
    if (!currentScene || !detail) return;
    const userId = currentUserId();
    const sceneId = currentScene.sceneId;
    const taskQuery = detail.task.id ? `&taskId=${encodeURIComponent(detail.task.id)}` : "";
    const userQuery = userId ? `&filterUserId=${encodeURIComponent(userId)}` : "";
    apiFetch<{ items: TrainingRecord[] }>(
      `/training-records?sceneId=${encodeURIComponent(sceneId)}${taskQuery}${userQuery}&pageSize=50`,
    )
      .then((res) =>
        setTrainingRecordsByScene((prev) => ({ ...prev, [sceneId]: res.items || [] })),
      )
      .catch(() => setTrainingRecordsByScene((prev) => ({ ...prev, [sceneId]: [] })));
    // 考试记录：按任务+场景+当前用户过滤，仅已完成（passed/failed）视为有效记录
    apiFetch<ExamAttempt[]>(`/exam-attempts?sceneId=${encodeURIComponent(sceneId)}${taskQuery}${userQuery}`)
      .then((res) =>
        setExamRecordsByScene((prev) => ({
          ...prev,
          [sceneId]: (res || []).filter((r) => r.status === "passed" || r.status === "failed"),
        })),
      )
      .catch(() => setExamRecordsByScene((prev) => ({ ...prev, [sceneId]: [] })));
  }, [currentScene?.sceneId, detail?.task.id]);

  // 抽屉打开时锁定页面滚动
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // 各场景学习状态（study 本地记录 / practice 对练记录 / exam 考试记录）
  const sceneStates = useMemo<Record<string, SceneState>>(() => {
    const map: Record<string, SceneState> = {};
    scenes.forEach((sc) => {
      const sceneRecords = trainingRecordsByScene[sc.sceneId] || [];
      const completedRecords = sceneRecords.filter(
        (r) => r.status === "completed" && r.score >= (sc.passScore || 60),
      );
      map[sc.id] = {
        study: !!studyDone[sc.id],
        practice:
          (sc.completedTrainCount ?? 0) >= sc.requiredTrainTimes || completedRecords.length > 0,
        // 该场景存在已完成考试记录（按任务+场景+当前用户过滤）即视为考试完成
        exam: (examRecordsByScene[sc.sceneId] || []).length > 0,
      };
    });
    return map;
  }, [scenes, trainingRecordsByScene, studyDone, examRecordsByScene]);

  const totalSteps = scenes.length * 3;
  const doneSteps = scenes.reduce(
    (n, sc) => n + STAGE_ORDER.filter((k) => sceneStates[sc.id]?.[k]).length,
    0,
  );
  const percent = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;
  const completedScenes = scenes.filter((sc) => sceneStates[sc.id]?.exam).length;
  const flowComplete =
    scenes.length > 0 && scenes.every((sc) => STAGE_ORDER.every((k) => sceneStates[sc.id]?.[k]));

  const st = currentScene ? sceneStates[currentScene.id] || emptySceneState() : emptySceneState();

  const sceneName = currentScene?.sceneName || "当前场景";
  const intro = currentScene?.sceneName
    ? `围绕“${sceneName}”完成情境学习，理解背景、流程和关键要求。`
    : "围绕当前业务场景完成情境学习，理解背景、流程和关键要求。";
  const goal = "结合场景信息完成有效沟通，准确回应诉求并推动事项闭环。";
  const aiRole = "场景沟通对象";
  const studentRole = "负责沟通与问题处理的培训学员";

  function startPractice() {
    if (!currentScene?.sceneId || !detail) return;
    const params = new URLSearchParams({
      sceneId: currentScene.sceneId,
      taskId: detail.task.id,
    });
    navigateTo(`/practice?${params.toString()}`);
  }

  function handleStageAction(stage: SceneLearnStage) {
    if (!currentScene || !detail) return;
    if (stage === "study") {
      setStudyDone((prev) => ({ ...prev, [currentScene.id]: true }));
      setDrawerOpen(true);
      return;
    }
    if (stage === "practice") {
      startPractice();
      return;
    }
    // exam：场景考试在管理端无独立答题路由，跳转"我的考试"列表并携带任务/场景上下文
    const params = new URLSearchParams({
      section: "my-exams",
      taskId: detail.task.id,
      sceneId: currentScene.sceneId,
    });
    navigateTo(`/?${params.toString()}`);
  }

  // ---------- 场景进度轨道 ----------
  const sceneRail = scenes.map((sc, i) => {
    const scSt = sceneStates[sc.id] || emptySceneState();
    const complete = scSt.exam;
    const current = i === currentIdx;
    const cls = [
      current ? "current" : "",
      complete ? "done" : "",
      complete && scenes.length === 1 ? "single-complete" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const statusText = complete ? "已完成" : current ? "进行中" : "待开始";
    return (
      <Fragment key={sc.id}>
        <button
          className={`task-scene-tab ${cls}`}
          type="button"
          onClick={() => setSelectedSceneIdx(i)}
        >
          <span className="task-scene-tab-status">{statusText}</span>
          <div className="task-scene-tab-head">
            <span className="task-scene-tab-number">{i + 1}</span>
            <h3>{sc.sceneName || "场景"}</h3>
          </div>
          <p>{intro}</p>
        </button>
        {i < scenes.length - 1 && <span className="task-scene-arrow">›</span>}
      </Fragment>
    );
  });

  // ---------- 场景学习步骤 ----------
  const steps = STAGE_ORDER.map((key) => {
    const isDone = st[key];
    // 场景内顺序：资料学习/对练可直接开始，考试需先完成对练
    const unlocked = key === "exam" ? st.practice : true;
    const active = !isDone && unlocked;
    const meta = STAGE_META[key];
    // 完成后：按钮变蓝（默认 btn），对练/考试文案带"再次"
    const ctaLabel = isDone
      ? key === "practice"
        ? "再次对练"
        : key === "exam"
          ? "再次考试"
          : meta.cta
      : meta.cta;
    return (
      <div className={`task-step-row ${isDone ? "done" : active ? "active" : ""}`} key={key}>
        <span className="task-step-index">
          {isDone ? "✓" : key === "study" ? "1" : key === "practice" ? "2" : "3"}
        </span>
        <div className="task-step-content">
          <b>{meta.label}</b>
          <span>{meta.desc}</span>
        </div>
        <div className="task-step-action">
          <button
            className={`btn ${isDone ? "" : "gray"}`}
            type="button"
            disabled={!unlocked}
            onClick={() => handleStageAction(key)}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    );
  });

  // ---------- 场景学习记录 ----------
  // 对练记录：仅显示当前场景已完成的记录（对练完成后才生成记录报告）
  const practiceRecords = (trainingRecordsByScene[currentScene?.sceneId || ""] || []).filter(
    (r) => r.status === "completed",
  );
  // 考试记录：当前场景的已完成考试记录
  const examRecordList = examRecordsByScene[currentScene?.sceneId || ""] || [];
  const recordList =
    recordTab === "practice" ? (
      practiceRecords.length ? (
        practiceRecords.slice(0, 8).map((r) => (
          <div className="task-record-row" key={r.id}>
            <strong>{formatDate(r.createdAt)}</strong>
            <span>{r.score}分</span>
            <a onClick={startPractice}>查看报告 ›</a>
          </div>
        ))
      ) : (
        <div className="task-record-empty">完成 AI 对练后显示对练记录</div>
      )
    ) : examRecordList.length ? (
      examRecordList.slice(0, 8).map((r) => (
        <div className="task-record-row" key={r.id}>
          <strong>{formatDate(r.finishedAt || r.createdAt)}</strong>
          <span>{r.score ?? 0}分</span>
          <a onClick={() => navigateTo("/?section=my-exams")}>查看报告 ›</a>
        </div>
      ))
    ) : (
      <div className="task-record-empty">完成场景考试后显示考试记录</div>
    );

  if (!detail || !task) {
    return (
      <AppShell
        activeNavKey="my-tasks"
        onNavClick={(key: string) => navigateTo("/?section=" + key)}
        breadcrumb={{ label: "我的任务", childLabel: "任务详情" }}
      >
        {error && <div className="notice">{error}</div>}
        <div className="empty" style={{ padding: 40 }}>加载中...</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      activeNavKey="my-tasks"
      onNavClick={(key: string) => navigateTo("/?section=" + key)}
      breadcrumb={{ label: "我的任务", childLabel: "任务详情" }}
    >
      <div className="task-detail-page">
        {error && <div className="notice">{error}</div>}

        {/* 顶部标题（原型 .task-detail-top / .task-detail-title） */}
        <div className="task-detail-top">
          <div className="task-detail-title">
            <h1>
              任务详情{" "}
              <span className={`tag ${flowComplete ? "green" : "blue"}`}>
                {flowComplete ? "已完成" : "进行中"}
              </span>
            </h1>
            <p>任务编号：{task.code || task.id}</p>
          </div>
          <button className="btn outline" type="button" onClick={() => navigateTo("/?section=my-tasks")}>
            返回我的任务
          </button>
        </div>

        {/* 任务摘要（原型 .task-summary-card） */}
        <div className="task-summary-card card">
          <h3>任务描述</h3>
          <p>{task.description || "完成各场景学习、对练与考试，按顺序推进任务进度。"}</p>
          <div className="task-summary-meta">
            <div>
              <i>◷</i>
              <span>
                <small>截止时间</small>
                <strong>{formatDate(task.endAt)}</strong>
              </span>
            </div>
            <div>
              <i>◉</i>
              <span>
                <small>整体进度</small>
                <strong>
                  {percent}%（{completedScenes}/{scenes.length} 场景）
                </strong>
              </span>
            </div>
            <div>
              <i>▣</i>
              <span>
                <small>发布部门</small>
                <strong>{task.creatorOrgName || "培训管理部"}</strong>
              </span>
            </div>
          </div>
          <div className="task-progress">
            <i style={{ width: `${percent}%` }} />
          </div>
        </div>

        {/* 场景学习标题 */}
        <div className="task-detail-section-title">
          <h2>场景学习</h2>
          <span>点击场景可自由选择学习，按流程完成各环节</span>
        </div>

        {/* 场景进度轨道 */}
        <div className="task-scene-rail">{sceneRail}</div>

        {/* 当前场景卡 */}
        {currentScene && (
          <div className="task-current-card card">
            <div className="task-current-head">
              <div>
                <h3>{currentScene.sceneName || "场景"}</h3>
                <p>{intro}</p>
              </div>
              <div className="task-current-meta">
                <span>
                  合格标准<b>≥{currentScene.passScore || 60}%</b>
                </span>
                <span>
                  任务类型<b>{sceneTypeLabel(currentScene.sceneType)}</b>
                </span>
                <span>
                  回答形式<b>{currentScene.mode === "text" ? "文本输入" : "语音输入"}</b>
                </span>
              </div>
            </div>

            {/* 场景信息（紧凑单行：场景号 + 4 个要点） */}
            <section className="task-scene-info">
              <span className="task-scene-info-badge">
                场景 {String(currentIdx + 1).padStart(2, "0")}
              </span>
              <div className="task-info-block">
                <label>场景介绍</label>
                <p title={intro}>{intro}</p>
              </div>
              <div className="task-info-block">
                <label>对话目标</label>
                <p title={goal}>{goal}</p>
              </div>
              <div className="task-info-block">
                <label>AI 身份</label>
                <p title={aiRole}>{aiRole}</p>
              </div>
              <div className="task-info-block">
                <label>学员身份</label>
                <p title={studentRole}>{studentRole}</p>
              </div>
            </section>

            {/* 双列：场景学习 + 场景学习记录 */}
            <div className="task-current-grid">
              <div>
                <h3 className="task-column-title">场景学习</h3>
                <p className="task-column-sub">{currentScene.sceneName || "—"}</p>
                <div className="task-step-panel">
                  {steps}
                  <div className={`task-next-tip ${st.exam ? "done" : ""}`}>
                    {st.exam
                      ? "当前场景已完成，可选择下一个场景。"
                      : st.practice
                        ? "完成 AI 对练后，解锁场景考试。"
                        : "资料学习和 AI 对练均可直接开始，完成 AI 对练后解锁场景考试。"}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="task-column-title">场景学习记录</h3>
                <p className="task-column-sub">{currentScene.sceneName || "—"}</p>
                <div className="task-record-panel">
                  <div className="task-record-tabs">
                    <span
                      className={recordTab === "practice" ? "active" : ""}
                      onClick={() => setRecordTab("practice")}
                    >
                      对练记录
                    </span>
                    <span
                      className={recordTab === "exam" ? "active" : ""}
                      onClick={() => setRecordTab("exam")}
                    >
                      考试记录
                    </span>
                  </div>
                  <div className="task-record-list">{recordList}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 学习资料预览抽屉（原型 #file-preview drawer-shell） */}
        <div
          className={`file-preview-page drawer-shell ${drawerOpen ? "drawer-open" : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="file-preview-top">
            <div className="file-preview-title">
              <h1>{task.name} · 学习资料预览</h1>
              <p>任务详情 / {sceneName} / 学习资料</p>
            </div>
            <button className="btn outline" type="button" onClick={() => setDrawerOpen(false)}>
              返回任务详情
            </button>
          </div>
          <div className="file-preview-card card">
            <div className="file-preview-head">
              <div>
                <h2>{sceneName}</h2>
                <p>资料预览 · 已自动记录学习进度</p>
              </div>
              <span className="file-type">
                <i>DOC</i>培训资料
              </span>
            </div>
            <div className="file-preview-body">
              <article className="file-sheet">
                <span className="file-sheet-kicker">智训通 · 场景学习资料</span>
                <h3>{sceneName}</h3>
                <div className="file-line" />
                <p>本资料用于帮助学员了解当前训练场景、关键流程和沟通要求，请结合实际工作认真学习。</p>
                <h4>一、学习目标</h4>
                <p>了解场景背景与任务要求，掌握处理问题的基本步骤，能够在实际对练中完成有效沟通。</p>
                <h4>二、场景要点</h4>
                <p>{intro} 围绕场景要求进行分析，保持专业表达，准确回应问题并推动事项闭环。</p>
                <h4>三、学习提示</h4>
                <p>完成资料阅读后，可返回任务详情继续进行 AI 对练；资料支持重复进入查看。</p>
              </article>
            </div>
            <div className="file-preview-foot">
              <span>学习资料可重复查看</span>
              <div>
                <button className="btn outline" type="button" onClick={() => setDrawerOpen(false)}>
                  返回任务详情
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    startPractice();
                  }}
                >
                  进入 AI 对练
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
