"use client";

import { useEffect, useMemo, useState } from "react";
import { examApi, attemptApi, type ExamAttemptRow, type ExamDetail, type ExamQuestionRow, type ExamRow } from "@/lib/api";
import { statusClass } from "@/lib/types";

interface ExamsPageProps {
  showToast: (msg: string) => void;
}

const STATUS_TABS = ["全部", "待参加", "未通过", "已通过"];

export default function ExamsPage({ showToast }: ExamsPageProps) {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [attempts, setAttempts] = useState<Record<string, ExamAttemptRow>>({});
  const [keyword, setKeyword] = useState("");
  const [statusTab, setStatusTab] = useState("");
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [taking, setTaking] = useState<{
    exam: ExamDetail;
    attemptId: string;
    answers: Record<string, string>;
    submitting: boolean;
  } | null>(null);
  const [resultView, setResultView] = useState<{ exam: ExamRow | ExamDetail; attempt: ExamAttemptRow } | null>(null);

  async function loadData(showSuccess = false) {
    setLoading(true);
    Promise.all([examApi.list(), attemptApi.list()])
      .then(([e, a]) => {
        const map: Record<string, ExamAttemptRow> = {};
        (a || []).forEach((x: any) => {
          if (!map[x.examId]) map[x.examId] = x;
        });
        setExams((e || []).filter((exam) => exam.status === "published"));
        setAttempts(map);
        if (showSuccess) showToast("考试数据已刷新");
      })
      .catch(() => showToast("考试数据加载失败"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const examStatus = (e: ExamRow): { text: string; score: string; action: string } => {
    const att = attempts[e.id];
    if (!att) return { text: "待参加", score: "—", action: "开始考试" };
    if (att.status === "passed") return { text: "已通过", score: `${att.score} 分`, action: "查看成绩" };
    if (att.status === "failed") return { text: "未通过", score: `${att.score} 分`, action: "重新考试" };
    return { text: "进行中", score: "—", action: "继续考试" };
  };

  const filtered = useMemo(() => {
    let list = exams;
    if (statusTab) list = list.filter((e) => examStatus(e).text === statusTab);
    if (keyword) list = list.filter((e) => e.name.includes(keyword));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exams, statusTab, keyword]);

  const stats = useMemo(() => {
    const total = exams.length;
    const pending = exams.filter((e) => examStatus(e).text === "待参加").length;
    const passed = exams.filter((e) => examStatus(e).text === "已通过").length;
    const failed = exams.filter((e) => examStatus(e).text === "未通过").length;
    return { total, pending, passed, failed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exams, attempts]);

  const beginTaking = async (e: ExamRow, existingAttemptId?: string) => {
    if ((e.questionCount || 0) <= 0) {
      showToast("该考试还没有题目，请联系管理员配置题库");
      return;
    }
    setStartingId(e.id);
    try {
      const detail = await examApi.detail(e.id);
      if (!detail.questions?.length) {
        showToast("该考试还没有题目，请联系管理员配置题库");
        return;
      }
      const attempt = existingAttemptId ? { id: existingAttemptId } : await attemptApi.start(e.id);
      setResultView(null);
      setTaking({ exam: detail, attemptId: attempt.id, answers: {}, submitting: false });
    } catch (err: any) {
      showToast(err.message || "开始考试失败");
    } finally {
      setStartingId(null);
    }
  };

  const startExam = async (e: ExamRow) => {
    const att = attempts[e.id];
    if (att?.status === "passed") {
      setResultView({ exam: e, attempt: att });
      return;
    }
    const existingAttemptId = att?.status === "in_progress" ? att.id : undefined;
    await beginTaking(e, existingAttemptId);
  };

  function toggleAnswer(question: ExamQuestionRow, optionKey: string) {
    setTaking((prev) => {
      if (!prev) return prev;
      const current = prev.answers[question.id] || "";
      const isMulti = question.type === "multi";
      const nextValue = isMulti
        ? current.includes(optionKey)
          ? current.replace(optionKey, "").split("").sort().join("")
          : `${current}${optionKey}`.split("").sort().join("")
        : optionKey;
      return { ...prev, answers: { ...prev.answers, [question.id]: nextValue } };
    });
  }

  async function submitTaking() {
    if (!taking) return;
    const unanswered = taking.exam.questions.filter((q) => !taking.answers[q.id]).length;
    if (unanswered > 0) {
      showToast(`还有 ${unanswered} 题未作答`);
      return;
    }
    setTaking((prev) => (prev ? { ...prev, submitting: true } : prev));
    try {
      const attempt = await attemptApi.submit(
        taking.attemptId,
        taking.exam.questions.map((q) => ({ questionId: q.id, answer: taking.answers[q.id] || "" })),
      );
      setTaking(null);
      setResultView({ exam: taking.exam, attempt });
      await loadData();
      showToast("考试已提交，成绩已记录");
    } catch (err: any) {
      showToast(err.message || "提交考试失败");
      setTaking((prev) => (prev ? { ...prev, submitting: false } : prev));
    }
  }

  if (taking) {
    const answeredCount = taking.exam.questions.filter((q) => taking.answers[q.id]).length;
    return (
      <div className="exam-taking-shell">
        <div className="task-detail-head">
          <button className="task-detail-back" type="button" onClick={() => setTaking(null)} aria-label="返回考试列表">
            ‹
          </button>
          <div className="task-detail-title">
            <h1>{taking.exam.name}</h1>
            <p>
              共 {taking.exam.questions.length} 题 · 满分 {taking.exam.totalScore} · 及格 {taking.exam.passScore}
            </p>
          </div>
        </div>
        <div className="exam-taking-progress">
          <span>已答 {answeredCount}/{taking.exam.questions.length}</span>
          <b>{taking.exam.durationMinutes} 分钟</b>
        </div>
        <div className="exam-taking-list">
          {taking.exam.questions.map((question, index) => {
            const current = taking.answers[question.id] || "";
            const isMulti = question.type === "multi";
            return (
              <article className="exam-taking-card" key={question.id}>
                <div className="exam-question-head">
                  <span>
                    第 {index + 1} 题 · {isMulti ? "多选题" : question.type === "judge" ? "判断题" : "单选题"} · {question.score} 分
                  </span>
                  {current ? <em>已作答</em> : <em className="pending">未作答</em>}
                </div>
                <h3>{question.stem}</h3>
                <div className="exam-option-list">
                  {question.options.map((option, optIndex) => {
                    const key = String.fromCharCode(65 + optIndex);
                    const selected = isMulti ? current.includes(key) : current === key;
                    return (
                      <label className={`exam-option-row ${selected ? "selected" : ""}`} key={key}>
                        <input
                          type={isMulti ? "checkbox" : "radio"}
                          name={`exam-${question.id}`}
                          checked={selected}
                          onChange={() => toggleAnswer(question, key)}
                        />
                        <span>
                          <strong>{key}.</strong> {option}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
        <div className="exam-taking-footer">
          <button className="secondary" type="button" onClick={() => setTaking(null)} disabled={taking.submitting}>
            退出
          </button>
          <button className="primary" type="button" onClick={submitTaking} disabled={taking.submitting}>
            {taking.submitting ? "提交中…" : "交卷"}
          </button>
        </div>
      </div>
    );
  }

  if (resultView) {
    const passed = resultView.attempt.status === "passed";
    return (
      <div className="exam-result-view">
        <div className="task-detail-head">
          <button className="task-detail-back" type="button" onClick={() => setResultView(null)} aria-label="返回考试列表">
            ‹
          </button>
          <div className="task-detail-title">
            <h1>考试成绩</h1>
            <p>{resultView.exam.name}</p>
          </div>
        </div>
        <div className={`exam-result-card ${passed ? "passed" : "failed"}`}>
          <span>{passed ? "已通过" : "未通过"}</span>
          <strong>{resultView.attempt.score ?? 0}</strong>
          <p>满分 {resultView.attempt.totalScore} 分 · {resultView.attempt.finishedAt ? resultView.attempt.finishedAt.slice(0, 16).replace("T", " ") : "刚刚提交"}</p>
        </div>
        <div className="exam-result-actions">
          <button className="secondary" type="button" onClick={() => setResultView(null)}>
            返回列表
          </button>
          <button className="primary" type="button" onClick={() => beginTaking(resultView.exam as ExamRow)}>
            再考一次
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mobile-head">
        <div>
          <h1>我的考试</h1>
          <p>参加待完成考试，查看历史成绩与解析</p>
        </div>
        <button className="head-action" onClick={() => void loadData(true)} disabled={loading}>
          ↻
        </button>
      </div>
      <div className="exam-summary">
        <div className="exam-stat">
          <b>{stats.total}</b>
          <small>全部任务</small>
        </div>
        <div className="exam-stat">
          <b>{stats.pending}</b>
          <small>待参加</small>
        </div>
        <div className="exam-stat">
          <b>{stats.passed}</b>
          <small>已通过</small>
        </div>
        <div className="exam-stat">
          <b>{stats.failed}</b>
          <small>未通过</small>
        </div>
      </div>
      <div className="exam-search-wrap">
        <span className="exam-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input id="examKeyword" placeholder="搜索考试名称" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <button id="examSearchBtn" type="button">
          搜索
        </button>
      </div>
      <div className="exam-tabs" role="tablist" aria-label="考试状态">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            className={`exam-tab ${statusTab === s || (s === "全部" && statusTab === "") ? "active" : ""}`}
            role="tab"
            onClick={() => setStatusTab(s === "全部" ? "" : s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="exam-list" id="examList">
        {loading && <div className="empty">加载中…</div>}
        {!loading && filtered.length === 0 && <div className="empty">暂无真实考试，请联系管理员发布考试</div>}
        {filtered.map((e) => {
          const st = examStatus(e);
          const sc = st.text === "未通过" ? "fail" : st.text === "已通过" ? "pass" : "";
          const btnCls =
            st.text === "已通过" ? "done" : st.text === "未通过" ? "overdue" : "wait";
          return (
            <div className={`exam-card exam-card-${btnCls}`} key={e.id}>
              <div className="exam-card-head">
                <div className="exam-kind">
                  <span className="exam-kind-icon">▣</span>
                  <span>考试任务</span>
                  <em>{e.description || "在线考试"}</em>
                </div>
                <span className={`exam-status ${statusClass(st.text)}`}>
                  <i></i>
                  {st.text}
                </span>
              </div>
              <div className="exam-card-main">
                <h3>{e.name}</h3>
                <p>共 {e.questionCount || 0} 题 · 满分 {e.totalScore || 100}</p>
              </div>
              <div className="exam-card-foot">
                <div className="exam-score">
                  <small>{st.text === "待参加" ? "完成后显示成绩" : "本次成绩"}</small>
                  <strong className={sc}>{st.score === "—" ? "待参加" : st.score}</strong>
                </div>
                <button className={`exam-btn ${btnCls}`} type="button" onClick={() => startExam(e)} disabled={startingId === e.id}>
                  {startingId === e.id ? "加载中…" : st.action}
                  <span>›</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
