"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { examApi, attemptApi, type ExamAttemptDetail, type ExamAttemptRow, type ExamDetail, type ExamQuestionRow, type ExamRow } from "@/lib/api";
import { pathForExam, type MobileRouteState } from "@/lib/mobileRoutes";
import { statusClass } from "@/lib/types";
import MobilePageAction from "./MobilePageAction";
import UnifiedTabs from "./UnifiedTabs";

interface ExamsPageProps {
  showToast: (msg: string) => void;
  routeState: MobileRouteState;
}

const STATUS_TABS = ["全部", "待参加", "未通过", "已通过"];

const TASK_TYPE_LABELS: Record<string, string> = {
  free_exam: "自由考试",
  fixed_exam: "固定考试",
};

function examTypeLabel(exam: ExamRow) {
  if (exam.status === "final") return "结业考试";
  if (exam.status === "stage") return "阶段考试";
  return TASK_TYPE_LABELS[exam.status] || "在线考试";
}

export default function ExamsPage({ showToast, routeState }: ExamsPageProps) {
  const router = useRouter();
  const routeLoadKeyRef = useRef("");
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
  const [resultView, setResultView] = useState<{ exam: ExamRow | ExamDetail; attempt: ExamAttemptDetail } | null>(null);
  const [reportTab, setReportTab] = useState<"report" | "record">("report");

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
    if (att.status === "passed") return { text: "已通过", score: `${att.score} 分`, action: "查看解析" };
    if (att.status === "failed") return { text: "未通过", score: `${att.score} 分`, action: "重新考试" };
    return { text: "进行中", score: "—", action: "开始考试" };
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

  const beginTaking = async (examId: string, existingAttemptId?: string) => {
    setStartingId(examId);
    try {
      const detail = await examApi.detail(examId);
      if (!detail.questions?.length) {
        showToast("该考试还没有题目，请联系管理员配置题库");
        router.replace("/exams");
        return;
      }
      const attempt = existingAttemptId ? { id: existingAttemptId } : await attemptApi.start(examId);
      setResultView(null);
      setTaking({ exam: detail, attemptId: attempt.id, answers: {}, submitting: false });
    } catch (err: any) {
      showToast(err.message || "开始考试失败");
      router.replace("/exams");
    } finally {
      setStartingId(null);
    }
  };

  const startExam = (e: ExamRow) => {
    const att = attempts[e.id];
    if (att?.status === "passed") {
      router.push(pathForExam(e.id, "report", att.id));
      return;
    }
    router.push(pathForExam(e.id, "take"));
  };

  useEffect(() => {
    if (routeState.page !== "exams") return;
    if (routeState.examView === "list") {
      routeLoadKeyRef.current = "list";
      setTaking(null);
      setResultView(null);
      return;
    }
    if (!routeState.examId || loading) return;

    const key = `${routeState.examView}:${routeState.examId}:${routeState.attemptId || ""}`;
    if (routeLoadKeyRef.current === key) return;
    routeLoadKeyRef.current = key;

    let alive = true;
    const openRoute = async () => {
      const examId = routeState.examId!;
      if (routeState.examView === "take") {
        const att = attempts[examId];
        if (att?.status === "passed") {
          router.replace(pathForExam(examId, "report", att.id));
          return;
        }
        await beginTaking(examId, att?.status === "in_progress" ? att.id : undefined);
        return;
      }

      if (routeState.examView === "report") {
        const attemptId = routeState.attemptId || attempts[examId]?.id;
        if (!attemptId) {
          showToast("考试报告不存在或已删除");
          router.replace("/exams");
          return;
        }
        setStartingId(examId);
        try {
          const currentExam = exams.find((item) => item.id === examId);
          const [attempt, examForView] = await Promise.all([
            attemptApi.detail(attemptId),
            currentExam ? Promise.resolve(currentExam) : examApi.detail(examId),
          ]);
          if (!alive) return;
          setTaking(null);
          setReportTab("report");
          setResultView({ exam: examForView, attempt });
        } catch (err: any) {
          if (alive) {
            showToast(err.message || "考试报告加载失败");
            router.replace("/exams");
          }
        } finally {
          if (alive) setStartingId(null);
        }
      }
    };

    void openRoute();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeState.page, routeState.examView, routeState.examId, routeState.attemptId, loading, attempts, exams]);

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
      const report = await attemptApi.detail(attempt.id);
      setReportTab("report");
      router.replace(pathForExam(taking.exam.id, "report", attempt.id));
      setResultView({ exam: taking.exam, attempt: report });
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
          <MobilePageAction kind="back" onClick={() => router.push("/exams")} aria-label="返回考试列表" />
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
          <button className="secondary" type="button" onClick={() => router.push("/exams")} disabled={taking.submitting}>
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
    const questions = resultView.attempt.questions || [];
    const correctCount = questions.filter((question) => question.isCorrect).length;
    const score = resultView.attempt.score ?? 0;
    const completionRounds = questions.length;
    const examFormat = resultView.exam.description?.includes("文本") ? "文本形式" : "语音形式";
    return (
      <div className="exam-report-view">
        <div className="task-detail-head exam-report-topbar">
          <MobilePageAction kind="back" onClick={() => router.push("/exams")} aria-label="返回考试列表" />
          <div className="task-detail-title exam-report-title">
            <h1>考试报告</h1>
            <p>{resultView.exam.name}</p>
          </div>
        </div>
        <div className={`exam-report-banner ${passed ? "passed" : "failed"}`}>
          <div className="exam-report-banner-deco exam-report-banner-deco-one" />
          <div className="exam-report-banner-deco exam-report-banner-deco-two" />
          <div className="exam-report-banner-deco exam-report-banner-deco-arc" />
          <div className="exam-report-banner-content">
            <strong>{score}<small>分</small></strong>
            <div><b>本次考试成绩</b><span>历史考试记录 <i>›</i></span></div>
          </div>
        </div>
        <UnifiedTabs
          ariaLabel="考试报告内容"
          items={[
            { value: "report", label: "报告概览" },
            { value: "record", label: "对话记录" },
          ]}
          onChange={setReportTab}
          value={reportTab}
        />
        {reportTab === "report" ? (
          <div className="exam-report-overview">
            <section className="exam-report-summary">
              <div className="exam-report-summary-card">
                <div className="exam-report-summary-head">
                  <div><h3>本次考试已完成</h3><p>考试轮次由后台配置控制，共 {completionRounds} 轮</p></div>
                  <span className={`exam-report-pass-tag ${passed ? "passed" : "failed"}`}>{passed ? "合格" : "不合格"}</span>
                </div>
                <div className="exam-report-score-card">
                  <div className="exam-report-score-ring" style={{ background: `conic-gradient(#3b82f6 ${Math.max(0, Math.min(score, 100)) * 3.6}deg, #eef1f6 0deg)` }}><div><strong className={passed ? "passed" : "failed"}>{score}</strong><span>综合得分</span></div></div>
                  <div className="exam-report-score-info"><h4>{passed ? "达到考试合格要求" : "未达到考试合格要求"}</h4><p>系统已整理本次{examFormat}考试的全部回答，并生成轮次表现记录。</p><div><span>考试形式 <b>{examFormat}</b></span><span>完成轮次 <b>{completionRounds}</b></span></div></div>
                </div>
              </div>
              <div className="exam-report-conclusion"><h3>考试结论</h3><p>本次考试共完成 <b>{completionRounds}</b> 轮正式作答，最终成绩为 <strong>{score} 分</strong>，考试状态为 <em className={passed ? "passed" : "failed"}>{passed ? "合格" : "不合格"}</em>。</p></div>
            </section>
            <div className="exam-report-question-heading"><h3>逐题解析</h3><span>答对 {correctCount}/{questions.length} 题</span></div>
            {questions.map((question, index) => <article className={`exam-analysis-card ${question.isCorrect ? "correct" : "wrong"}`} key={question.id}><div className="exam-analysis-head"><b>第 {index + 1} 题 · {question.type === "multi" ? "多选题" : question.type === "judge" ? "判断题" : "单选题"}</b><span>{question.isCorrect ? `得 ${question.score}/${question.maxScore} 分` : `得 0/${question.maxScore} 分`}</span></div><h4>{question.stem}</h4><p>你的答案：<b>{question.userAnswer || "未作答"}</b></p><p>正确答案：<b>{question.answer}</b></p><div className="exam-analysis-note"><strong>解析</strong>{question.analysis || "暂无解析"}</div></article>)}
          </div>
        ) : (
          <div className="exam-record-chat">{questions.map((question, index) => <div className="exam-chat-group" key={question.id}><div className="exam-chat-row ai"><i>题</i><p>第 {index + 1} 题：{question.stem}</p></div><div className="exam-chat-row user"><i>我</i><p>{question.userAnswer || "未作答"}</p></div><div className={`exam-chat-feedback ${question.isCorrect ? "correct" : "wrong"}`}>{question.isCorrect ? "回答正确" : `回答错误，正确答案：${question.answer}`} · {question.score}/{question.maxScore} 分</div></div>)}</div>
        )}
        <button className="exam-report-close-action" type="button" onClick={() => router.push("/exams")}>关闭报告</button>
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
      <UnifiedTabs
        ariaLabel="考试状态"
        className="unified-tabs--filter"
        items={STATUS_TABS.map((label) => ({ value: label === "全部" ? "" : label, label }))}
        onChange={setStatusTab}
        value={statusTab}
      />
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
                  <span>考试类型</span>
                  <em>{examTypeLabel(e)}</em>
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
