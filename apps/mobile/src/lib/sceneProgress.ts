/**
 * 场景学习进度工具（资料完成标记 / 考试次数），本地存储，key 含用户 + 场景。
 * TaskDetailPage 与 ScenarioWorkspace 共用，保证解锁逻辑一致。
 * 这些值仅用于本机 UI 展示和流程提示；服务端可信完成状态以接口返回为准。
 */

const MATERIAL_DONE_KEY = "zxt-material-done";
const EXAM_COUNT_KEY = "zxt-exam-count";
const EXAM_RECORDS_KEY = "zxt-exam-records";

/** 一条场景考试记录（本地展示记录，key 含用户 + 场景） */
export interface ExamRoundRecord {
  round: number;
  question: string;
  answer: string;
  score: number;
  comment: string;
}

export interface ExamRecord {
  id: string;
  sceneId: string;
  score: number; // 综合得分 0-100
  passScore: number;
  passed: boolean;
  mode: string;
  rounds: ExamRoundRecord[];
  finishedAt: string;
}

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

/** 读取某场景的全部考试记录（新→旧） */
export function getExamRecords(sceneId: string): ExamRecord[] {
  try {
    const raw = localStorage.getItem(`${EXAM_RECORDS_KEY}-${currentUserId()}-${sceneId}`);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ExamRecord[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 写入一条考试记录，返回完整记录 */
export function addExamRecord(sceneId: string, rec: Omit<ExamRecord, "id" | "sceneId">): ExamRecord {
  const full: ExamRecord = {
    id: `exam-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sceneId,
    ...rec,
  };
  try {
    const list = getExamRecords(sceneId);
    list.unshift(full);
    localStorage.setItem(`${EXAM_RECORDS_KEY}-${currentUserId()}-${sceneId}`, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* ignore */
  }
  return full;
}
