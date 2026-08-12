/**
 * 场景学习进度工具（资料完成标记 / 考试次数），本地存储，key 含用户 + 场景。
 * TaskDetailPage 与 ScenarioWorkspace 共用，保证解锁逻辑一致。
 */

const MATERIAL_DONE_KEY = "zxt-material-done";
const EXAM_COUNT_KEY = "zxt-exam-count";

export function currentUserId(): string {
  try {
    const raw = localStorage.getItem("zxt-mobile-auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.user?.id || "anonymous";
    }
  } catch {
    /* ignore */
  }
  return "anonymous";
}

export function isMaterialDone(sceneId: string): boolean {
  try {
    return localStorage.getItem(`${MATERIAL_DONE_KEY}-${currentUserId()}-${sceneId}`) === "1";
  } catch {
    return false;
  }
}

export function markMaterialDone(sceneId: string) {
  try {
    localStorage.setItem(`${MATERIAL_DONE_KEY}-${currentUserId()}-${sceneId}`, "1");
  } catch {
    /* ignore */
  }
}

export function getExamCount(sceneId: string): number {
  try {
    return Number(localStorage.getItem(`${EXAM_COUNT_KEY}-${currentUserId()}-${sceneId}`) || 0) || 0;
  } catch {
    return 0;
  }
}

export function addExamCount(sceneId: string): number {
  const next = getExamCount(sceneId) + 1;
  try {
    localStorage.setItem(`${EXAM_COUNT_KEY}-${currentUserId()}-${sceneId}`, String(next));
  } catch {
    /* ignore */
  }
  return next;
}
