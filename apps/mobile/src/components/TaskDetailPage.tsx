"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { taskApi, sceneApi } from "@/lib/api";
import { taskDisplayStatus, taskTypeText, taskFormText } from "@/lib/types";
import { isMaterialDone, markMaterialDone, getExamCount, getExamRecords } from "@/lib/sceneProgress";
import { pathForTask, pathForTaskScene, type MobileRouteState, type TaskRouteView } from "@/lib/mobileRoutes";
import PracticeReport from "./PracticeReport";
import ExamReport from "./ExamReport";
import MobilePageAction from "./MobilePageAction";

interface TaskDetailPageProps {
  taskId: string | null;
  routeState: MobileRouteState;
  onBack: () => void;
  showToast: (msg: string) => void;
}

type View = TaskRouteView;

export default function TaskDetailPage({ taskId, routeState, onBack, showToast }: TaskDetailPageProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<any>(null);
  const view = routeState.taskView;
  const [sceneIndex, setSceneIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sceneDetail, setSceneDetail] = useState<any>(null);
  // 对练报告会话（练习结束后进入报告流程）
  const reportSessionId = routeState.practiceReportSessionId;
  const reportRecordId = routeState.practiceReportRecordId;
  // 本地考试次数只用于展示；可信完成状态仍以服务端场景训练计数为准。
  const [examCounts, setExamCounts] = useState<Record<string, number>>({});

  /** 考试完成回调：刷新本地展示次数 */
  const handleExamFinished = useCallback(() => {
    const ts = detail?.scenes?.[sceneIndex];
    if (!ts) return;
    const next = getExamCount(ts.sceneId);
    setExamCounts((prev) => ({ ...prev, [ts.sceneId]: next }));
    showToast("考试已完成，成绩已记录");
  }, [detail, sceneIndex, showToast]);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    setSceneDetail(null);
    taskApi
      .detail(taskId)
      .then((data) => setDetail(data))
      .catch(() => showToast("任务详情加载失败"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    if (!detail || !routeState.sceneId) return;
    const nextIndex = (detail.scenes || []).findIndex((s: any) => s.sceneId === routeState.sceneId);
    if (nextIndex < 0) {
      showToast("场景不存在或已删除");
      router.replace(taskId ? pathForTask(taskId) : "/tasks");
      return;
    }
    setSceneIndex(nextIndex);
    let alive = true;
    sceneApi
      .detail(routeState.sceneId)
      .then((sd) => {
        if (alive) setSceneDetail(sd);
      })
      .catch(() => {
        if (alive) {
          setSceneDetail(null);
          showToast("场景加载失败");
        }
      });
    return () => {
      alive = false;
    };
  }, [detail, routeState.sceneId, router, showToast, taskId]);

  /** 跳转到指定场景视图 */
  const enterSceneView = useCallback(
    (index: number, target: View) => {
      if (!taskId || !detail || !detail.scenes || !detail.scenes[index]) return;
      const ts = detail.scenes[index];
      router.push(pathForTaskScene(taskId, ts.sceneId, target));
    },
    [detail, router, taskId]
  );

  const openScenario = useCallback(
    (index: number) => {
      enterSceneView(index, "workspace");
    },
    [enterSceneView]
  );

  if (loading) {
    return (
      <>
        <div className="task-detail-head">
          <MobilePageAction kind="back" onClick={onBack} aria-label="返回任务列表" />
          <div className="task-detail-title">
            <h1>任务详情</h1>
            <p>查看任务要求与学习进度</p>
          </div>
        </div>
        <div className="task-empty">加载中…</div>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <div className="task-detail-head">
          <MobilePageAction kind="back" onClick={onBack} aria-label="返回任务列表" />
          <div className="task-detail-title">
            <h1>任务详情</h1>
            <p>查看任务要求与学习进度</p>
          </div>
        </div>
        <div className="task-empty">任务不存在或已删除</div>
      </>
    );
  }

  const task = detail.task;
  const scenes = detail.scenes || [];
  const doneCount = scenes.filter((s: any) => (s.completedTrainCount || 0) > 0).length;
  const percent = scenes.length ? Math.round((doneCount / scenes.length) * 100) : 0;
  const isStopped = task.status === "stopped";
  const runtimeStatus = taskDisplayStatus(task);
  const isOverdue = runtimeStatus === "已逾期";
  const cls = runtimeStatus === "已停用" ? "stopped" : runtimeStatus === "已完成" ? "done" : runtimeStatus === "已逾期" ? "overdue" : "doing";

  const sceneMeta = scenes[sceneIndex];
  const sceneRoute = (target: View, reportId?: string | null) => {
    if (!taskId || !sceneMeta?.sceneId) return "/tasks";
    return pathForTaskScene(taskId, sceneMeta.sceneId, target, reportId);
  };

  if (view !== "detail" && routeState.sceneId && (!sceneDetail || sceneMeta?.sceneId !== routeState.sceneId)) {
    return (
      <>
        <div className="task-detail-head">
          <MobilePageAction kind="back" onClick={() => router.push(taskId ? pathForTask(taskId) : "/tasks")} aria-label="返回任务详情" />
          <div className="task-detail-title">
            <h1>场景加载中</h1>
            <p>正在打开对应学习页面</p>
          </div>
        </div>
        <div className="task-empty">加载中…</div>
      </>
    );
  }

  const practiceConfirmAction = routeState.modal === "practiceQuitConfirm" ? "quit" : routeState.modal === "practiceEndConfirm" ? "end" : null;
  const openPracticeConfirm = (action: "quit" | "end") => {
    const modal = action === "quit" ? "practiceQuitConfirm" : "practiceEndConfirm";
    router.push(`${sceneRoute("practice")}?modal=${modal}`);
  };
  const closePracticeConfirm = () => {
    router.push(sceneRoute("practice"));
  };

  if (view === "workspace") {
    return (
      <ScenarioWorkspace
        scene={sceneDetail}
        task={task}
        sceneMeta={scenes[sceneIndex]}
        index={sceneIndex}
        total={scenes.length}
        onBackToDetail={() => router.push(taskId ? pathForTask(taskId) : "/tasks")}
        onEnterMaterial={() => router.push(sceneRoute("material"))}
        onEnterPractice={() => router.push(sceneRoute("practice"))}
        onEnterExam={() => router.push(sceneRoute("exam"))}
        onOpenPracticeReport={(recordId) => router.push(sceneRoute("report", recordId))}
        onOpenExamReport={(recordId) => router.push(sceneRoute("examReport", recordId))}
        showToast={showToast}
      />
    );
  }

  if (view === "practice") {
    return (
      <PracticeView
        scene={sceneDetail}
        task={task}
        onBack={() => router.push(sceneRoute("workspace"))}
        showToast={showToast}
        confirmAction={practiceConfirmAction}
        onOpenConfirm={openPracticeConfirm}
        onCloseConfirm={closePracticeConfirm}
        onReport={(sessionId) => {
          router.push(`${sceneRoute("report")}?sessionId=${encodeURIComponent(sessionId)}`);
        }}
      />
    );
  }

  if (view === "report") {
    return (
      <PracticeReport
        sessionId={reportSessionId || undefined}
        recordId={reportRecordId || undefined}
        scene={sceneDetail}
        task={task}
        onClose={() => router.push(sceneRoute("workspace"))}
        showToast={showToast}
      />
    );
  }

  if (view === "exam") {
    return (
      <ScenarioExam
        scene={sceneDetail}
        task={task}
        onBack={() => router.push(sceneRoute("workspace"))}
        onFinished={handleExamFinished}
        showToast={showToast}
      />
    );
  }

  if (view === "examReport") {
    const record = routeState.sceneId && routeState.sceneExamRecordId
      ? getExamRecords(routeState.sceneId).find((item) => item.id === routeState.sceneExamRecordId)
      : null;
    if (!record) {
      return (
        <>
          <div className="task-detail-head">
            <MobilePageAction kind="back" onClick={() => router.push(sceneRoute("workspace"))} aria-label="返回场景工作台" />
            <div className="task-detail-title">
              <h1>场景考试报告</h1>
              <p>查看本次考试结果</p>
            </div>
          </div>
          <div className="task-empty">考试报告不存在或已删除</div>
        </>
      );
    }
    return (
      <ExamReport
        record={record}
        sceneName={sceneDetail?.scene?.name || sceneMeta?.sceneName || "场景考试"}
        taskName={task?.name}
        onClose={() => router.push(sceneRoute("workspace"))}
      />
    );
  }

  if (view === "material") {
    return (
      <MaterialView
        scene={sceneDetail}
        sceneMeta={scenes[sceneIndex]}
        onBack={() => router.push(sceneRoute("workspace"))}
        onDone={() => {
          const ts = sceneMeta;
           if (ts) markMaterialDone(ts.sceneId);
           router.push(sceneRoute("workspace"));
        }}
        showToast={showToast}
      />
    );
  }

  return (
    <>
      <div className="task-detail-head">
        <MobilePageAction kind="back" onClick={onBack} aria-label="返回任务列表" />
        <div className="task-detail-title">
          <h1>任务详情</h1>
          <p>查看任务要求与学习进度</p>
        </div>
      </div>
      <div id="taskDetailContent">
        <div className="task-detail-hero compact">
          <div className="detail-kicker">
            <span className="dot"></span>
            <span>任务详情 · {task.code}</span>
            <span className={`task-detail-status status ${cls}`} style={{ marginLeft: "auto" }}>
              {runtimeStatus}
            </span>
          </div>
          <div className="task-detail-main">
            <h2>{task.name}</h2>
            <p>
              {taskTypeText(task.type)} | {taskFormText(task.answerForm)} |{" "}
              {task.creatorOrgName || "全体员工"}
            </p>
            <p className="task-detail-description compact">{task.description || "完成本任务要求的学习内容，并查看每个场景的学习结果。"}</p>
          </div>
          <div className="task-detail-progress compact">
            <div className="compact-progress-left">
              <div className="task-detail-progress-head">
                <b>学习进度</b>
                <strong>
                  {doneCount}/{scenes.length}
                </strong>
              </div>
            </div>
            <div className="compact-progress-right">
              <div className="task-detail-progress-bar">
                <span className={cls} style={{ width: `${percent}%` }} />
              </div>
              <div className="task-detail-progress-meta">
                <span>已学习 {doneCount} 个场景</span>
                <span>截止 {(task.endAt || "").slice(0, 10)}</span>
              </div>
            </div>
          </div>
        </div>
        {isStopped && <div className="task-detail-description compact" style={{ color: "#b42318", marginTop: 12 }}>任务已停用，无法继续学习。</div>}
        <div className="scenario-section-head">
          <h3>学习场景</h3>
          <span className="section-hint">资料 → 对练 → 考试</span>
        </div>
        <div className="scenario-list">
          {scenes.map((sc: any, i: number) => {
            const trainDone = (sc.completedTrainCount || 0) > 0;
            const required = sc.requiredTrainTimes || 1;
            const practiceDone = (sc.completedTrainCount || 0) >= required;
            // 资料标记是本机阅读提示；真正完成状态只看后端 completedTrainCount。
            const materialDone = isMaterialDone(sc.sceneId) || trainDone;
            const examCount = examCounts[sc.sceneId] ?? getExamCount(sc.sceneId);
            return (
              <article
                key={sc.id}
                className={`scenario-card scene-layout ${trainDone ? "done" : ""}`}
                onClick={() => { if (!isStopped) openScenario(i); }}
                 style={{ cursor: isStopped ? "default" : "pointer" }}
               >
                <div className="scenario-timeline">
                  <span className="scenario-index">{String(i + 1).padStart(2, "0")}</span>
                  <span className="scenario-timeline-line"></span>
                </div>
                <div className="scenario-content">
                  <div className="scenario-heading">
                    <div className="scenario-main">
                      <b>{sc.sceneName}</b>
                      <p>{(sc.sceneType || "场景训练")}</p>
                    </div>
                    <span className="scenario-arrow">›</span>
                  </div>
                  <div className="scenario-state-row">
                    <span className={`scenario-state ${practiceDone ? "done" : "doing"}`}>
                      {practiceDone ? "流程已完成" : "进行中"}
                    </span>
                    <span className="scenario-progress-text">
                      {!materialDone ? "先学资料再对练" : practiceDone ? "可反复对练与考试" : `对练 ${sc.completedTrainCount || 0}/${required}`}
                    </span>
                    <div className="scenario-mini-progress">
                      <span style={{ width: `${practiceDone ? 100 : materialDone ? 55 : 20}%` }} />
                    </div>
                  </div>
                  <div className="scenario-counts">
                    <span>对练 {sc.completedTrainCount || 0} 次</span>
                    <span className="counts-divider"></span>
                    <span>考试 {examCount} 次</span>
                  </div>
                  <div className="scenario-actions">
                     <button
                       type="button"
                       className="material-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isStopped) return;
                          enterSceneView(i, "material");
                        }}
                        disabled={isStopped}
                     >
                       查看资料{materialDone ? " ✓" : ""}
                     </button>
                     <button
                       type="button"
                       className={`practice-btn${(isOverdue || materialDone) ? "" : " locked"}`}
                       onClick={(e) => {
                         e.stopPropagation();
                         if (isStopped) return;
                         if (!isOverdue && !materialDone) {
                           showToast("请先完成资料学习，再开始 AI 对练");
                           return;
                         }
                         enterSceneView(i, "practice");
                       }}
                       disabled={isStopped}
                     >
                       {trainDone ? "再次对练" : "开始对练"}
                     </button>
                     <button
                       type="button"
                       className={`exam-btn${(isOverdue || practiceDone) ? "" : " locked"}`}
                       onClick={(e) => {
                         e.stopPropagation();
                         if (isStopped) return;
                         if (!isOverdue && !practiceDone) {
                           showToast("请先完成 AI 对练，再进行考试");
                           return;
                         }
                         enterSceneView(i, "exam");
                       }}
                       disabled={isStopped}
                     >
                       {examCount > 0 ? "再次考试" : "开始考试"}
                     </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ===== 场景工作台 =====
import ScenarioWorkspace from "./ScenarioWorkspace";
import PracticeView from "./PracticeView";
import ScenarioExam from "./ScenarioExam";
import MaterialView from "./MaterialView";
