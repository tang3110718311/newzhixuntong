"use client";

import { useRef, useState } from "react";
import { addExamCount, addExamRecord, type ExamRoundRecord } from "@/lib/sceneProgress";

interface ScenarioExamProps {
  scene: any;
  task: any;
  onBack: () => void;
  onFinished?: () => void;
  showToast: (msg: string) => void;
}

interface ExamChatMsg {
  id: string;
  who: "ai" | "user" | "feedback";
  text: string;
  time?: string;
  score?: number | null;
  comment?: string;
}

export default function ScenarioExam({ scene, task, onBack, onFinished, showToast }: ScenarioExamProps) {
  const [round, setRound] = useState(1);
  const [answer, setAnswer] = useState("");
  const [finished, setFinished] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const [rounds, setRounds] = useState<ExamRoundRecord[]>([]);
  const [messages, setMessages] = useState<ExamChatMsg[]>([]);
  const [sending, setSending] = useState(false);
  const msgSeq = useRef(0);
  const chatRef = useRef<HTMLDivElement>(null);

  const sceneName = scene?.scene?.name || "场景考试";
  const sceneId = scene?.scene?.id || scene?.sceneId || "";
  const aiRole = scene?.roles?.find((r: any) => r.roleType === "ai");
  const aiName = aiRole?.identity || "AI 考官";
  const isTextMode = scene?.scene?.mode === "text";

  const questions = [
    "请进行开场沟通，说明来意并了解对方当前最关注的问题。",
    "对方提出一个关键顾虑，请给出专业、清晰的回应并推动下一步。",
    "请总结本场景沟通结果，并确认后续行动安排。",
  ];

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const pushMsg = (m: Omit<ExamChatMsg, "id">) => {
    msgSeq.current += 1;
    setMessages((prev) => [...prev, { ...m, id: `em${Date.now()}-${msgSeq.current}` }]);
    setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }), 50);
  };

  const submitRound = () => {
    if (!answer.trim()) {
      showToast("请先输入你的回答");
      return;
    }
    setSending(true);
    const text = answer.trim();
    // 用户消息
    pushMsg({ who: "user", text, time: now() });
    setAnswer("");
    setTimeout(() => {
      // 本地简单评分（真实环境接 AI 评分接口）
      const len = text.length;
      const score = Math.max(60, Math.min(95, 65 + Math.round(len / 8)));
      const comment =
        score >= 85
          ? "表达清晰、重点突出，请继续保持。"
          : score >= 70
          ? "基本覆盖要点，建议补充更具体的信息和下一步行动。"
          : "回答较简略，建议围绕对方关注点展开并给出明确方案。";
      setTotalScore((s) => s + score);
      setRounds((prev) => [...prev, { round, question: questions[round - 1], answer: text, score, comment }]);
      // 反馈卡 + AI 引导（下一题或完成）
      pushMsg({ who: "feedback", text: comment, score, comment });
      if (round >= 3) {
        setFinished(true);
        pushMsg({
          who: "ai",
          text: `考试已完成，综合得分 ${Math.round((totalScore + score) / 3)} 分。系统已自动生成考试报告。`,
          time: now(),
        });
      } else {
        pushMsg({
          who: "ai",
          text: `第 ${round + 1} 轮：${questions[round]}`,
          time: now(),
        });
        setRound((r) => r + 1);
      }
      setSending(false);
    }, 500);
  };

  /** 完成考试：记录本地考试次数与明细（供历史记录"查看报告"） */
  const finishExam = () => {
    if (!recorded) {
      setRecorded(true);
      if (sceneId) {
        const finalScore = Math.round(totalScore / 3);
        const passScore = scene?.scene?.passScore ?? 60;
        addExamRecord(sceneId, {
          score: finalScore,
          passScore,
          passed: finalScore >= passScore,
          mode: isTextMode ? "文本形式" : "语音形式",
          rounds,
          finishedAt: new Date().toISOString(),
        });
      }
      addExamCount(sceneId);
      onFinished?.();
    }
    onBack();
  };

  return (
    <div className="pv-shell exam-page">
      {/* ===== 顶部导航 ===== */}
      <header className="pv-nav">
        <button className="pv-nav-back" type="button" onClick={onBack} aria-label="返回场景工作台">
          ‹
        </button>
        <div className="pv-nav-title">
          <h1>场景考试</h1>
        </div>
        <span className="pv-nav-spacer"></span>
      </header>

      {/* ===== 考试信息条（三栏，对齐原型） ===== */}
      <div className="pv-scene-card exam-info">
        <div className="pv-scene-col">
          <span>对练场景 · AI角色</span>
          <b>
            {sceneName} · {aiName}
          </b>
        </div>
        <div className="pv-scene-col">
          <span>考试次数</span>
          <b className="blue">第 {(rounds.length || 0) + 1} 次考试</b>
        </div>
        <div className="pv-scene-col">
          <span>本轮得分</span>
          <b className="blue">{rounds.length ? `${Math.round(totalScore / rounds.length)}分` : "—"}</b>
        </div>
      </div>

      {/* ===== 对话区 ===== */}
      <div className="pv-chat" ref={chatRef}>
        {messages.length === 0 && (
          <div className="pv-msg ai">
            <span className="pv-avatar ai" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="1.7">
                <rect x="4.5" y="7" width="15" height="11" rx="3.2" />
                <circle cx="9.2" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                <circle cx="14.8" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                <path d="M12 4.5v2.5" />
                <circle cx="12" cy="3.6" r="1.1" fill="#fff" stroke="none" />
                <path d="M7 16.6h.01M11.5 16.6h.01M16 16.6h.01" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <div className="pv-msg-main">
              <span className="pv-time">{now()}</span>
              <div className="pv-bubble">
                欢迎参加“{sceneName}”。请先完成一次自然、专业的开场回答，说明你对本次考试主题的理解。
              </div>
            </div>
          </div>
        )}
        {messages.map((m) => {
          if (m.who === "feedback") {
            return (
              <div className="pv-msg feedback" key={m.id}>
                <div className="pv-feedback-card">
                  <div className="pv-feedback-head">
                    <b>本轮评分</b>
                    <span>{m.score != null ? `${m.score}分` : "—"}</span>
                  </div>
                  <div className="pv-feedback-sec">
                    <span>点评</span>
                    <p>{m.comment}</p>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div className={`pv-msg ${m.who}`} key={m.id}>
              {m.who === "ai" ? (
                <span className="pv-avatar ai" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="1.7">
                    <rect x="4.5" y="7" width="15" height="11" rx="3.2" />
                    <circle cx="9.2" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                    <circle cx="14.8" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                    <path d="M12 4.5v2.5" />
                    <circle cx="12" cy="3.6" r="1.1" fill="#fff" stroke="none" />
                    <path d="M7 16.6h.01M11.5 16.6h.01M16 16.6h.01" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
              ) : (
                <span className="pv-avatar user" aria-hidden="true"></span>
              )}
              <div className="pv-msg-main">
                <span className="pv-time">{m.time}</span>
                <div className="pv-bubble">{m.text}</div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="pv-msg ai">
            <span className="pv-avatar ai" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="1.7">
                <rect x="4.5" y="7" width="15" height="11" rx="3.2" />
                <circle cx="9.2" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                <circle cx="14.8" cy="12.2" r="1.2" fill="#fff" stroke="none" />
              </svg>
            </span>
            <div className="pv-msg-main">
              <span className="pv-time">{now()}</span>
              <div className="pv-bubble">评分中…</div>
            </div>
          </div>
        )}
      </div>

      {/* ===== 提示条 + 输入区 ===== */}
      <div className="pv-composer exam-composer">
        <div className="exam-compose-meta">
          <span>共 3 题</span>
          <strong>{finished ? "考试已完成，可返回查看报告" : "完成考试后自动生成考试报告"}</strong>
        </div>
        {finished ? (
          <button className="exam-submit exam-submit-dialogue" type="button" onClick={finishExam}>
            返回场景工作台
          </button>
        ) : (
          <div className="pv-text-bar">
            <input
              className="pv-text-input"
              placeholder="输入你的考试回答…"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRound();
              }}
              maxLength={500}
            />
            <button className="pv-text-send" type="button" onClick={submitRound} disabled={sending || !answer.trim()}>
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                <path d="M3.5 11.8 20.5 3.5l-4.2 17-4.1-6.1-8.7-2.6Z" fill="#fff" stroke="none" />
                <path d="m12.2 14.4 8.3-10.7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
