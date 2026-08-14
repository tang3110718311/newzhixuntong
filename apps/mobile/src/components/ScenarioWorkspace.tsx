"use client";

import { useEffect, useMemo, useState } from "react";
import { recordApi } from "@/lib/api";
import { isMaterialDone, getExamCount, getExamRecords, type ExamRecord } from "@/lib/sceneProgress";
import { taskFormText } from "@/lib/types";
import PracticeReport from "./PracticeReport";
import ExamReport from "./ExamReport";

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
  showToast: (msg: string) => void;
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

  // ===== 历史记录（对练记录来自后端）=====
  const [recordTab, setRecordTab] = useState<"practice" | "exam">("practice");
  const [records, setRecords] = useState<any[]>([]);
  const [recordLoading, setRecordLoading] = useState(false);
  // 报告查看态：practice 用记录 ID 直查；exam 用本地考试记录
  const [reportView, setReportView] = useState<{ type: "practice"; id: string } | { type: "exam"; record: ExamRecord } | null>(null);

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

  // 考试记录：本地展示记录；无数据时造示例数据供查看报告效果
  const examRecords = useMemo<ExamRecord[]>(() => (sceneId ? getExamRecords(sceneId) : []), [sceneId]);
  const examRecordsShown = useMemo<ExamRecord[]>(() => {
    if (examRecords.length > 0) return examRecords;
    // 示例数据（标注"示例"）：仅当本地无考试记录时展示
    const now = Date.now();
    const mk = (daysAgo: number, score: number, passed: boolean, rounds: ExamRecord["rounds"]) => ({
      id: `mock-exam-${daysAgo}`,
      sceneId: sceneId || "",
      score,
      passScore: 60,
      passed,
      mode: "语音形式",
      rounds,
      finishedAt: new Date(now - daysAgo * 86400000).toISOString(),
    });
    return [
      mk(1, 86, true, [
        { round: 1, question: "请进行开场沟通，说明来意并了解对方当前最关注的问题。", answer: "您好，我是客服专员，想了解您当前对套餐使用最关心的问题，方便为您针对性解答。", score: 88, comment: "表达清晰、重点突出，请继续保持。" },
        { round: 2, question: "对方提出一个关键顾虑，请给出专业、清晰的回应并推动下一步。", answer: "您担心的合约期问题我已记录，稍后为您核对解约条款，预计10分钟内回电明确告知，您看可以吗？", score: 85, comment: "基本覆盖要点，建议补充更具体的信息和下一步行动。" },
        { round: 3, question: "请总结本场景沟通结果，并确认后续行动安排。", answer: "今天确认了套餐办理意向，我会在10分钟内核对合约条款并回电，请您保持电话畅通。", score: 85, comment: "总结完整，行动安排明确。" },
      ]),
      mk(3, 64, true, [
        { round: 1, question: "请进行开场沟通，说明来意并了解对方当前最关注的问题。", answer: "您好，想了解您的套餐使用情况。", score: 70, comment: "基本覆盖要点，建议补充更具体的信息和下一步行动。" },
        { round: 2, question: "对方提出一个关键顾虑，请给出专业、清晰的回应并推动下一步。", answer: "合约期两年，中途解约有违约金。", score: 62, comment: "回答较简略，建议围绕对方关注点展开并给出明确方案。" },
        { round: 3, question: "请总结本场景沟通结果，并确认后续行动安排。", answer: "已告知套餐内容，如需要可以再联系我。", score: 60, comment: "回答较简略，建议围绕对方关注点展开并给出明确方案。" },
      ]),
      mk(5, 52, false, [
        { round: 1, question: "请进行开场沟通，说明来意并了解对方当前最关注的问题。", answer: "你好，请问办理什么业务？", score: 62, comment: "回答较简略，建议围绕对方关注点展开并给出明确方案。" },
        { round: 2, question: "对方提出一个关键顾虑，请给出专业、清晰的回应并推动下一步。", answer: "这个套餐挺好的。", score: 45, comment: "回答较简略，建议围绕对方关注点展开并给出明确方案。" },
        { round: 3, question: "请总结本场景沟通结果，并确认后续行动安排。", answer: "你可以考虑一下。", score: 48, comment: "回答较简略，建议围绕对方关注点展开并给出明确方案。" },
      ]),
    ];
  }, [examRecords, sceneId]);

  const openPractice = () => {
    if (!materialDone) {
      showToast("请先完成资料学习，再开始 AI 对练");
      return;
    }
    onEnterPractice();
  };

  const openExam = () => {
    if (!practiceDone) {
      showToast("请先完成 AI 对练，再进行考试");
      return;
    }
    onEnterExam();
  };

  if (reportView?.type === "practice") {
    return (
      <PracticeReport
        recordId={reportView.id}
        scene={scene}
        task={task}
        onClose={() => setReportView(null)}
        showToast={showToast}
      />
    );
  }
  if (reportView?.type === "exam") {
    return (
      <ExamReport
        record={reportView.record}
        sceneName={s?.name || sceneMeta?.sceneName || "场景考试"}
        taskName={task?.name}
        onClose={() => setReportView(null)}
      />
    );
  }

  return (
    <>
      {/* ===== 顶部导航 ===== */}
      <div className="task-detail-head">
        <button className="task-detail-back" type="button" onClick={onBackToDetail} aria-label="返回任务详情">
          ‹
        </button>
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
            <button type="button" onClick={onEnterMaterial}>
              查看资料 ›
            </button>
          </div>
          <span className="path-step-arrow">›</span>
          <div className={`path-step ${practiceDone ? "done" : ""}`}>
            <span className="path-step-num">2</span>
            <b>AI 对练</b>
            <em>{practiceDone ? "已完成" : trainCount > 0 ? `进行中 ${trainCount}/${required}` : "待完成"}</em>
            <button type="button" onClick={openPractice}>
              {trainCount > 0 ? "再次对练" : "开始对练"} ›
            </button>
          </div>
          <span className="path-step-arrow">›</span>
          <div className={`path-step ${examCount > 0 ? "done" : ""}`}>
            <span className="path-step-num">3</span>
            <b>场景考试</b>
            <em>{examCount > 0 ? "已完成" : "待完成"}</em>
            <button type="button" onClick={openExam}>
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
        <div className="history-tabs">
          <button
            type="button"
            className={`history-tab ${recordTab === "practice" ? "active" : ""}`}
            onClick={() => setRecordTab("practice")}
          >
            对练记录
          </button>
          <button
            type="button"
            className={`history-tab ${recordTab === "exam" ? "active" : ""}`}
            onClick={() => setRecordTab("exam")}
          >
            考试记录
          </button>
        </div>
        <div className="history-stat">
          <div className="history-stat-item">
            <strong>{recordTab === "practice" ? records.length : examRecordsShown.length}</strong>
            <span>最近完成次数</span>
          </div>
          <div className="history-stat-item">
            <strong>
              {recordTab === "practice" ? (latestScore ?? "-") : examRecordsShown[0] ? `${examRecordsShown[0].score} 分` : "-"}
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
                    <b>{(r.finishedAt || r.startedAt || "").slice(0, 16).replace("T", " ")}</b>
                    <span>AI 对练 · 第 {records.length - i} 次</span>
                  </div>
                  <strong className="history-score">{r.score ?? "-"} 分</strong>
                  <button type="button" onClick={() => setReportView({ type: "practice", id: r.id })}>
                    查看报告
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="history-list">
            {examRecordsShown.length === 0 ? (
              <div className="history-empty">暂无考试记录</div>
            ) : (
              examRecordsShown.map((er, i) => (
                <div className="record-history-row" key={er.id}>
                  <div className="history-date">
                    <b>{(er.finishedAt || "").slice(0, 16).replace("T", " ")}</b>
                    <span>
                      场景考试 · 第 {examRecordsShown.length - i} 次
                      {examRecords.length === 0 && <em className="history-mock-tag">示例</em>}
                    </span>
                  </div>
                  <strong className="history-score">{er.score ?? "-"} 分</strong>
                  <button type="button" onClick={() => setReportView({ type: "exam", record: er })}>
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
