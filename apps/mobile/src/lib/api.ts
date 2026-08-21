// 移动端 API 封装层 —— 对接 zxt-next 后端接口
// 认证：优先使用服务端 HttpOnly Cookie；旧会话 Bearer token 仅作兼容兜底。
function isInsecureHttpApiBase(value: string) {
  return /^http:\/\//i.test(value);
}

function normalizeApiBase(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveApiBase() {
  const configured = (
    process.env.NEXT_PUBLIC_MOBILE_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).trim();

  // 本地开发时浏览器统一走同源 /api，由移动端 Next 代理到 API 服务。
  // 避免手机访问局域网地址时，把 localhost 或历史 IP 解析错导致验证码 Failed to fetch。
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") return "/api";

  if (configured) {
    if (process.env.NODE_ENV === "production" && isInsecureHttpApiBase(configured)) return "/api";
    return normalizeApiBase(configured);
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
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("网络请求失败，请确认移动端与 API 服务已启动后重试");
  }
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
  status: "draft" | "published" | "stopped" | "completed" | "overdue";
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
  sceneIds?: string[];
  completedExamSceneCount?: number;
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

// ============ 学员看板 ============
export const dashboardApi = {
  learner: (userId?: string) =>
    request<any>(`/dashboard/learner${userId ? `?userId=${userId}` : ""}`),
};

// ============ AI 对练 ============
export type AiChatRequest =
  | { sceneId: string; action: "start"; preview?: boolean }
  | { sceneId: string; action: "message"; sessionId: string; learnerText: string }
  | { sceneId: string; action: "end"; sessionId: string }
  | { sceneId: string; action: "quit"; sessionId: string };

export interface AiTurnScore {
  name: string;
  score: number;
  maxScore: number;
  level: "excellent" | "pass" | "developing";
  reason?: string;
  issues?: string[];
  advice?: string[];
}

export interface AiInspirationHint {
  title: string;
  content?: string;
  focus?: string[];
  avoid?: string;
  body?: string;
  ability_gap?: string;
  thinking_direction?: string;
  focus_points?: string[];
  avoid_points?: string[];
}

export interface AiChatResponse {
  sessionId?: string;
  aiReply?: string;
  emotion?: string;
  inspirationHint?: AiInspirationHint | null;
  perTurnScores?: AiTurnScore[];
  round?: number;
  isFinished?: boolean;
  outcome?: "continuing" | "cooperated" | "hesitating" | "left" | "complaint" | "off_topic_terminated" | "max_round" | "learner_ended" | "severe_misconduct";
  recordPending?: boolean;
  trainingRecord?: { score?: number | null } | null;
}

export const aiApi = {
  chat: (body: AiChatRequest) =>
    request<AiChatResponse>("/ai/chat", { method: "POST", body }),
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
    request<any>(`/training-records/by-session/${encodeURIComponent(sessionId)}?t=${Date.now()}`),
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
