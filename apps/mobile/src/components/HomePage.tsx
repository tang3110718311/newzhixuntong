"use client";

import { useEffect, useState } from "react";
import { taskApi, tenantApi, type AuthUser, type TaskRow, type TenantRow } from "@/lib/api";
import { getExamCount } from "@/lib/sceneProgress";
import { isTaskStopped, statusClass, taskTypeText, taskDisplayStatus } from "@/lib/types";
import type { PageKey } from "./MobileApp";
import type { MobileModalKey } from "@/lib/mobileRoutes";

interface HomePageProps {
  user: AuthUser | null;
  onNavigate: (p: PageKey) => void;
  onOpenTask: (taskId: string) => void;
  onOpenExam: (taskId: string, sceneId: string) => void;
  showToast: (msg: string) => void;
  onSwitchTenant: (tenantCode: string) => Promise<boolean>;
  modal: MobileModalKey | null;
  onOpenModal: (modal: MobileModalKey) => void;
  onCloseModal: () => void;
}

interface RecentExam { taskId: string; taskName: string; sceneId: string; sceneName: string; }

export default function HomePage({ user, onNavigate, onOpenTask, onOpenExam, showToast, onSwitchTenant, modal, onOpenModal, onCloseModal }: HomePageProps) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [recentExams, setRecentExams] = useState<RecentExam[]>([]);
  const [loading, setLoading] = useState(true);
  // 切换企业弹窗
  const showTenantModal = modal === "tenant";
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [tenantOpen, setTenantOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [recentTab, setRecentTab] = useState<"tasks" | "exams">("tasks");

  useEffect(() => {
    let alive = true;
    taskApi.list({ pageSize: 100 })
      .then((t) => {
        if (!alive) return;
        const items = t.items || [];
        setTasks(items);
        Promise.all(items.map(async (task) => {
          if (isTaskStopped(task)) return [] as RecentExam[];
          try {
            const detail = await taskApi.detail(task.id);
            return (detail.scenes || [])
              .filter((scene: any) => (scene.completedTrainCount || 0) >= (scene.requiredTrainTimes || 1))
              .filter((scene: any) => getExamCount(scene.sceneId) === 0)
              .map((scene: any) => ({ taskId: task.id, taskName: task.name, sceneId: scene.sceneId, sceneName: scene.sceneName || "未命名场景" }));
          } catch { return [] as RecentExam[]; }
        })).then((groups) => alive && setRecentExams(groups.flat().slice(0, 3)));
      })
      .catch(() => showToast("数据加载失败"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打开切换企业弹窗时拉取可切换列表
  const openTenantModal = async () => {
    onOpenModal("tenant");
    setTenantOpen(false);
    if (tenants.length > 0) return;
    try {
      const data = await tenantApi.mine();
      setTenants(data.items || []);
      setSelectedCode((data.items || []).find((t) => t.id === data.current)?.code || (data.items || [])[0]?.code || "");
    } catch {
      showToast("获取企业列表失败");
    }
  };

  const confirmSwitchTenant = async () => {
    if (!selectedCode || selectedCode === user?.tenantCode) {
      onCloseModal();
      return;
    }
    setSwitching(true);
    try {
      const okFlag = await onSwitchTenant(selectedCode);
      if (okFlag) onCloseModal();
    } finally {
      setSwitching(false);
    }
  };

  const done = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.length;
  const remaining = total - done;
  const pending = tasks.filter((t) => t.status !== "completed").length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  const recentTasks = tasks.slice(0, 3);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return "夜深了";
    if (h < 12) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  })();

  return (
    <>
      <div className="topline">
        <div className="brand">
          <span className="brand-mark"></span>智训通
        </div>
        <button className="hello" onClick={openTenantModal}>
          {user?.tenantName || "智训通"}
          <i className="hello-arrow">▾</i>
        </button>
      </div>
      <div className="welcome-progress">
        <div className="hero">
          <small>
            {greeting}，{user?.name || "同学"}
          </small>
          <h1>让每一次培训，都看得见成长</h1>
          <p id="homePendingHint">
            今日有 {pending} 项培训任务待完成
          </p>
          <div className="hero-bot-wrap">
            <img className="hero-bot-img" src={`${process.env.NEXT_PUBLIC_APP_BASE_PATH || ""}/cute-3d-training-robot.png`} alt="AI 智能培训助手" />
          </div>
        </div>
        <div className="learning-progress">
          <div className="learning-progress-head">
            <b>本月学习进度</b>
            <span id="homeProgressLabel">
              已完成 {done} / {total} 项任务
            </span>
          </div>
          <div className="progress-summary">
            <strong id="homeProgressPercent">{percent}%</strong>
            <span>整体完成进度</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" id="homeProgressFill" style={{ width: `${percent}%` }} />
          </div>
          <div className="progress-meta">
            <span>
              已完成 <strong id="homeCompletedCount">{done}</strong> 项
            </span>
            <span>
              剩余 <strong id="homeRemainingCount">{remaining}</strong> 项
            </span>
          </div>
        </div>
      </div>
      <div className="notice">
        <b>学习提醒</b>请按时完成已派发的培训、对练与考试任务，系统将同步记录学习结果。
      </div>
      <div className="section-title">
        <h2>快捷入口</h2>
      </div>
      <div className="quick-grid">
        <button className="quick task" onClick={() => onNavigate("tasks")}>
          <strong>我的任务</strong>
          <small>查看培训与对练任务</small>
          <b id="homeTaskCount">{pending}</b>
        </button>
        <button className="quick ability" onClick={() => onNavigate("ability")}>
          <strong>综合能力</strong>
          <small>查看能力评估与成长建议</small>
          <b>›</b>
        </button>
      </div>
      <div className="recent-heading">
        <div className="recent-tabs" role="tablist" aria-label="首页最近记录">
          <button
            type="button"
            className={`recent-tab ${recentTab === "tasks" ? "active" : ""}`}
            onClick={() => setRecentTab("tasks")}
            role="tab"
            aria-selected={recentTab === "tasks"}
          >
            最近任务
          </button>
          <button
            type="button"
            className={`recent-tab ${recentTab === "exams" ? "active" : ""}`}
            onClick={() => setRecentTab("exams")}
            role="tab"
            aria-selected={recentTab === "exams"}
          >
            最近考试
          </button>
        </div>
        <a className="recent-all" onClick={() => onNavigate("tasks")}>全部 ›</a>
      </div>
      <div className="recent-panel active">
          <div className="recent-box" role="tabpanel">
            {recentTab === "exams" && (recentExams.length === 0 ? <div className="recent-item recent-empty"><span className="type-dot">▣</span><div className="recent-main"><b>暂无可参加考试</b><small>完成场景 AI 对练后，考试会显示在这里</small></div></div> : recentExams.map((exam) => <div className="recent-item" key={`${exam.taskId}-${exam.sceneId}`} onClick={() => onOpenExam(exam.taskId, exam.sceneId)} style={{ cursor: "pointer" }}><span className="type-dot exam">▣</span><div className="recent-main"><b>{exam.sceneName}</b><small>{exam.taskName} · AI 对练已完成</small></div><span className="status exam-ready">开始考试</span><span className="recent-arrow">›</span></div>))}
            {recentTab === "tasks" && <>
            {recentTasks.length === 0 && (
              <div className="recent-item">
                <span className="type-dot">✓</span>
                <div className="recent-main">
                  <b>暂无任务</b>
                  <small>任务派发后将在首页显示</small>
                </div>
              </div>
            )}
            {recentTasks.map((t) => {
              const isPractice = (t.type || "").includes("practice") || (t.type || "").includes("scenario");
              const stText = taskDisplayStatus(t);
              return (
                <div
                  className="recent-item"
                  key={t.id}
                  onClick={() => onOpenTask(t.id)}
                  style={{ cursor: "pointer" }}
                >
                  <span className="type-dot">{isPractice ? "✦" : "✓"}</span>
                  <div className="recent-main">
                    <b>{t.name}</b>
                    <small>
                      {taskTypeText(t.type)} · {stText === "已逾期" ? "建议尽快完成" : `完成 ${t.progressPercent || 0}%`}
                    </small>
                  </div>
                  <span className={`status ${statusClass(stText)}`}>{stText}</span>
                </div>
              );
            })}
            </>}
          </div>
      </div>

      {/* 切换企业弹窗 */}
      {showTenantModal && (
        <div className="tenant-mask" onClick={() => !switching && onCloseModal()}>
          <div className="tenant-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="tenant-modal-title">切换企业</h3>
            <div className="tenant-select-wrap">
              <button
                type="button"
                className="tenant-select"
                onClick={() => !switching && setTenantOpen((v) => !v)}
                disabled={switching}
              >
                <span className="tenant-select-text">
                  {tenants.find((t) => t.code === selectedCode)?.name ||
                    (tenants.length === 0 ? "加载中…" : "请选择企业")}
                </span>
                <i className={`tenant-select-arrow${tenantOpen ? " open" : ""}`}>▾</i>
              </button>
              {tenantOpen && (
                <div className="tenant-option-list">
                  {tenants.length === 0 && <div className="tenant-option empty">加载中…</div>}
                  {tenants.map((t) => (
                    <div
                      key={t.id}
                      className={`tenant-option${t.code === selectedCode ? " active" : ""}`}
                      onClick={() => {
                        setSelectedCode(t.code);
                        setTenantOpen(false);
                      }}
                    >
                      <span className="tenant-option-name">{t.name}</span>
                      {t.code === selectedCode && <i className="tenant-option-check">✓</i>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="tenant-modal-actions">
              <button className="tenant-btn cancel" onClick={onCloseModal} disabled={switching}>
                取消
              </button>
              <button className="tenant-btn confirm" onClick={confirmSwitchTenant} disabled={switching}>
                {switching ? "切换中…" : "确认切换"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
