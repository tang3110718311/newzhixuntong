"use client";

import { useCallback, useEffect, useState } from "react";
import { taskApi, sceneApi, recordApi, aiApi } from "@/lib/api";
import { taskStatusText, taskTypeText, taskFormText } from "@/lib/types";
import { isMaterialDone, markMaterialDone, getExamCount } from "@/lib/sceneProgress";
import PracticeReport from "./PracticeReport";

interface TaskDetailPageProps {
  taskId: string | null;
  onBack: () => void;
  showToast: (msg: string) => void;
}

type View = "detail" | "workspace" | "practice" | "exam" | "material" | "report";

export default function TaskDetailPage({ taskId, onBack, showToast }: TaskDetailPageProps) {
  const [detail, setDetail] = useState<any>(null);
  const [view, setView] = useState<View>("detail");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sceneDetail, setSceneDetail] = useState<any>(null);
  // 对练报告会话（练习结束后进入报告流程）
  const [reportSessionId, setReportSessionId] = useState<string | null>(null);
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
    setView("detail");
    setSceneDetail(null);
    taskApi
      .detail(taskId)
      .then((data) => setDetail(data))
      .catch(() => showToast("任务详情加载失败"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  /** 加载指定场景详情并跳转到目标视图 */
  const enterSceneView = useCallback(
    async (index: number, target: View) => {
      if (!detail || !detail.scenes || !detail.scenes[index]) return;
      const ts = detail.scenes[index];
      setSceneIndex(index);
      try {
        const sd = await sceneApi.detail(ts.sceneId);
        setSceneDetail(sd);
        setView(target);
      } catch {
        setSceneDetail(null);
        showToast("场景加载失败");
      }
    },
    [detail, showToast]
  );

  const openScenario = useCallback(
    async (index: number) => {
      if (!detail || !detail.scenes || !detail.scenes[index]) return;
      setSceneIndex(index);
      setView("workspace");
      const ts = detail.scenes[index];
      try {
        const sd = await sceneApi.detail(ts.sceneId);
        setSceneDetail(sd);
      } catch {
        setSceneDetail(null);
        showToast("场景加载失败");
      }
    },
    [detail, showToast]
  );

  if (loading) {
    return (
      <>
        <div className="task-detail-head">
          <button className="task-detail-back" type="button" onClick={onBack} aria-label="返回任务列表">
            ‹
          </button>
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
          <button className="task-detail-back" type="button" onClick={onBack} aria-label="返回任务列表">
            ‹
          </button>
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
  const cls = task.status === "completed" ? "done" : task.status === "stopped" ? "overdue" : "doing";

  if (view === "workspace") {
    return (
      <ScenarioWorkspace
        scene={sceneDetail}
        task={task}
        sceneMeta={scenes[sceneIndex]}
        index={sceneIndex}
        total={scenes.length}
        onBackToDetail={() => setView("detail")}
        onEnterMaterial={() => setView("material")}
        onEnterPractice={() => setView("practice")}
        onEnterExam={() => setView("exam")}
        showToast={showToast}
      />
    );
  }

  if (view === "practice") {
    return (
      <PracticeView
        scene={sceneDetail}
        task={task}
        onBack={() => setView("workspace")}
        showToast={showToast}
        onReport={(sessionId) => {
          setReportSessionId(sessionId);
          setView("report");
        }}
      />
    );
  }

  if (view === "report") {
    return (
      <PracticeReport
        sessionId={reportSessionId || ""}
        scene={sceneDetail}
        task={task}
        onClose={() => setView("workspace")}
        showToast={showToast}
      />
    );
  }

  if (view === "exam") {
    return (
      <ScenarioExam
        scene={sceneDetail}
        task={task}
        onBack={() => setView("workspace")}
        onFinished={handleExamFinished}
        showToast={showToast}
      />
    );
  }

  if (view === "material") {
    return (
      <MaterialView
        scene={sceneDetail}
        sceneMeta={scenes[sceneIndex]}
        onBack={() => setView("detail")}
        onDone={() => {
          const ts = scenes[sceneIndex];
          if (ts) markMaterialDone(ts.sceneId);
          setView("detail");
        }}
        showToast={showToast}
      />
    );
  }

  return (
    <>
      <div className="task-detail-head">
        <button className="task-detail-back" type="button" onClick={onBack} aria-label="返回任务列表">
          ‹
        </button>
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
              {taskStatusText(task.status)}
            </span>
          </div>
          <div className="task-detail-main">
            <h2>{task.name}</h2>
            <p>
              {taskTypeText(task.type)} | {taskFormText(task.primaryMode)} |{" "}
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
                onClick={() => openScenario(i)}
                style={{ cursor: "pointer" }}
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
                        enterSceneView(i, "material");
                      }}
                    >
                      查看资料{materialDone ? " ✓" : ""}
                    </button>
                    <button
                      type="button"
                      className={`practice-btn${materialDone ? "" : " locked"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!materialDone) {
                          showToast("请先完成资料学习，再开始 AI 对练");
                          return;
                        }
                        enterSceneView(i, "practice");
                      }}
                    >
                      {trainDone ? "再次对练" : "开始对练"}
                    </button>
                    <button
                      type="button"
                      className={`exam-btn${practiceDone ? "" : " locked"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!practiceDone) {
                          showToast("请先完成 AI 对练，再进行考试");
                          return;
                        }
                        enterSceneView(i, "exam");
                      }}
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
