// 移动端共享类型与工具

export interface MobileTask {
  id: string;
  name: string;
  type: string;
  form: string;
  scene: string;
  progress: number;
  status: string;
  code: string;
  date: string;
  icon: string;
  cls: string;
}

export function statusClass(s: string): string {
  if (s === "未开始" || s === "待开始" || s === "draft") return "wait";
  if (s === "进行中" || s === "published") return "doing";
  if (s === "已完成" || s === "已通过" || s === "completed" || s === "passed") return "done";
  if (s === "已停用" || s === "stopped") return "stopped";
  if (s === "未通过") return "overdue";
  if (s === "已逾期" || s === "overdue") return "overdue";
  return "wait";
}

// 任务状态中文映射（后端 status -> 前端展示）
export function taskStatusText(status: string): string {
  const map: Record<string, string> = {
    draft: "待开始",
    published: "进行中",
    completed: "已完成",
    stopped: "已停用",
    overdue: "已逾期",
    待开始: "待开始",
    进行中: "进行中",
    已完成: "已完成",
    已停用: "已停用",
    已逾期: "已逾期",
  };
  return map[status] || "待开始";
}

// 任务运行时状态（与 PC 端 getTaskRuntimeStatus 对齐）：
// completed → 已完成；endAt 已过 → 已逾期（不论 published/stopped）；published → 进行中；其余 → 待开始
export function taskRuntimeStatus(status: string, endAt: string | null | undefined): string {
  if (status === "completed") return "completed";
  if (status === "stopped") return "stopped";
  const endTime = endAt ? new Date(endAt).getTime() : Number.NaN;
  if (Number.isFinite(endTime) && endTime < Date.now()) return "overdue";
  if (status === "published") return "published";
  return status;
}

// 任务展示状态文本（运行时状态 → 中文），与 PC 端「我的任务」判定一致
export function taskDisplayStatus(status: string, endAt: string | null | undefined): string {
  const runtime = taskRuntimeStatus(status, endAt);
  if (runtime === "completed") return "已完成";
  if (runtime === "stopped") return "已停用";
  if (runtime === "overdue") return "已逾期";
  if (runtime === "published") return "进行中";
  return "待开始";
}

export function taskFormText(mode: string | null | undefined): string {
  return mode === "text" ? "文本形式" : "语音形式";
}

export function taskTypeText(type: string | null | undefined): string {
  const map: Record<string, string> = {
    free_practice: "自由对练",
    fixed_practice: "固定对练",
    free_exam: "自由考试",
    fixed_exam: "固定考试",
    scenario_training: "常规对话",
    fixed_script: "固定剧本",
    exam: "阶段考试",
    mixed: "混合模式",
  };
  return map[type || ""] || type || "常规对话";
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return d.slice(0, 10);
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return d.replace("T", " ").slice(0, 19);
}
