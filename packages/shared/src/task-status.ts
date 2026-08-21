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

/**
 * 学员任务运行状态：停用优先；已过截止时间为逾期；未开始为待开始；
 * 有考试任务需完成全部对练和考试，无考试任务需完成全部对练。
 */
export function taskRuntimeStatus(task: TaskStatusInput): "draft" | "published" | "completed" | "stopped" | "overdue" {
  if (task.status === "stopped") return "stopped";

  const now = Date.now();
  const startTime = toTime(task.startAt);
  const endTime = toTime(task.endAt);
  if (Number.isFinite(endTime) && now > endTime) return "overdue";
  if (task.status === "draft" || (Number.isFinite(startTime) && now <= startTime)) return "draft";

  const sceneCount = Number(task.sceneCount || 0);
  const practiceDone = sceneCount > 0
    ? Number(task.completedSceneCount || 0) >= sceneCount
    : task.status === "completed";
  const examDone = !taskHasExam(task) || (sceneCount > 0
    ? Number(task.completedExamSceneCount || 0) >= sceneCount
    : task.status === "completed");

  return practiceDone && examDone ? "completed" : "published";
}
