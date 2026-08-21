"use client";

import { useEffect, useMemo, useState } from "react";
import { recordApi } from "@/lib/api";
import { isMaterialDone, getExamCount, getExamRecords, type ExamRecord } from "@/lib/sceneProgress";
import { taskFormText, taskDisplayStatus } from "@/lib/types";
import MobilePageAction from "./MobilePageAction";
import UnifiedTabs from "./UnifiedTabs";

interface ScenarioWorkspaceProps {
  scene: any;
  task: any;
  sceneMeta: any;
  index: number;
  total: number;
  onBackToDetail: () => void;
  onEnterMaterial: () => void;
  onEnterPractice: () => void;
  onEnterExam: () => void;
  onOpenPracticeReport: (recordId: string) => void;
  onOpenExamReport: (recordId: string) => void;
  showToast: (msg: string) => void;
}

/** 按设备当前时区格式化完成时间，使用 24 小时制。 */
function fmtLocalFinishedTime(iso?: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ScenarioWorkspace({
  scene,
  task,
  sceneMeta,
  index,
  total,
  onBackToDetail,
  onEnterMaterial,
  onEnterPractice,
  onEnterExam,
  onOpenPracticeReport,
  onOpenExamReport,
  showToast,
}: ScenarioWorkspaceProps) {
  const s = scene?.scene;
  const aiRole = scene?.roles?.find((r: any) => r.roleType === "ai");
  const learnerRole = scene?.roles?.find((r: any) => r.roleType === "learner");
  const sceneId = sceneMeta?.sceneId;
  const trainCount = sceneMeta?.completedTrainCount || 0;
  const required = sceneMeta?.requiredTrainTimes || 1;
  // 本地资料/考试记录只作为 UI 展示态；可信完成状态以服务端训练计数为准。
  const materialDone = !!sceneId && (isMaterialDone(sceneId) || trainCount > 0);
  const practiceDone = trainCount >= required;
  const examCount = sceneId ? getExamCount(sceneId) : 0;
  const sceneDone = practiceDone;

  // 任务运行状态：停用态禁用按钮，逾期态放开前置校验
  const runtimeStatus = task ? taskDisplayStatus(task) : "";
  const isStopped = task?.status === "stopped";
  const isOverdue = runtimeStatus === "已逾期";

  // ===== 历史记录（对练记录来自后端）=====
  const [recordTab, setRecordTab] = useState<"practice" | "exam">("practice");
  const [records, setRecords] = useState<any[]>([]);
  const [recordLoading, setRecordLoading] = useState(false);

  useEffect(() => {
    if (!sceneId) return;
    setRecordLoading(true);
    recordApi
      .list({ page: 1, pageSize: 20, sceneId })
      .then((res: any) => setRecords(res?.items || []))
      .catch(() => setRecords([]))
      .finally(() => setRecordLoading(false));
  }, [sceneId]);

  const latestScore = records.length > 0 ? records[0]?.score : null;

  // 考试记录：仅展示本地真实考试记录；商用模式不再用示例记录填充。
  const examRecords = useMemo<ExamRecord[]>(() => (sceneId ? getExamRecords(sceneId) : []), [sceneId]);

  const openPractice = () => {
    if (isStopped) return;
    if (!isOverdue && !materialDone) {
      showToast("请先完成资料学习，再开始 AI 对练");
      return;
    }
    onEnterPractice();
  };

  const openExam = () => {
    if (isStopped) return;
    if (!isOverdue && !practiceDone) {
      showToast("请先完成 AI 对练，再进行考试");
      return;
    }
    onEnterExam();
  };

  return (
    <>
      {/* ===== 顶部导航 ===== */}
      <div className="task-detail-head">
        <MobilePageAction kind="back" onClick={onBackToDetail} aria-label="返回任务详情" />
        <div className="task-detail-title">
          <h1>场景详情</h1>
          <p>查看场景要求与学习进度</p>
        </div>
      </div>

      {/* ===== 场景基础信息栏 ===== */}
      <div className="scenario-detail-hero">
        <span className="scenario-index">{String(index + 1).padStart(2, "0")}</span>
        <div className="scenario-detail-main">
          <h2>{s?.name || sceneMeta?.sceneName}</h2>
          <p>
            {s?.scene_type || sceneMeta?.sceneType || "场景训练"} · 场景 {index + 1}/{total} ·{" "}
            {task?.primaryMode ? taskFormText(task.primaryMode) : "语音形式"}
          </p>
        </div>
        <span className={`scene-status-pill ${sceneDone ? "done" : "doing"}`}>
          {sceneDone ? "已完成" : "进行中"}
        </span>
      </div>

      {/* ===== 本场景完成路径 ===== */}
      <div className="scene-path-card">
        <div className="path-card-head">
          <div>
            <h3>本场景完成路径</h3>
            <span>按顺序完成资料、对练和考试</span>
          </div>
          <span className="path-done-tag">{sceneDone ? "本场景已完成" : "进行中"}</span>
        </div>
        <div className="path-steps">
          <div className={`path-step ${materialDone ? "done" : ""}`}>
            <span className="path-step-num">1</span>
            <b>学习资料</b>
            <em>{materialDone ? "已完成" : "待完成"}</em>
            <button type="button" onClick={onEnterMaterial} disabled={isStopped}>
              查看资料 ›
            </button>
          </div>
          <span className="path-step-arrow">›</span>
          <div className={`path-step ${practiceDone ? "done" : ""}`}>
            <span className="path-step-num">2</span>
            <b>AI 对练</b>
            <em>{practiceDone ? "已完成" : trainCount > 0 ? `进行中 ${trainCount}/${required}` : "待完成"}</em>
            <button type="button" onClick={openPractice} disabled={isStopped}>
              {trainCount > 0 ? "再次对练" : "开始对练"} ›
            </button>
          </div>
          <span className="path-step-arrow">›</span>
          <div className={`path-step ${examCount > 0 ? "done" : ""}`}>
            <span className="path-step-num">3</span>
            <b>场景考试</b>
            <em>{examCount > 0 ? "已完成" : "待完成"}</em>
            <button type="button" onClick={openExam} disabled={isStopped}>
              {examCount > 0 ? "再次考试" : "开始考试"} ›
            </button>
          </div>
        </div>
      </div>

      {/* ===== 场景介绍 ===== */}
      <div className="scene-info-card">
        <h3>场景介绍</h3>
        <p className="card-sub">{s?.description || "完成本场景的学习、对练与考试。"}</p>
        <div className="scene-info-box">
          <span className="info-box-label">对话目标</span>
          <p>{aiRole?.goal || "完成一次专业、自然的沟通，准确识别对方关注点，并推动下一步。"}</p>
        </div>
      </div>

      {/* ===== AI 角色扮演 ===== */}
      <div className="scene-info-card">
        <h3>AI 角色扮演</h3>
        <div className="scene-info-box violet">
          <span className="info-box-label">角色背景</span>
          <p>{aiRole?.background || "围绕场景主题与用户展开多轮对话。"}</p>
        </div>
        <div className="scene-role-grid">
          <div className="scene-role-cell">
            <span className="role-tag">AI 身份</span>
            <b>{aiRole?.identity || "场景角色"}</b>
          </div>
          <div className="scene-role-cell">
            <span className="role-tag">学员身份</span>
            <b>{learnerRole?.identity || "学员"}</b>
          </div>
        </div>
      </div>

      {/* ===== 历史记录 ===== */}
      <div className="scene-info-card">
        <h3>历史记录</h3>
        <p className="card-sub">查看本场景的 AI 对练与考试记录。</p>
        <UnifiedTabs
          ariaLabel="历史记录类型"
          className="unified-tabs--compact"
          items={[
            { value: "practice", label: "对练记录" },
            { value: "exam", label: "考试记录" },
          ]}
          onChange={setRecordTab}
          value={recordTab}
        />
        <div className="history-stat">
          <div className="history-stat-item">
            <strong>{recordTab === "practice" ? records.length : examRecords.length}</strong>
            <span>最近完成次数</span>
          </div>
          <div className="history-stat-item">
            <strong>
              {recordTab === "practice" ? (latestScore ?? "-") : examRecords[0] ? `${examRecords[0].score} 分` : "-"}
            </strong>
            <span>最近得分</span>
          </div>
        </div>

        {recordTab === "practice" ? (
          <div className="history-list">
            {recordLoading ? (
              <div className="history-empty">加载中…</div>
            ) : records.length === 0 ? (
              <div className="history-empty">暂无对练记录</div>
            ) : (
              records.map((r: any, i: number) => (
                <div className="record-history-row" key={r.id}>
                  <div className="history-date">
                    <b>{fmtLocalFinishedTime(r.finishedAt)}</b>
                    <span>AI 对练 · 第 {records.length - i} 次</span>
                  </div>
                  <strong className="history-score">{r.score ?? "-"} 分</strong>
                  <button type="button" onClick={() => onOpenPracticeReport(r.id)}>
                    查看报告
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="history-list">
            {examRecords.length === 0 ? (
              <div className="history-empty">暂无考试记录</div>
            ) : (
              examRecords.map((er, i) => (
                <div className="record-history-row" key={er.id}>
                  <div className="history-date">
                    <b>{(er.finishedAt || "").slice(0, 16).replace("T", " ")}</b>
                    <span>
                      场景考试 · 第 {examRecords.length - i} 次
                    </span>
                  </div>
                  <strong className="history-score">{er.score ?? "-"} 分</strong>
                  <button type="button" onClick={() => onOpenExamReport(er.id)}>
                    查看报告
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
