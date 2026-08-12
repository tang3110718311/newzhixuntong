"use client";

import { useEffect, useState } from "react";
import { taskApi, examApi, attemptApi, type AuthUser, type TaskRow, type ExamRow } from "@/lib/api";
import { statusClass, taskStatusText, taskTypeText, taskFormText, fmtDate } from "@/lib/types";
import type { PageKey } from "./MobileApp";

interface HomePageProps {
  user: AuthUser | null;
  onNavigate: (p: PageKey) => void;
  onOpenTask: (taskId: string) => void;
  showToast: (msg: string) => void;
}

export default function HomePage({ user, onNavigate, onOpenTask, showToast }: HomePageProps) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [attempts, setAttempts] = useState<Record<string, any>>({});
  const [recentTab, setRecentTab] = useState<"tasks" | "exams">("tasks");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([taskApi.list({ pageSize: 100 }), examApi.list(), attemptApi.list()])
      .then(([t, e, a]) => {
        if (!alive) return;
        setTasks(t.items || []);
        setExams(e || []);
        const map: Record<string, any> = {};
        (a || []).forEach((x: any) => {
          if (!map[x.examId] || (x.finishedAt && !map[x.examId].finishedAt)) map[x.examId] = x;
        });
        setAttempts(map);
      })
      .catch(() => showToast("数据加载失败"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.length;
  const remaining = total - done;
  const pending = tasks.filter((t) => t.status !== "completed").length;
  const percent = total ? Math.round(tasks.reduce((s, t) => s + t.progressPercent, 0) / total) : 0;

  // 未参加考试数（待参加）
  const pendingExams = exams.filter((e) => {
    const att = attempts[e.id];
    return !att || att.status === "failed";
  }).length;

  const recentTasks = tasks.slice(0, 3);
  const recentExams = exams.slice(0, 3);

  const examStatusOf = (e: ExamRow) => {
    const att = attempts[e.id];
    if (!att) return { text: "待参加", score: "—" };
    if (att.status === "passed") return { text: "已通过", score: `${att.score} 分` };
    if (att.status === "failed") return { text: "未通过", score: `${att.score} 分` };
    return { text: "进行中", score: "—" };
  };

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
        <span className="hello">{user?.tenantName || "智训通"}</span>
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
            <img className="hero-bot-img" src="/cute-3d-training-robot.png" alt="AI 智能培训助手" />
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
            <span>本月目标完成率</span>
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
        <button className="quick exam" onClick={() => onNavigate("exams")}>
          <strong>我的考试</strong>
          <small>参加考试与查看成绩</small>
          <b id="homeExamCount">{pendingExams}</b>
        </button>
      </div>
      <div className="recent-heading">
        <div className="recent-tabs">
          <button
            className={`recent-tab ${recentTab === "tasks" ? "active" : ""}`}
            onClick={() => setRecentTab("tasks")}
          >
            最近任务
          </button>
          <button
            className={`recent-tab ${recentTab === "exams" ? "active" : ""}`}
            onClick={() => setRecentTab("exams")}
          >
            最近考试
          </button>
        </div>
        <a
          className="recent-all"
          onClick={() => onNavigate(recentTab === "tasks" ? "tasks" : "exams")}
        >
          全部 ›
        </a>
      </div>
      {recentTab === "tasks" ? (
        <div className="recent-panel active">
          <div className="recent-box">
            {recentTasks.length === 0 && (
              <div className="recent-item">
                <span className="type-dot">✓</span>
                <div className="recent-main">
                  <b>暂无任务</b>
                  <small>任务派发后将在首页显示</small>
                </div>
              </div>
            )}
            {recentTasks.map((t) => (
              <div
                className="recent-item"
                key={t.id}
                onClick={() => onOpenTask(t.id)}
                style={{ cursor: "pointer" }}
              >
                <span className="type-dot">训</span>
                <div className="recent-main">
                  <b>{t.name}</b>
                  <small>
                    {taskTypeText(t.type)} · {taskFormText(t.primaryMode)}
                  </small>
                </div>
                <span className={`status ${statusClass(taskStatusText(t.status))}`}>
                  {taskStatusText(t.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="recent-panel active">
          <div className="recent-box">
            {recentExams.length === 0 && (
              <div className="recent-item">
                <span className="type-dot exam">试</span>
                <div className="recent-main">
                  <b>暂无考试</b>
                  <small>考试发布后将在首页显示</small>
                </div>
              </div>
            )}
            {recentExams.map((e) => {
              const st = examStatusOf(e);
              return (
                <div className="recent-item" key={e.id} style={{ cursor: "pointer" }} onClick={() => onNavigate("exams")}>
                  <span className="type-dot exam">试</span>
                  <div className="recent-main">
                    <b>{e.name}</b>
                    <small>{st.text}</small>
                  </div>
                  <span className={`status ${statusClass(st.text)}`}>{st.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
