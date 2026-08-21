export type MobilePageKey = "home" | "tasks" | "taskDetail" | "exams" | "ability" | "profile";
export type TaskRouteView = "detail" | "workspace" | "material" | "practice" | "exam" | "report" | "examReport";
export type ProfileRouteView = "main" | "avatar";
export type MobileModalKey = "tenant" | "account" | "feedback" | "captcha" | "practiceQuitConfirm" | "practiceEndConfirm";

export interface MobileRouteState {
  page: MobilePageKey;
  taskId: string | null;
  sceneId: string | null;
  taskView: TaskRouteView;
  practiceReportRecordId: string | null;
  practiceReportSessionId: string | null;
  sceneExamRecordId: string | null;
  examId: string | null;
  examView: "list" | "take" | "report";
  attemptId: string | null;
  profileView: ProfileRouteView;
  modal: MobileModalKey | null;
}

const DEFAULT_ROUTE: MobileRouteState = {
  page: "home",
  taskId: null,
  sceneId: null,
  taskView: "detail",
  practiceReportRecordId: null,
  practiceReportSessionId: null,
  sceneExamRecordId: null,
  examId: null,
  examView: "list",
  attemptId: null,
  profileView: "main",
  modal: null,
};

function partsOf(pathname: string) {
  return pathname.split("/").filter(Boolean).map(decodeURIComponent);
}

function readModal(searchParams?: { get(name: string): string | null } | null): MobileModalKey | null {
  const modal = searchParams?.get("modal") || null;
  return modal === "tenant" || modal === "account" || modal === "feedback" || modal === "captcha" || modal === "practiceQuitConfirm" || modal === "practiceEndConfirm" ? modal : null;
}

export function parseMobileRoute(pathname: string, searchParams?: { get(name: string): string | null } | null): MobileRouteState {
  const parts = partsOf(pathname);
  const modal = readModal(searchParams);
  if (parts.length === 0) return { ...DEFAULT_ROUTE, modal };

  const [root, id, segment, sceneId, action, actionId] = parts;
  if (root === "tasks") {
    if (!id) return { ...DEFAULT_ROUTE, page: "tasks", modal };
    const base = { ...DEFAULT_ROUTE, page: "taskDetail" as const, taskId: id, modal };
    if (segment !== "scenes" || !sceneId) return base;
    if (action === "material" || action === "practice" || action === "exam") {
      return { ...base, sceneId, taskView: action };
    }
    if (action === "practice-report") {
      return { ...base, sceneId, taskView: "report", practiceReportRecordId: actionId || null, practiceReportSessionId: searchParams?.get("sessionId") || null };
    }
    if (action === "exam-report") {
      return { ...base, sceneId, taskView: "examReport", sceneExamRecordId: actionId || null };
    }
    return { ...base, sceneId, taskView: "workspace" };
  }

  if (root === "exams") {
    if (!id) return { ...DEFAULT_ROUTE, page: "exams", modal };
    if (segment === "take") return { ...DEFAULT_ROUTE, page: "exams", examId: id, examView: "take", modal };
    if (segment === "report") return { ...DEFAULT_ROUTE, page: "exams", examId: id, examView: "report", attemptId: sceneId || null, modal };
    return { ...DEFAULT_ROUTE, page: "exams", modal };
  }

  if (root === "ability") return { ...DEFAULT_ROUTE, page: "ability", modal };
  if (root === "profile") return { ...DEFAULT_ROUTE, page: "profile", profileView: id === "avatar" ? "avatar" : "main", modal };
  return { ...DEFAULT_ROUTE, modal };
}

export function pathForPage(page: MobilePageKey) {
  if (page === "home") return "/";
  if (page === "tasks") return "/tasks";
  if (page === "exams") return "/exams";
  if (page === "ability") return "/ability";
  if (page === "profile") return "/profile";
  return "/tasks";
}

export function pathForTask(taskId: string) {
  return `/tasks/${encodeURIComponent(taskId)}`;
}

export function pathForTaskScene(taskId: string, sceneId: string, view: TaskRouteView = "workspace", reportId?: string | null) {
  const base = `/tasks/${encodeURIComponent(taskId)}/scenes/${encodeURIComponent(sceneId)}`;
  if (view === "workspace") return base;
  if (view === "report") return `${base}/practice-report${reportId ? `/${encodeURIComponent(reportId)}` : ""}`;
  if (view === "examReport") return `${base}/exam-report${reportId ? `/${encodeURIComponent(reportId)}` : ""}`;
  return `${base}/${view}`;
}

export function pathForExam(examId: string, mode: "take" | "report", attemptId?: string | null) {
  const base = `/exams/${encodeURIComponent(examId)}`;
  if (mode === "report") return `${base}/report${attemptId ? `/${encodeURIComponent(attemptId)}` : ""}`;
  return `${base}/take`;
}

export function withModal(path: string, modal: MobileModalKey | null) {
  if (!modal) return path;
  return `${path}${path.includes("?") ? "&" : "?"}modal=${modal}`;
}
