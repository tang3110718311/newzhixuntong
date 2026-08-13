"use client";

import { useEffect, useMemo, useState } from "react";
import { examApi, attemptApi, type ExamRow } from "@/lib/api";
import { statusClass } from "@/lib/types";

interface ExamsPageProps {
  showToast: (msg: string) => void;
}

const STATUS_TABS = ["全部", "待参加", "未通过", "已通过"];

export default function ExamsPage({ showToast }: ExamsPageProps) {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [attempts, setAttempts] = useState<Record<string, any>>({});
  const [keyword, setKeyword] = useState("");
  const [statusTab, setStatusTab] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    Promise.all([examApi.list(), attemptApi.list()])
      .then(([e, a]) => {
        let list = e || [];
        const map: Record<string, any> = {};
        (a || []).forEach((x: any) => {
          if (!map[x.examId] || (x.finishedAt && !map[x.examId].finishedAt)) map[x.examId] = x;
        });
        // 无数据时造示例数据供查看卡片效果（标注"示例"）
        if (list.length === 0 && Object.keys(map).length === 0) {
          list = [
            { id: "mock-e1", name: "客户服务沟通技巧", code: null, bankId: null, description: "在线考试", durationMinutes: 30, passScore: 60, totalScore: 100, questionCount: 3, status: "pending", startAt: null, endAt: null, createdAt: "" },
            { id: "mock-e2", name: "安全生产基础知识", code: null, bankId: null, description: "阶段考试", durationMinutes: 30, passScore: 60, totalScore: 100, questionCount: 2, status: "pending", startAt: null, endAt: null, createdAt: "" },
            { id: "mock-e3", name: "新员工入职培训考试", code: null, bankId: null, description: "结业考试", durationMinutes: 30, passScore: 60, totalScore: 100, questionCount: 4, status: "pending", startAt: null, endAt: null, createdAt: "" },
            { id: "mock-e4", name: "信息安全意识培训", code: null, bankId: null, description: "在线考试", durationMinutes: 30, passScore: 60, totalScore: 100, questionCount: 3, status: "pending", startAt: null, endAt: null, createdAt: "" },
          ];
          map["mock-e2"] = { status: "passed", score: 86 };
          map["mock-e3"] = { status: "failed", score: 58 };
          map["mock-e4"] = { status: "passed", score: 90 };
          setIsMock(true);
        }
        setExams(list);
        setAttempts(map);
      })
      .catch(() => showToast("考试数据加载失败"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const examStatus = (e: ExamRow): { text: string; score: string; action: string } => {
    const att = attempts[e.id];
    if (!att) return { text: "待参加", score: "—", action: "开始考试" };
    if (att.status === "passed") return { text: "已通过", score: `${att.score} 分`, action: "查看解析" };
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

  const startExam = async (e: ExamRow) => {
    try {
      if (isMock) {
        showToast("示例数据，接入真实考试后可开始考试");
        return;
      }
      await attemptApi.start(e.id);
      showToast(`开始考试：《${e.name}》`);
    } catch (err: any) {
      showToast(err.message || "开始考试失败");
    }
  };

  return (
    <>
      <div className="mobile-head">
        <div>
          <h1>我的考试</h1>
          <p>参加待完成考试，查看历史成绩与解析</p>
        </div>
        <button className="head-action" onClick={() => showToast("考试数据已刷新")}>
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
        {isMock && (
          <div className="history-mock-tag exam-mock-tag">以下为示例数据，接入真实考试后自动展示</div>
        )}
        {!loading && filtered.length === 0 && <div className="empty">暂无相关考试</div>}
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
                <button className={`exam-btn ${btnCls}`} type="button" onClick={() => startExam(e)}>
                  {st.action}
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
