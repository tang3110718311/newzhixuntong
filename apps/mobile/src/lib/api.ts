// 移动端 API 封装层 —— 对接 zxt-next 后端接口
// 认证：优先使用服务端 HttpOnly Cookie；旧会话 Bearer token 仅作兼容兜底。
function isInsecureHttpApiBase(value: string) {
  return /^http:\/\//i.test(value);
}

function resolveApiBase() {
  const configured =
    process.env.NEXT_PUBLIC_MOBILE_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";
  if (configured) {
    if (process.env.NODE_ENV === "production" && isInsecureHttpApiBase(configured)) return "/api";
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "/api" : "http://localhost:4000/api";
}

export const API_BASE = resolveApiBase();

const TOKEN_KEY = "zxt-mobile-auth";

export interface AuthUser {
  id: string;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  name: string;
  mobile: string;
  email: string | null;
  roleCode: string;
  status: string;
  orgId: string | null;
  orgName: string | null;
  passwordMustChange: number;
}

export interface LoginResult {
  // TODO(auth-cookie): remove this Bearer token from the mobile contract after all clients use HttpOnly cookies.
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export interface CaptchaChallenge {
  captchaId: string;
  backgroundImage?: string;
  expiresIn: number;
  pieceSize: number;
  trackMax: number;
}

export function hasStoredAuth(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }
    return Boolean(parsed.user || parsed.token);
  } catch {
    return false;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return typeof parsed.token === "string" ? parsed.token : null;
  } catch {
    return null;
  }
}

export function setAuth(data: LoginResult) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ expiresAt: data.expiresAt, token: data.token, user: data.user }));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || !json?.success) {
    const err = new Error(json?.message || `请求失败 (${res.status})`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = json?.code;
    err.status = res.status;
    throw err;
  }
  return json.data as T;
}

// ============ 认证 ============
export const authApi = {
  login: (mobile: string, password: string, captchaToken: string) =>
    request<LoginResult>("/auth/login", {
      method: "POST",
      body: { mobile, password, captchaToken },
      auth: false,
    }),
  captcha: () =>
    request<CaptchaChallenge>("/auth/captcha", {
      auth: false,
    }),
  verifyCaptcha: (captchaId: string, positionX: number) =>
    request<{ captchaToken: string; expiresIn: number }>("/auth/captcha", {
      method: "POST",
      body: { captchaId, positionX },
      auth: false,
    }),
  me: () => request<{ tenant: any; user: AuthUser }>("/auth/me"),
  logout: () => request<null>("/auth/logout", { method: "POST" }),
  switchTenant: (tenantCode: string) =>
    request<LoginResult>("/auth/switch-tenant", {
      method: "POST",
      body: { tenantCode },
    }),
};

// ============ 企业（租户） ============
export interface TenantRow {
  id: string;
  name: string;
  code: string;
  status: string;
}

export const tenantApi = {
  /** 当前用户可切换的企业列表 */
  mine: () =>
    request<{ items: TenantRow[]; current: string }>("/tenants/mine"),
};

// ============ 任务 ============
export interface TaskRow {
  id: string;
  name: string;
  code: string;
  type: string;
  description: string | null;
  status: "draft" | "published" | "stopped" | "completed";
  startAt: string | null;
  endAt: string | null;
  publishAt: string | null;
  completedAt: string | null;
  createdBy: string | null;
  creatorName: string | null;
  creatorOrgName: string | null;
  participantCount: number;
  sceneCount: number;
  completedSceneCount: number;
  progressPercent: number;
  primarySceneType: string | null;
  primaryMode: string | null;
  answerForm: "voice" | "text" | null;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const taskApi = {
  list: (params: { page?: number; pageSize?: number; keyword?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.keyword) qs.set("keyword", params.keyword);
    if (params.status) qs.set("status", params.status);
    return request<PageResult<TaskRow>>(`/tasks?${qs.toString()}`);
  },
  detail: (id: string) => request<any>(`/tasks/${id}`),
};

// ============ 场景 ============
export const sceneApi = {
  detail: (id: string) => request<any>(`/scenes/${id}`),
};

// ============ 考试 ============
export interface ExamRow {
  id: string;
  name: string;
  code: string | null;
  bankId: string | null;
  description: string | null;
  durationMinutes: number;
  passScore: number;
  totalScore: number;
  questionCount: number;
  status: string;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
}

export interface ExamQuestionRow {
  id: string;
  bankId: string | null;
  type: "single" | "multi" | "judge";
  stem: string;
  options: string[];
  answer?: string;
  analysis?: string;
  score: number;
  sortOrder: number;
  createdAt: string;
}

export type ExamDetail = ExamRow & { questions: ExamQuestionRow[] };

export const examApi = {
  list: () => request<ExamRow[]>("/exams"),
  detail: (id: string) => request<ExamDetail>(`/exams?id=${id}`),
};

// ============ 考试记录 ============
export interface ExamAttemptRow {
  id: string;
  examId: string;
  examName: string;
  taskId?: string | null;
  sceneId?: string | null;
  userId: string | null;
  userName: string | null;
  score: number | null;
  totalScore: number;
  status: "in_progress" | "passed" | "failed";
  durationSeconds: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export const attemptApi = {
  list: (examId?: string) =>
    request<ExamAttemptRow[]>(`/exam-attempts${examId ? `?examId=${examId}` : ""}`),
  start: (examId: string, userId?: string) =>
    request<any>("/exam-attempts", {
      method: "POST",
      body: userId ? { examId, userId } : { examId },
    }),
  submit: (attemptId: string, answers: { questionId: string; answer: string }[]) =>
    request<any>(`/exam-attempts?id=${attemptId}`, {
      method: "PUT",
      body: { answers },
    }),
};

// ============ 学员看板 ============
export const dashboardApi = {
  learner: (userId?: string) =>
    request<any>(`/dashboard/learner${userId ? `?userId=${userId}` : ""}`),
};

// ============ AI 对练 ============
export type AiChatRequest =
  | { sceneId: string; action: "start"; preview?: boolean }
  | { sceneId: string; action: "message"; sessionId: string; learnerText: string }
  | { sceneId: string; action: "end"; sessionId: string };

export const aiApi = {
  chat: (body: AiChatRequest) =>
    request<any>("/ai/chat", { method: "POST", body }),
  stt: (audioBase64: string, format = "webm") =>
    request<{ text: string; durationMs: number }>("/ai/stt/transcribe", {
      method: "POST",
      body: { audioBase64, format },
    }),
  tts: (text: string, voice?: string, emotion?: string) =>
    request<{ audioBase64: string; format: string; engine: string }>("/ai/tts/synthesize", {
      method: "POST",
      body: { text, voice, emotion },
    }),
};

// ============ 训练记录 ============
export const recordApi = {
  bySession: (sessionId: string) =>
    request<any>(`/training-records/by-session/${encodeURIComponent(sessionId)}`),
  detail: (id: string) => request<any>(`/training-records/${id}`),
  list: (params: { page?: number; pageSize?: number; sceneId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.sceneId) qs.set("sceneId", params.sceneId);
    return request<PageResult<any>>(`/training-records?${qs.toString()}`);
  },
};

// ============ 能力模型 ============
export const capabilityApi = {
  list: () => request<PageResult<any>>("/capability-models?pageSize=50"),
};
