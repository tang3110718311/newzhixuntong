"use client";

import { useEffect, useMemo, useState } from "react";
import { taskApi, type TaskRow } from "@/lib/api";
import { statusClass, taskTypeText, taskFormText, fmtDate, taskDisplayStatus } from "@/lib/types";
import type { PageKey } from "./MobileApp";
import UnifiedTabs from "./UnifiedTabs";

interface TasksPageProps {
  onNavigate: (p: PageKey) => void;
  onOpenTask: (taskId: string) => void;
  showToast: (msg: string) => void;
}

const STATUS_TABS = ["全部", "进行中", "已完成", "已逾期", "已停用"];

function taskIconLabel(name: string): string {
  const short = name.slice(0, 4);
  if (short.length <= 2) return short;
  return short.slice(0, 2) + "\n" + short.slice(2, 4);
}

// 任务展示状态（运行时状态 → 中文），与 PC 端「我的任务」判定一致
const displayStatus = (t: TaskRow) => taskDisplayStatus(t);

export default function TasksPage({ onNavigate, onOpenTask, showToast }: TasksPageProps) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [statusTab, setStatusTab] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    taskApi
      .list({ pageSize: 100 })
      .then((data) => setTasks(data.items || []))
      .catch(() => showToast("任务加载失败"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleTasks = useMemo(
    () => tasks.filter((t) => displayStatus(t) !== "待开始"),
    [tasks],
  );

  const filtered = useMemo(() => {
    let list = visibleTasks;
    if (statusTab) {
      list = list.filter((t) => displayStatus(t) === statusTab);
    }
    if (keyword) {
      list = list.filter((t) => t.name.includes(keyword) || (t.code || "").includes(keyword));
    }
    return list;
  }, [visibleTasks, statusTab, keyword]);

  const stats = useMemo(() => {
    const total = visibleTasks.length;
    const overdue = visibleTasks.filter((t) => displayStatus(t) === "已逾期").length;
    const doing = visibleTasks.filter((t) => displayStatus(t) === "进行中").length;
    const completed = visibleTasks.filter((t) => displayStatus(t) === "已完成").length;
    return { total, overdue, doing, completed };
  }, [visibleTasks]);

  return (
    <>
      <div className="task-page-head">
        <h1>我的任务</h1>
        <p>集中查看个人培训、对练和考试任务，合理安排学习进度。</p>
      </div>
      <div className="task-summary">
        <div className="task-stat">
          <label>全部任务</label>
          <strong id="taskTotal">{stats.total}</strong>
        </div>
        <div className="task-stat doing">
          <label>进行中</label>
          <strong id="taskDoing">{stats.doing}</strong>
        </div>
        <div className="task-stat done">
          <label>已完成</label>
          <strong id="taskCompleted">{stats.completed}</strong>
        </div>
        <div className="task-stat overdue">
          <label>已逾期</label>
          <strong id="taskOverdue">{stats.overdue}</strong>
        </div>
      </div>
      <div className="task-filter">
        <div className="task-search-wrap">
          <span className="task-search-icon">⌕</span>
          <input
            id="taskKeyword"
            placeholder="请输入任务名称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button className="task-search-btn" type="button" aria-label="搜索">
            搜索
          </button>
        </div>
      </div>
      <UnifiedTabs
        ariaLabel="任务状态"
        className="unified-tabs--filter"
        items={STATUS_TABS.map((label) => ({ value: label === "全部" ? "" : label, label }))}
        onChange={setStatusTab}
        value={statusTab}
      />
      <div className="task-list reference-list" id="taskList">
        {loading && <div className="task-empty">加载中…</div>}
        {!loading && filtered.length === 0 && <div className="task-empty">暂无相关任务</div>}
        {filtered.map((t) => {
          const st = displayStatus(t);
          const cls = statusClass(st);
          const prog = t.progressPercent || 0;
          return (
            <article
              className="task-card reference-task"
              key={t.id}
              onClick={() => onOpenTask(t.id)}
              style={{ cursor: "pointer" }}
            >
              <div className="reference-main">
                <span className="task-icon">{taskIconLabel(t.name)}</span>
                <div className="task-info">
                  <h3>{t.name}</h3>
                  <p>
                    {taskTypeText(t.type)} | {taskFormText(t.answerForm)} | 场景数：{t.sceneCount}
                  </p>
                </div>
                <span className={`status ${cls}`}>{st}</span>
              </div>
              <div className="reference-progress">
                <span className={cls} style={{ width: `${prog}%` }} />
              </div>
              <div className="reference-footer">
                <span>
                  {st === "已停用" ? "已停用" : st === "已完成" ? "完成" : "截止"} {fmtDate(t.endAt)}
                </span>
                <a onClick={(e) => { e.stopPropagation(); onOpenTask(t.id); }}>
                  {st === "已停用" ? "查看详情" : st === "已完成" ? "查看记录" : "继续学习"} <span>›</span>
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
