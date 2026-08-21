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

// 任务运行状态计算输入。列表页可传入学员维度的场景/考试完成数，避免只按后端任务状态粗略展示。
export interface TaskStatusInput {
  status: string;
  type?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  sceneCount?: number | null;
  completedSceneCount?: number | null;
  completedExamSceneCount?: number | null;
  hasExam?: boolean | null;
}

function toTime(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}

export function taskHasExam(task: Pick<TaskStatusInput, "type" | "hasExam">): boolean {
  const type = (task.type || "").toLowerCase();
  return Boolean(task.hasExam) || type === "exam" || type === "mixed" || type === "free_exam" || type === "fixed_exam" || type.endsWith("_exam");
}

function normalizeTaskStatusInput(
  statusOrTask: TaskStatusInput | string,
  endAt?: string | null,
  startAt?: string | null,
): TaskStatusInput {
  if (typeof statusOrTask === "string") return { status: statusOrTask, endAt, startAt };
  return statusOrTask;
}

// 任务运行时状态：停用优先；当前时间超过截止时间为逾期；未到开始时间为待开始；
// 在有效期内按当前学员完成进度判定：有考试需完成全部场景对练和考试，
// 无考试任务只需完成全部场景对练。资料阅读不作为任务完成的前置条件。
export function taskRuntimeStatus(
  statusOrTask: TaskStatusInput | string,
  endAt?: string | null,
  startAt?: string | null,
): string {
  const task = normalizeTaskStatusInput(statusOrTask, endAt, startAt);
  if (task.status === "stopped") return "stopped";

  const now = Date.now();
  const startTime = toTime(task.startAt);
  const endTime = toTime(task.endAt);
  if (Number.isFinite(endTime) && endTime < now) return "overdue";
  if (Number.isFinite(startTime) && startTime >= now) return "draft";
  if (task.status === "draft") return "draft";

  const sceneCount = Number(task.sceneCount || 0);
  const completedSceneCount = Number(task.completedSceneCount || 0);
  const completedExamSceneCount = Number(task.completedExamSceneCount || 0);
  const practiceDone = sceneCount > 0 ? completedSceneCount >= sceneCount : task.status === "completed";
  const examDone = !taskHasExam(task) || (sceneCount > 0 ? completedExamSceneCount >= sceneCount : task.status === "completed");

  if (practiceDone && examDone) return "completed";
  if (task.status === "published" || task.status === "completed") return "published";
  return task.status;
}

/** 任务是否已停用。停用状态优先于时间和学习进度。 */
export function isTaskStopped(task: Pick<TaskStatusInput, "status"> | null | undefined): boolean {
  return task?.status === "stopped" || task?.status === "已停用";
}

/** 任务是否已逾期。逾期任务仍允许进入并操作全部学习场景。 */
export function isTaskOverdue(
  task: TaskStatusInput | null | undefined,
): boolean {
  return Boolean(task) && taskRuntimeStatus(task as TaskStatusInput) === "overdue";
}

// 任务展示状态文本（运行时状态 → 中文），与移动端我的任务判定一致
export function taskDisplayStatus(
  statusOrTask: TaskStatusInput | string,
  endAt?: string | null,
  startAt?: string | null,
): string {
  const runtime = taskRuntimeStatus(statusOrTask, endAt, startAt);
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
