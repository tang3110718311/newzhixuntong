"use client";

import { useState } from "react";

interface ScenarioExamProps {
  scene: any;
  task: any;
  onBack: () => void;
  onFinished?: () => void;
  showToast: (msg: string) => void;
}

export default function ScenarioExam({ scene, task, onBack, onFinished, showToast }: ScenarioExamProps) {
  const [round, setRound] = useState(1);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ score: number; comment: string } | null>(null);
  const [finished, setFinished] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [recorded, setRecorded] = useState(false);

  const sceneName = scene?.scene?.name || "场景考试";

  const submitRound = () => {
    if (!answer.trim()) {
      showToast("请先输入你的回答");
      return;
    }
    // 本地简单评分（真实环境接 AI 评分接口）
    const len = answer.trim().length;
    const score = Math.max(60, Math.min(95, 65 + Math.round(len / 8)));
    const comment =
      score >= 85
        ? "表达清晰、重点突出，请继续保持。"
        : score >= 70
        ? "基本覆盖要点，建议补充更具体的信息和下一步行动。"
        : "回答较简略，建议围绕对方关注点展开并给出明确方案。";
    setFeedback({ score, comment });
    setTotalScore((s) => s + score);
    if (round >= 3) {
      setFinished(true);
    }
  };

  const nextRound = () => {
    setRound((r) => r + 1);
    setAnswer("");
    setFeedback(null);
  };

  const questions = [
    "请进行开场沟通，说明来意并了解对方当前最关注的问题。",
    "对方提出一个关键顾虑，请给出专业、清晰的回应并推动下一步。",
    "请总结本场景沟通结果，并确认后续行动安排。",
  ];

  return (
    <>
      <div className="task-detail-head">
        <button className="task-detail-back" type="button" onClick={onBack} aria-label="返回场景工作台">
          ‹
        </button>
        <div className="task-detail-title">
          <h1>场景考试</h1>
          <p>
            {sceneName} · 第 {round}/3 轮
          </p>
        </div>
      </div>

      {!finished ? (
        <>
          <div className="scene-work-card">
            <h3>第 {round} 轮问题</h3>
            <p className="card-sub">{questions[round - 1]}</p>
            <textarea
              className="modal-textarea"
              style={{ width: "100%", minHeight: 110, border: "1px solid #e5ebf4", borderRadius: 11, padding: 11, fontSize: 13, outline: "none", resize: "vertical" }}
              placeholder="输入你的回答…"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </div>

          {feedback && (
            <div className="scene-work-card">
              <div className="feedback-head">
                <b>本轮评分</b>
                <span className="feedback-score">{feedback.score} 分</span>
              </div>
              <p className="card-sub">{feedback.comment}</p>
            </div>
          )}

          <div className="task-detail-actions">
            {feedback ? (
              <button className="primary" type="button" onClick={nextRound}>
                {round >= 3 ? "完成考试" : "下一轮 ›"}
              </button>
            ) : (
              <button className="primary" type="button" onClick={submitRound}>
                提交本轮回答
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="scene-work-card">
          <h3>考试完成</h3>
          <div className="report-score-box" style={{ margin: "12px 0" }}>
            <strong>{Math.round(totalScore / 3)}</strong>
            <span>综合得分（满分 100）</span>
          </div>
          <p className="card-sub">
            {totalScore / 3 >= 60 ? "恭喜通过场景考试！" : "未达到通过线，建议加强对练后重新考试。"}
          </p>
          <div className="task-detail-actions">
            <button
              className="primary"
              type="button"
              onClick={() => {
                if (!recorded) {
                  setRecorded(true);
                  onFinished?.();
                }
                onBack();
              }}
            >
              返回场景工作台
            </button>
          </div>
        </div>
      )}
    </>
  );
}
