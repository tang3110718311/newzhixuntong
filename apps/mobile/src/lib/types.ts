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
  if (s === "已完成" || s === "completed") return "done";
  if (s === "已逾期" || s === "overdue") return "overdue";
  return "wait";
}

// 任务状态中文映射（后端 status -> 前端展示）
export function taskStatusText(status: string): string {
  const map: Record<string, string> = {
    draft: "待开始",
    published: "进行中",
    completed: "已完成",
    stopped: "已逾期",
    overdue: "已逾期",
    待开始: "待开始",
    进行中: "进行中",
    已完成: "已完成",
    已逾期: "已逾期",
  };
  return map[status] || "待开始";
}

export function taskFormText(mode: string | null | undefined): string {
  return mode === "text" ? "文本形式" : "语音形式";
}

export function taskTypeText(type: string | null | undefined): string {
  const map: Record<string, string> = {
    scenario_training: "常规对话",
    fixed_script: "固定剧本",
    exam: "阶段考试",
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
