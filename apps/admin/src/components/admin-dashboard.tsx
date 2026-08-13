"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ApiResponse, AuthSession, DashboardOverview, PageResult } from "@zxt/shared";
import {
  AlertCircle,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  KeyRound,
  Landmark,
  Loader2,
  LogOut,
  Menu,
  Paperclip,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Wand2,
} from "lucide-react";
import { AppealsSection } from "./AppealsSection";
import { KnowledgeSection } from "./KnowledgeSection";
import { HomeSection } from "./HomeSection";
import { StatisticsSection } from "./StatisticsSection";
import { SysMenusSection } from "./SysMenusSection";
import { SysPostsSection } from "./SysPostsSection";
import { SysRolesSection } from "./SysRolesSection";
import { navigateTo } from "@/lib/navigation";
import { ConfirmDialog } from "./ConfirmDialog";

type NavChild = { id: string; key: ActiveSection; label: string; icon: React.ReactNode };
type NavItem = {
  id: string;
  key: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  group?: string;
  children?: NavChild[];
};

type IndustryPackage = {
  id: string;
  name: string;
  code: string;
  industryType: string;
  targetRoles: string;
  status: string;
  version: string;
  isSystemTemplate: number | boolean;
  description?: string;
};

type Scene = {
  id: string;
  name: string;
  code: string;
  industryPackageId?: string | null;
  industryPackageName?: string | null;
  sceneType: string;
  mode: string;
  createMode?: string;
  status: string;
  isTemplate: number | boolean;
  sourceType: string;
  description?: string;
  passScore?: number;
  taskCount?: number;
  creatorName?: string | null;
  creatorOrgName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};


type SceneRole = {
  id: string;
  roleType: string;
  identity: string;
  background: string;
  personality: string;
  emotion: string;
  goal: string;
};

type SceneRule = {
  id: string;
  initiator: string;
  endCondition: string;
  interruptCondition: string;
  description: string;
};

type ScoringRule = {
  id?: string;
  name: string;
  score: number;
  criteria: string;
  deductionRule: string;
  evidenceRequired: string;
  sortOrder?: number;
};

type ScoringRuleDraft = {
  name: string;
  score: number;
  criteria: string;
  deductionRule: string;
  evidenceRequired: string;
};

type SceneDetail = {
  scene: Scene & { industryPackageName?: string | null };
  roles: SceneRole[];
  rule: SceneRule | null;
  scoringRules: ScoringRule[];
  materials: Material[];
};
type Task = {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  startAt?: string | null;
  endAt?: string | null;
  publishAt?: string | null;
  createdBy?: string | null;
  creatorName?: string | null;
  participantCount?: number;
  sceneCount?: number;
  completedSceneCount?: number;
  progressPercent?: number;
};

type TaskScene = {
  id: string;
  sceneId: string;
  sceneName?: string | null;
  sceneCode?: string | null;
  sceneType?: string | null;
  mode?: string | null;
  status?: string | null;
  sortOrder: number;
  requiredTrainTimes: number;
  passScore: number;
  completedTrainCount?: number;
};

type TaskParticipant = {
  id: string;
  participantType: "user" | "org";
  userId?: string | null;
  userName?: string | null;
  mobile?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  status: string;
  finishedAt?: string | null;
};

type TaskDetail = {
  task: Task;
  scenes: TaskScene[];
  participants: TaskParticipant[];
};

type Material = {
  id: string;
  name: string;
  type: string;
  industryPackageId?: string | null;
  industryPackageName?: string | null;
  sceneId?: string | null;
  sceneName?: string | null;
  tags: string;
  status: string;
  content: string;
  createdAt: string;
};

type Organization = {
  id: string;
  parentId?: string | null;
  parentName?: string | null;
  code: string;
  name: string;
  type: string;
  sortOrder: number;
  userCount: number;
  createdAt: string;
};

type User = {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  roleCode: string;
  status: string;
  orgId?: string | null;
  orgName?: string | null;
};

type TrainingRecord = {
  id: string;
  recordNo: string;
  taskName?: string | null;
  sceneName?: string | null;
  userName?: string | null;
  mode: string;
  status: string;
  score: number;
  finishedAt?: string | null;
};

type TrainingRecordDetail = {
  record: TrainingRecord;
  turns: Array<{ id: string; speaker: string; text: string; durationMs: number; startedAt?: string | null }>;
  scores: Array<{ id: string; ruleName?: string | null; score: number; deductionReason: string; evidenceText: string }>;
};

type Appeal = {
  id: string;
  bizType: string;
  bizId: string;
  recordNo?: string | null;
  taskName?: string | null;
  sceneName?: string | null;
  score?: number | null;
  userId?: string | null;
  userName?: string | null;
  reason: string;
  status: string;
  handlerId?: string | null;
  handlerName?: string | null;
  handledAt?: string | null;
  createdAt: string;
};

type AiProvider = {
  id: string;
  providerType: string;
  providerName: string;
  modelName: string;
  baseUrl: string;
  status: string;
  isDefault: number | boolean;
};

type ExamQuestion = {
  id: string;
  bankId?: string | null;
  type: "single" | "multi" | "judge";
  stem: string;
  options: string[];
  answer: string;
  analysis: string;
  score: number;
  sortOrder: number;
  createdAt: string;
};

type ExamBank = {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  createdAt: string;
};

type ExamBankDetail = ExamBank & { questions: ExamQuestion[] };

type Exam = {
  id: string;
  name: string;
  code: string;
  bankId?: string | null;
  description: string;
  durationMinutes: number;
  passScore: number;
  totalScore: number;
  questionCount: number;
  status: string;
  startAt?: string | null;
  endAt?: string | null;
  createdAt: string;
};

type ExamDetail = Exam & { questions: ExamQuestion[] };

type ExamAttempt = {
  id: string;
  examId: string;
  examName?: string | null;
  userId?: string | null;
  userName?: string | null;
  score: number;
  totalScore: number;
  status: string;
  durationSeconds: number;
  startedAt: string;
  finishedAt?: string | null;
  createdAt: string;
};

type TenantSettings = {
  id: string;
  name: string;
  code: string;
  status: string;
  planCode: string;
  expireAt?: string | null;
  resourceQuota: {
    sceneLimit: number;
    aiTokenLimit: number;
    sttSeconds: number;
    ttsCharacters: number;
  };
};

type ActiveSection =
  | "overview"
  | "student-home"
  | "my-tasks"
  | "task-detail"
  | "my-exams"
  | "scenes"
  | "knowledge"
  | "tasks"
  | "appeals"
  | "statistics-dept"
  | "statistics-learner"
  | "materials"
  | "settings"
  | "sys-users"
  | "sys-roles"
  | "sys-menus"
  | "sys-departments"
  | "sys-posts"
  | "sys-tenants"
  | "records"
  | "practice";

// 所有可导航的 section key（用于校验 URL ?section= 参数）
const VALID_SECTIONS: ReadonlySet<string> = new Set([
  "overview", "student-home", "my-tasks", "task-detail", "my-exams", "scenes", "knowledge",
  "tasks", "appeals", "statistics-dept", "statistics-learner", "materials", "settings",
  "sys-users", "sys-roles", "sys-menus", "sys-departments", "sys-posts", "sys-tenants",
  "records", "practice",
]);

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const AUTH_STORAGE_KEY = "zxt-admin-auth";

const initialLoginForm = {
  mobile: "",
  password: "",
  code: "",
};

function readStoredAuth(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.token || !parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function getStoredAuthToken() {
  return readStoredAuth()?.token || "";
}

function storeAuthSession(session: AuthSession) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredAuthSession() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

const initialIndustryForm = {
  name: "",
  code: "",
  industryType: "custom",
  targetRoles: "",
  description: "",
};

const initialSceneForm = {
  industryPackageId: "",
  name: "",
  code: "",
  mode: "voice",
  sceneType: "",
  description: "",
};


const initialTaskForm = {
  name: "",
  code: "",
  type: "scenario_training",
  sceneIds: [] as string[],
  participantUserIds: [] as string[],
  participantOrgIds: [] as string[],
  startAt: "",
  endAt: "",
  publishNow: true,
  answerForm: "voice" as "voice" | "text",
};

const initialOrgForm = {
  name: "",
  code: "",
  type: "department",
  parentId: "",
  sortOrder: 0,
};

const initialUserForm = {
  name: "",
  mobile: "",
  email: "",
  roleCode: "learner",
  orgId: "",
  initialPassword: "Zxt@2026",
};

const initialMaterialForm = {
  name: "",
  type: "script",
  industryPackageId: "",
  sceneId: "",
  tags: "",
  content: "",
};

const initialAiForm = {
  providerType: "llm",
  providerName: "",
  modelName: "",
  baseUrl: "",
  apiKey: "",
  status: "enabled",
};

const initialTenantForm = {
  name: "",
  planCode: "trial",
  expireAt: "",
  resourceQuota: {
    sceneLimit: 50,
    aiTokenLimit: 100000,
    sttSeconds: 3600,
    ttsCharacters: 100000,
  },
};

const initialAiGenerateForm = {
  industryPackageId: "",
  targetRole: "客服坐席",
  mode: "voice",
  createMode: "ai_practice",
  sceneDescription: "客户投诉网络故障反复未解决，要求客服明确处理时限并给出闭环反馈。",
};

const initialBankForm = {
  name: "",
  description: "",
};

const initialExamQuestionForm = {
  bankId: "",
  type: "single" as "single" | "multi" | "judge",
  stem: "",
  options: ["", "", "", ""] as string[],
  answer: "",
  analysis: "",
  score: 5,
};

const initialExamForm = {
  name: "",
  code: "",
  bankId: "",
  description: "",
  durationMinutes: 60,
  passScore: 60,
  questionIds: [] as string[],
};

const initialAppealForm = {
  bizId: "",
  reason: "",
};

const initialRecordForm = {
  taskId: "",
  sceneId: "",
  userId: "",
  mode: "voice",
  score: 85,
  aiText: "客户表示问题多次反馈仍未解决，要求明确处理时限。",
  learnerText: "您好，非常抱歉给您带来不便。我先核实历史工单，并为您明确本次处理时限和反馈方式。",
  deductionReason: "综合表现基本达标，闭环时限表达可进一步量化。",
  evidenceText: "核实历史工单、明确处理时限和反馈方式",
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      // multipart 上传时浏览器自动生成 boundary，不能手动设置 Content-Type
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.success) {
    throw new Error(payload.message || payload.code);
  }
  return payload.data;
}
function statusBadge(status: string) {
  const labelMap: Record<string, string> = {
    active: "有效",
    enabled: "启用",
    published: "已发布",
    draft: "草稿",
    disabled: "停用",
    stopped: "已停用",
    completed: "已完成",
    in_progress: "进行中",
    pending: "待处理",
    approved: "已通过",
    rejected: "已驳回",
  };
  const tone = status === "published" || status === "enabled" || status === "completed" || status === "active" || status === "approved"
    ? "green"
    : status === "draft" || status === "in_progress" || status === "pending"
      ? "amber"
      : "red";
  return <span className={`badge ${tone}`}>{labelMap[status] || status}</span>;
}

function modeLabel(mode: string) {
  return mode === "voice" ? "语音模式" : "文本模式";
}

const CREATE_MODE_LABELS: Record<string, string> = {
  ai_practice: "AI对练模式",
  ai_exam: "AI对练+考试模式",
  fixed_practice: "固定对练模式",
  fixed_exam: "固定对练+考试模式",
};

function createModeLabel(createMode?: string) {
  if (!createMode) return "";
  return CREATE_MODE_LABELS[createMode] || createMode;
}

function sourceLabel(sourceType: string, isTemplate: number | boolean) {
  if (Boolean(isTemplate)) return "行业模板";
  return sourceType === "ai" ? "AI 创建" : "手工创建";
}

function organizationTypeLabel(type: string) {
  const labelMap: Record<string, string> = {
    department: "部门",
    company: "公司",
    team: "班组",
    external: "外部组织",
  };
  return labelMap[type] || type;
}
function materialTypeLabel(type: string) {
  const labelMap: Record<string, string> = {
    script: "\u8bdd\u672f",
    faq: "\u95ee\u7b54",
    policy: "\u5236\u5ea6",
    case: "\u6848\u4f8b",
    other: "\u5176\u4ed6",
  };
  return labelMap[type] || type;
}

function parseTags(tags: string) {
  try {
    const parsed = JSON.parse(tags) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function makeCode(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("overview");
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [industries, setIndustries] = useState<IndustryPackage[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [tenantForm, setTenantForm] = useState(initialTenantForm);
  const [industryForm, setIndustryForm] = useState(initialIndustryForm);
  const [sceneForm, setSceneForm] = useState(initialSceneForm);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [orgForm, setOrgForm] = useState(initialOrgForm);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [materialForm, setMaterialForm] = useState(initialMaterialForm);
  // selectedSceneDetail + scoringRuleForms removed: scene detail now at /scenes/[id]
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<TaskDetail | null>(null);
  const [selectedTaskSceneId, setSelectedTaskSceneId] = useState<string | null>(null);
  // scoringRuleForms removed: scoring rules editing now at /scenes/[id]
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<TrainingRecordDetail | null>(null);
  const [recordForm, setRecordForm] = useState(initialRecordForm);
  const [appealForm, setAppealForm] = useState(initialAppealForm);
  const [aiForm, setAiForm] = useState(initialAiForm);
  const [aiGenerateForm, setAiGenerateForm] = useState(initialAiGenerateForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSceneWizard, setShowSceneWizard] = useState(false);
  const [showSceneModePicker, setShowSceneModePicker] = useState(false);
  const [sceneWizardStep, setSceneWizardStep] = useState(1);
  const sceneAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [sceneAttachments, setSceneAttachments] = useState<Array<{ name: string; fileId?: string; status: "uploading" | "done" | "failed"; error?: string }>>([]);
  const [sceneAttachmentsUploading, setSceneAttachmentsUploading] = useState(false);
  const [showSceneKbPicker, setShowSceneKbPicker] = useState(false);
  const [sceneKbFolders, setSceneKbFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [sceneKbFiles, setSceneKbFiles] = useState<Array<{ id: string; name: string; parseStatus: string }>>([]);
  const [sceneKbFolderId, setSceneKbFolderId] = useState("");
  const [selectedKbFileIds, setSelectedKbFileIds] = useState<string[]>([]);
  const [sceneFilter, setSceneFilter] = useState({ status: "all", mode: "all", createMode: "all", org: "all", keyword: "" });
  const [scenePage, setScenePage] = useState(1);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [sceneToDelete, setSceneToDelete] = useState<Scene | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [wizardRoleForm, setWizardRoleForm] = useState({
    aiIdentity: "",
    aiBackground: "",
    aiPersonality: "",
    aiEmotion: "",
    aiStyle: "",
    learnerIdentity: "",
    dialogueGoal: "",
    initiator: "ai",
    endCondition: "",
    interruptCondition: "",
    dialogueExample: "",
    sceneDescription: "",
  });
  const [aiGenerateDraft, setAiGenerateDraft] = useState<{ name: string; sceneType: string; description: string; aiRole: { identity: string; background: string; personality: string; emotion: string; goal: string }; learnerRole: { identity: string; goal: string }; endCondition: string; interruptCondition: string; scoringRules: ScoringRuleDraft[] } | null>(null);
  // P2 主动追问：AI 返回的追问问题及学员补充答案
  const [aiFollowUpQuestions, setAiFollowUpQuestions] = useState<string[] | null>(null);
  const [aiFollowUpAnswers, setAiFollowUpAnswers] = useState<Record<number, string>>({});
  // P2 改前改后对照：AI 生成前的原始描述
  const [aiGeneratedOriginal, setAiGeneratedOriginal] = useState<typeof aiGenerateForm | null>(null);
  const [wizardScoringRules, setWizardScoringRules] = useState<ScoringRule[]>([
    { name: "需求识别", score: 25, criteria: "准确识别客户核心诉求", deductionRule: "", evidenceRequired: "" },
    { name: "合规表达", score: 25, criteria: "按业务规范说明边界", deductionRule: "", evidenceRequired: "" },
    { name: "情绪处理", score: 20, criteria: "稳定沟通氛围并体现同理心", deductionRule: "", evidenceRequired: "" },
    { name: "闭环推进", score: 30, criteria: "明确下一步动作和反馈时限", deductionRule: "", evidenceRequired: "" },
  ]);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [taskWizardStep, setTaskWizardStep] = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [showIndustryCreate, setShowIndustryCreate] = useState(false);
  const [showOrgCreate, setShowOrgCreate] = useState(false);
  const [showUserCreate, setShowUserCreate] = useState(false);
  const [showMaterialCreate, setShowMaterialCreate] = useState(false);
  const [showRecordCreate, setShowRecordCreate] = useState(false);
  const [taskFilter, setTaskFilter] = useState({ status: "all", type: "all", keyword: "" });
  const [showTaskManageSceneModal, setShowTaskManageSceneModal] = useState(false);
  const [taskManageSceneData, setTaskManageSceneData] = useState<{ task: Task; scenes: TaskScene[] } | null>(null);
  const [showTaskDataModal, setShowTaskDataModal] = useState(false);
  const [taskDataDetail, setTaskDataDetail] = useState<TaskDetail | null>(null);
  const [taskToast, setTaskToast] = useState("");
  const taskToastTimer = useRef<number | null>(null);
  const showTaskToast = (msg: string) => {
    setTaskToast(msg);
    if (taskToastTimer.current) window.clearTimeout(taskToastTimer.current);
    taskToastTimer.current = window.setTimeout(() => setTaskToast(""), 2400);
  };
  const [openNavGroups, setOpenNavGroups] = useState<Record<string, boolean>>({ statistics: false, sys: false });

  // ====== 考试模块状态 ======
  const [examBanks, setExamBanks] = useState<ExamBank[]>([]);
  const [selectedBank, setSelectedBank] = useState<ExamBankDetail | null>(null);
  const [examBankForm, setExamBankForm] = useState(initialBankForm);
  const [examQuestionForm, setExamQuestionForm] = useState(initialExamQuestionForm);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamDetail | null>(null);
  const [examForm, setExamForm] = useState(initialExamForm);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [showBankCreate, setShowBankCreate] = useState(false);
  const [showQuestionCreate, setShowQuestionCreate] = useState(false);
  const [showExamCreate, setShowExamCreate] = useState(false);
  const [questionFilterBankId, setQuestionFilterBankId] = useState("");
  // 学员端答题状态
  const [activeExamTaking, setActiveExamTaking] = useState<ExamDetail | null>(null);
  const [takeAnswers, setTakeAnswers] = useState<Record<string, string>>({});
  const [takeStartedAt, setTakeStartedAt] = useState<string>("");
  const [takeRemainingSeconds, setTakeRemainingSeconds] = useState(0);
  const [submittedAttempt, setSubmittedAttempt] = useState<ExamAttempt | null>(null);
  const [currentAttemptId, setCurrentAttemptId] = useState("");
  const [viewingExamResult, setViewingExamResult] = useState<ExamAttempt | null>(null);
  const [viewExamBankId, setViewExamBankId] = useState("");
  const [examFormQuestions, setExamFormQuestions] = useState<ExamQuestion[]>([]);

  // 菜单点击：切换区块并同步 URL（?section=xxx），保证从其他页面跳转/刷新可恢复
  function handleNavClick(key: string) {
    if (!VALID_SECTIONS.has(key)) return;
    setActiveSection(key as ActiveSection);
    const url = new URL(window.location.href);
    if (key === "overview") {
      url.searchParams.delete("section");
    } else {
      url.searchParams.set("section", key);
    }
    window.history.replaceState({}, "", url.toString());
  }

  async function loadData() {
    if (!getStoredAuthToken()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [overviewData, tenantData, industryData, sceneData, materialData, orgData, taskData, userData, recordData, appealData, providerData, examBankData, examData, attemptData] = await Promise.all([
        apiFetch<DashboardOverview>("/dashboard/overview"),
        apiFetch<TenantSettings>("/tenant/current"),
        apiFetch<PageResult<IndustryPackage>>("/industry-packages?pageSize=20"),
        apiFetch<PageResult<Scene>>("/scenes?pageSize=30"),
        apiFetch<PageResult<Material>>("/materials?pageSize=30"),
        apiFetch<PageResult<Organization>>("/organizations?pageSize=100"),
        apiFetch<PageResult<Task>>("/tasks?pageSize=20"),
        apiFetch<PageResult<User>>("/users?pageSize=50"),
        apiFetch<PageResult<TrainingRecord>>("/training-records?pageSize=10"),
        apiFetch<PageResult<Appeal>>("/appeals?pageSize=30"),
        apiFetch<{ items: AiProvider[] }>("/configs/ai-providers"),
        apiFetch<ExamBank[]>("/exam-banks"),
        apiFetch<Exam[]>("/exams"),
        apiFetch<ExamAttempt[]>("/exam-attempts"),
      ]);
      setOverview(overviewData);
      setTenantForm({
        name: tenantData.name,
        planCode: tenantData.planCode,
        expireAt: toDateTimeLocal(tenantData.expireAt),
        resourceQuota: tenantData.resourceQuota,
      });
      setIndustries(industryData.items);
      setScenes(sceneData.items);
      setMaterials(materialData.items);
      setOrganizations(orgData.items);
      setTasks(taskData.items);
      setUsers(userData.items);
      setRecords(recordData.items);
      setAppeals(appealData.items);
      setProviders(providerData.items);
      setExamBanks(examBankData);
      setExams(examData);
      setExamAttempts(attemptData);
      setExamForm((prev) => ({ ...prev, bankId: prev.bankId || examBankData[0]?.id || "" }));
      const firstIndustryId = industryData.items[0]?.id || "";
      setSceneForm((prev) => ({ ...prev, industryPackageId: prev.industryPackageId || firstIndustryId }));
      setMaterialForm((prev) => ({ ...prev, industryPackageId: prev.industryPackageId || firstIndustryId }));
      setOrgForm((prev) => ({ ...prev, parentId: prev.parentId || "" }));
      setUserForm((prev) => ({ ...prev, orgId: prev.orgId || orgData.items[0]?.id || "" }));
      setAiGenerateForm((prev) => ({ ...prev, industryPackageId: prev.industryPackageId || firstIndustryId }));
      setAppealForm((prev) => ({ ...prev, bizId: prev.bizId || recordData.items[0]?.id || "" }));
      setRecordForm((prev) => ({
        ...prev,
        taskId: prev.taskId || taskData.items[0]?.id || "",
        sceneId: prev.sceneId || sceneData.items[0]?.id || "",
        userId: prev.userId || userData.items.find((user) => user.roleCode === "learner")?.id || "",
      }));
      const defaultProvider = providerData.items[0];
      if (defaultProvider) {
        setAiForm({
          providerType: defaultProvider.providerType,
          providerName: defaultProvider.providerName,
          modelName: defaultProvider.modelName,
          baseUrl: defaultProvider.baseUrl,
          apiKey: "",
          status: defaultProvider.status === "enabled" ? "enabled" : "disabled",
        });
      }
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "加载失败";
      if (nextError.includes("登录") || nextError.includes("过期")) {
        clearStoredAuthSession();
        setAuth(null);
      }
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const payload = (await response.json()) as ApiResponse<AuthSession>;
      if (!payload.success) throw new Error(payload.message || payload.code);
      storeAuthSession(payload.data);
      setAuth(payload.data);
      setMessage(`欢迎回来，${payload.data.user.name}`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendCode() {
    const mobile = loginForm.mobile.trim();
    if (!mobile) { setError("请输入手机号后再获取验证码。"); return; }
    setError("");
    try {
      const response = await fetch(`${API_BASE}/auth/send-code`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const payload = (await response.json()) as ApiResponse<{ expiresIn: number }>;
      if (!payload.success) throw new Error(payload.message || "发送失败");
      setMessage(`验证码已发送至 ${mobile}（本地环境验证码 666666）`);
      setCodeCountdown(60);
      const timer = window.setInterval(() => {
        setCodeCountdown((prev) => {
          if (prev <= 1) { window.clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败");
    }
  }

  async function handleLogout() {
    setSubmitting(true);
    try {
      await apiFetch<{ revoked: number }>("/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // 即使服务端会话已过期，本地也要退出。
    } finally {
      clearStoredAuthSession();
      setAuth(null);
      setMessage("");
      setError("");
      setLoading(false);
      setSubmitting(false);
    }
  }
  async function submitAction(successMessage: string, action: () => Promise<void>) {
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      await action();
      setMessage(successMessage);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshSelectedBank(bankId: string) {
    try {
      const detail = await apiFetch<ExamBankDetail>(`/exam-banks?bankId=${bankId}`);
      setSelectedBank(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载题库失败");
    }
  }

  async function refreshSelectedExam(examId: string) {
    try {
      const detail = await apiFetch<ExamDetail>(`/exams?id=${examId}`);
      setSelectedExam(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载考试失败");
    }
  }

  function questionTypeLabel(type: string) {
    return type === "single" ? "单选" : type === "multi" ? "多选" : "判断";
  }

  async function createBankAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!examBankForm.name.trim()) { setError("请输入题库名称"); return; }
    await submitAction("题库创建成功。", async () => {
      await apiFetch<ExamBank>("/exam-banks", { method: "POST", body: JSON.stringify(examBankForm) });
      setExamBankForm(initialBankForm);
      setShowBankCreate(false);
    });
  }

  async function createQuestionAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = examQuestionForm;
    if (!q.stem.trim()) { setError("请输入题干"); return; }
    if (!q.answer.trim()) { setError("请设置正确答案"); return; }
    const body = { ...q, options: q.options.filter((o) => o.trim()) };
    await submitAction("题目添加成功。", async () => {
      await apiFetch<ExamQuestion>("/exam-questions", { method: "POST", body: JSON.stringify(body) });
      setShowQuestionCreate(false);
      setExamQuestionForm({ ...initialExamQuestionForm, bankId: q.bankId });
      if (selectedBank) refreshSelectedBank(selectedBank.id);
    });
  }

  async function deleteExamQuestionAction(questionId: string) {
    await submitAction("题目已删除。", async () => {
      await apiFetch<{ id: string }>(`/exam-questions?id=${questionId}`, { method: "DELETE" });
      if (selectedBank) refreshSelectedBank(selectedBank.id);
    });
  }

  async function publishExamAction(examId: string) {
    await submitAction("考试已发布。", async () => {
      await apiFetch<Exam>(`/exams?id=${examId}`, { method: "PATCH" });
    });
  }

  async function onExamFormBankChange(bankId: string) {
    setExamForm((prev) => ({ ...prev, bankId, questionIds: [] }));
    try {
      if (bankId) {
        const detail = await apiFetch<ExamBankDetail>(`/exam-banks?bankId=${bankId}`);
        setExamFormQuestions(detail.questions);
      } else {
        const all = await apiFetch<ExamQuestion[]>(`/exam-questions`);
        setExamFormQuestions(all);
      }
    } catch (err) {
      setExamFormQuestions([]);
      setError(err instanceof Error ? err.message : "加载题目失败");
    }
  }

  async function createExamAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!examForm.name.trim()) { setError("请输入考试名称"); return; }
    await submitAction("考试创建成功。", async () => {
      const body = { name: examForm.name, code: examForm.code, bankId: examForm.bankId || null, description: examForm.description, durationMinutes: examForm.durationMinutes, passScore: examForm.passScore };
      await apiFetch<Exam>("/exams", { method: "POST", body: JSON.stringify(body) });
      setShowExamCreate(false);
      setExamForm(initialExamForm);
    });
  }

  // ====== 学员端答题函数 ======
  function startExamTaking(exam: ExamDetail) {
    setActiveExamTaking(exam);
    setTakeAnswers({});
    setSubmittedAttempt(null);
    setTakeRemainingSeconds(exam.durationMinutes * 60);
    setTakeStartedAt(new Date().toISOString());
  }

  function exitExamTaking() {
    setActiveExamTaking(null);
    setTakeAnswers({});
    setSubmittedAttempt(null);
    setCurrentAttemptId("");
  }

  async function submitExamTaking() {
    if (!activeExamTaking) return;
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const answers = activeExamTaking.questions.map((question) => ({
        questionId: question.id,
        answer: takeAnswers[question.id] || "",
      }));
      const attempt = await apiFetch<ExamAttempt>(`/exam-attempts?id=${currentAttemptId}`, {
        method: "PUT",
        body: JSON.stringify({ answers }),
      });
      setSubmittedAttempt(attempt);
      await loadData();
      setMessage("考试已提交，得分已记录。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function createExamAttemptAndStart(exam: Exam) {
    setSubmitting(true);
    setError("");
    try {
      const attempt = await apiFetch<ExamAttempt>("/exam-attempts", {
        method: "POST",
        body: JSON.stringify({ examId: exam.id }),
      });
      setCurrentAttemptId(attempt.id);
      const detail = await apiFetch<ExamDetail>(`/exams?id=${exam.id}`);
      startExamTaking(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "开始考试失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function resumeExamAttempt(examId: string) {
    try {
      const detail = await apiFetch<ExamDetail>(`/exams?id=${examId}`);
      startExamTaking(detail);
      setMessage("已恢复进行中的考试，请继续作答。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "恢复考试失败");
    }
  }

  async function handleCreateIndustry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction("行业包已创建，后续可继续沉淀场景模板。", async () => {
      await apiFetch<IndustryPackage>("/industry-packages", {
        method: "POST",
        body: JSON.stringify({ ...industryForm, code: industryForm.code || makeCode("IND") }),
      });
      setIndustryForm(initialIndustryForm);
    });
  }

  async function handleCreateScene(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction("场景已创建为草稿，可发布后加入任务。", async () => {
      await apiFetch<Scene>("/scenes", {
        method: "POST",
        body: JSON.stringify({ ...sceneForm, code: sceneForm.code || makeCode("CJ") }),
      });
      setSceneForm((prev) => ({ ...initialSceneForm, industryPackageId: prev.industryPackageId }));
    });
  }


  async function handleSceneAttachmentsSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setSceneAttachmentsUploading(true);
    // 附件归属知识库：用第一个文件夹
    let folderId = "";
    try {
      const data = await apiFetch<{ items: Array<{ id: string; name: string }> }>("/knowledge?pageSize=1");
      folderId = data.items?.[0]?.id || "";
    } catch {
      folderId = "";
    }
    if (!folderId) {
      setError("知识库暂无文件夹，请先在企业知识库中创建文件夹。");
      setSceneAttachmentsUploading(false);
      return;
    }
    for (const file of files) {
      const entry = { name: file.name, status: "uploading" as const };
      setSceneAttachments((prev) => [...prev, entry]);
      try {
        const formData = new FormData();
        formData.append("folderId", folderId);
        formData.append("file", file);
        await apiFetch<{ parseStatus: string }>("/knowledge/files", { method: "POST", body: formData });
        setSceneAttachments((prev) => prev.map((item) => item.name === file.name ? { ...item, status: "done" as const } : item));
      } catch (err) {
        setSceneAttachments((prev) => prev.map((item) => item.name === file.name ? { ...item, status: "failed" as const, error: err instanceof Error ? err.message : "上传失败" } : item));
      }
    }
    setSceneAttachmentsUploading(false);
  }

  function removeSceneAttachment(name: string) {
    setSceneAttachments((prev) => prev.filter((item) => item.name !== name));
  }

  async function openSceneKbPicker() {
    setError("");
    setSelectedKbFileIds([]);
    setSceneKbFolderId("");
    setSceneKbFiles([]);
    setShowSceneKbPicker(true);
    try {
      const data = await apiFetch<{ items: Array<{ id: string; name: string }> }>("/knowledge?pageSize=100");
      setSceneKbFolders(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载知识库失败");
    }
  }

  async function loadSceneKbFiles(folderId: string) {
    setSceneKbFolderId(folderId);
    setSceneKbFiles([]);
    try {
      const data = await apiFetch<Array<{ id: string; name: string; parseStatus: string }>>(`/knowledge/files?folderId=${encodeURIComponent(folderId)}`);
      setSceneKbFiles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载知识库文件失败");
    }
  }

  function toggleKbFileSelection(fileId: string) {
    setSelectedKbFileIds((prev) => prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]);
  }

  function confirmAddKbFiles() {
    if (!sceneKbFiles.length) return;
    const selected = sceneKbFiles.filter((f) => selectedKbFileIds.includes(f.id));
    setSceneAttachments((prev) => {
      const existing = new Set(prev.map((item) => item.name));
      const additions = selected
        .filter((f) => !existing.has(f.name))
        .map((f) => ({ name: f.name, fileId: f.id, status: "done" as const }));
      return [...prev, ...additions];
    });
    setShowSceneKbPicker(false);
  }

  async function handleAiGenerateAndNext() {
    setSubmitting(true);
    setError("");
    try {
      const result = await apiFetch<{ scene: Scene | null; draft: { name: string; sceneType: string; description: string; aiRole: { identity: string; background: string; personality: string; emotion: string; goal: string }; learnerRole: { identity: string; goal: string }; endCondition: string; interruptCondition: string; scoringRules: ScoringRuleDraft[]; followUpQuestions?: string[] } }> ("/ai/scenes/generate", {
        method: "POST",
        body: JSON.stringify({
          ...aiGenerateForm,
          attachmentFileIds: sceneAttachments.filter((a) => a.fileId && a.status === "done").map((a) => a.fileId) || [],
        }),
      });
      const draft = result.draft;
      setAiGenerateDraft(draft);
      // 主动追问模式：描述信息不足，AI 返回追问问题，停留在第1步等待补充
      if (draft.followUpQuestions?.length) {
        setAiFollowUpQuestions(draft.followUpQuestions);
        setAiFollowUpAnswers({});
        setSceneWizardStep(1);
        setMessage("");
        return;
      }
      // 正常生成：记录原始描述（改前改后对照），进入第2步
      setAiFollowUpQuestions(null);
      setAiGeneratedOriginal({ ...aiGenerateForm });
      // Fill wizard role form from AI draft
      setWizardRoleForm({
        aiIdentity: draft.aiRole?.identity || "",
        aiBackground: draft.aiRole?.background || "",
        aiPersonality: draft.aiRole?.personality || "",
        aiEmotion: draft.aiRole?.emotion || "calm",
        aiStyle: "",
        learnerIdentity: draft.learnerRole?.identity || "",
        dialogueGoal: draft.learnerRole?.goal || "",
        initiator: "ai",
        endCondition: draft.endCondition || "",
        interruptCondition: draft.interruptCondition || "",
        dialogueExample: "",
        sceneDescription: draft.description || "",
      });
      // Fill scoring rules from AI draft
      if (draft.scoringRules?.length) {
        setWizardScoringRules(draft.scoringRules.map((r) => ({
          name: r.name,
          score: r.score,
          criteria: r.criteria,
          deductionRule: r.deductionRule || "",
          evidenceRequired: r.evidenceRequired || "",
        })));
      }
      // 对齐原型：生成成功后关闭弹窗，进入独立表单页继续完善配置
      setShowSceneWizard(false);
      if (result.scene?.id) {
        navigateTo(`/scenes/${result.scene.id}/edit`);
      } else {
        const industryId = aiGenerateForm.industryPackageId || industries[0]?.id || "";
        const created = await apiFetch<Scene>("/scenes", {
          method: "POST",
          body: JSON.stringify({
            industryPackageId: industryId,
            name: aiGenerateForm.sceneDescription.slice(0, 30) || "新场景",
            code: makeCode("CJ"),
            mode: aiGenerateForm.mode,
            createMode: aiGenerateForm.createMode || "ai_practice",
            sceneType: "对话",
            description: aiGenerateForm.sceneDescription,
            aiRole: {
              identity: draft.aiRole?.identity || "",
              background: draft.aiRole?.background || "",
              personality: draft.aiRole?.personality || "",
              emotion: draft.aiRole?.emotion || "calm",
              languageStyle: "",
              goal: draft.learnerRole?.goal || "",
            },
            learnerRole: { identity: draft.learnerRole?.identity || "", goal: draft.learnerRole?.goal || "" },
            endCondition: draft.endCondition || "",
            interruptCondition: draft.interruptCondition || "",
            initiator: "ai",
            scoringRules: (draft.scoringRules || []).map((r) => ({
              name: r.name,
              score: r.score,
              criteria: r.criteria,
              deductionRule: r.deductionRule || "",
              evidenceRequired: r.evidenceRequired || "",
            })),
          }),
        });
        navigateTo(`/scenes/${created.id}/edit`);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setError(raw.includes("at least 10 character") ? "场景描述至少需要 10 个字，请补充完整后再提交。" : (raw || "AI 生成场景失败，请检查模型配置。"));
    } finally {
      setSubmitting(false);
    }
  }

  // 补充追问答案后重新生成
  async function handleAiRegenerateWithAnswers() {
    const answers = Object.values(aiFollowUpAnswers).filter((a) => (a || "").trim()).join("；");
    if (!answers) {
      setError("请至少回答一个问题后再试。");
      return;
    }
    const supplemented = `${aiGenerateForm.sceneDescription}\n【补充信息】${answers}`;
    setAiGenerateForm((prev) => ({ ...prev, sceneDescription: supplemented }));
    await handleAiGenerateAndNext();
  }

  async function handleGenerateScene(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleAiGenerateAndNext();
  }

  async function handleCreateMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction("资料话术已保存，可用于场景设计和后续 AI 生成。", async () => {
      await apiFetch<Material>("/materials", {
        method: "POST",
        body: JSON.stringify({
          ...materialForm,
          industryPackageId: materialForm.industryPackageId || null,
          sceneId: materialForm.sceneId || null,
          tags: materialForm.tags.split(/[，,\s]+/).map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      setMaterialForm((prev) => ({ ...initialMaterialForm, industryPackageId: prev.industryPackageId }));
    });
  }

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction("组织已创建，可用于人员归属和后续按组织发放任务。", async () => {
      await apiFetch<Organization>("/organizations", {
        method: "POST",
        body: JSON.stringify({ ...orgForm, code: orgForm.code || makeCode("ORG"), parentId: orgForm.parentId || null }),
      });
      setOrgForm(initialOrgForm);
    });
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction("学员已创建，可用于任务发布对象。", async () => {
      await apiFetch<User>("/users", {
        method: "POST",
        body: JSON.stringify({ ...userForm, orgId: userForm.orgId || null }),
      });
      setUserForm((prev) => ({ ...initialUserForm, orgId: prev.orgId }));
    });
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction(taskForm.publishNow ? "任务已创建并发布。" : "任务已创建为草稿。", async () => {
      const task = await apiFetch<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          name: taskForm.name,
          code: taskForm.code || makeCode("RW"),
          type: taskForm.type,
          sceneIds: taskForm.sceneIds,
          participantUserIds: taskForm.participantUserIds,
          participantOrgIds: taskForm.participantOrgIds,
          startAt: toIso(taskForm.startAt),
          endAt: toIso(taskForm.endAt),
          answerForm: taskForm.answerForm,
        }),
      });
      if (taskForm.publishNow) {
        await apiFetch(`/tasks/${task.id}/publish`, { method: "POST", body: JSON.stringify({}) });
      }
      setTaskForm(initialTaskForm);
      setTaskWizardStep(1);
      setShowTaskCreate(false);
    });
  }

  async function handleSaveAiProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction("模型配置已保存。后续 AI 创建场景将调用真实接口。", async () => {
      await apiFetch("/configs/ai-providers", {
        method: "POST",
        body: JSON.stringify({ ...aiForm, isDefault: true }),
      });
      setAiForm((prev) => ({ ...prev, apiKey: "" }));
    });
  }

  async function saveTenantSettingsAction() {
    await submitAction("租户套餐和资源额度已保存。", async () => {
      await apiFetch<TenantSettings>("/tenant/current", {
        method: "PUT",
        body: JSON.stringify({
          name: tenantForm.name,
          planCode: tenantForm.planCode,
          expireAt: tenantForm.expireAt ? new Date(tenantForm.expireAt).toISOString() : null,
          resourceQuota: tenantForm.resourceQuota,
        }),
      });
    });
  }

  async function handleSaveTenantSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveTenantSettingsAction();
  }

  // viewSceneDetail / updateScoringRuleForm / addScoringRuleForm / removeScoringRuleForm / saveScoringRules removed
  // → scene detail now lives at /scenes/[id] independent page
  async function disableScene(sceneId: string) {
    await submitAction("场景已停用。", async () => {
      await apiFetch(`/scenes/${sceneId}`, { method: "PATCH", body: JSON.stringify({}) });
    });
  }

  async function publishScene(sceneId: string) {
    await submitAction("场景已发布。", async () => {
      await apiFetch(`/scenes/${sceneId}/publish`, { method: "POST", body: JSON.stringify({}) });
    });
  }

  async function confirmDeleteScene() {
    if (!sceneToDelete) return;
    const target = sceneToDelete;
    setSceneToDelete(null);
    await submitAction("场景已删除。", async () => {
      await apiFetch(`/scenes/${target.id}`, { method: "DELETE", body: JSON.stringify({}) });
      setSelectedSceneIds((prev) => prev.filter((id) => id !== target.id));
    });
  }

  async function confirmBatchDeleteScenes() {
    const ids = selectedSceneIds;
    setShowBatchDeleteConfirm(false);
    if (!ids.length) return;
    await submitAction(`已删除 ${ids.length} 个场景。`, async () => {
      await apiFetch<{ deleted: number }>("/scenes/batch", { method: "DELETE", body: JSON.stringify({ ids }) });
      setSelectedSceneIds([]);
      setBatchMode(false);
      setScenePage(1);
    });
  }

  function toggleSceneSelection(sceneId: string) {
    setSelectedSceneIds((prev) => prev.includes(sceneId) ? prev.filter((id) => id !== sceneId) : [...prev, sceneId]);
  }

  // ===== 场景列表：过滤 + 每页 10 条客户端分页（对齐原型） =====
  const SCENE_PAGE_SIZE = 10;
  const sceneCreateModes = ["ai_practice", "ai_exam", "fixed_practice", "fixed_exam"];
  const filteredScenes = scenes.filter((scene) => {
    if (sceneFilter.status !== "all" && scene.status !== sceneFilter.status) return false;
    if (sceneFilter.mode !== "all") {
      if (sceneCreateModes.includes(sceneFilter.mode)) {
        if ((scene.createMode || "ai_practice") !== sceneFilter.mode) return false;
      } else if (scene.mode !== sceneFilter.mode) {
        return false;
      }
    }
    if (sceneFilter.org !== "all") {
      const org = organizations.find((o) => o.id === sceneFilter.org);
      if (org && scene.creatorOrgName !== org.name) return false;
    }
    if (sceneFilter.keyword && !`${scene.name} ${scene.code}`.toLowerCase().includes(sceneFilter.keyword.toLowerCase())) return false;
    return true;
  });
  const totalScenePages = Math.max(1, Math.ceil(filteredScenes.length / SCENE_PAGE_SIZE));
  const safeScenePage = Math.min(scenePage, totalScenePages);
  const scenePageItems = filteredScenes.slice((safeScenePage - 1) * SCENE_PAGE_SIZE, safeScenePage * SCENE_PAGE_SIZE);
  const currentPageIds = scenePageItems.map((s) => s.id);
  const allCurrentPageChecked = currentPageIds.length > 0 && currentPageIds.every((id) => selectedSceneIds.includes(id));
  function toggleAllCurrentPage(checked: boolean) {
    setSelectedSceneIds((prev) => {
      const next = prev.filter((id) => !currentPageIds.includes(id));
      return checked ? [...next, ...currentPageIds] : next;
    });
  }
  function toggleBatchMode() {
    if (batchMode && selectedSceneIds.length > 0) {
      setShowBatchDeleteConfirm(true);
      return;
    }
    if (batchMode) {
      setSelectedSceneIds([]);
      setBatchMode(false);
      return;
    }
    setBatchMode(true);
  }

  async function publishTask(taskId: string) {
    await submitAction("任务已发布。", async () => {
      await apiFetch(`/tasks/${taskId}/publish`, { method: "POST", body: JSON.stringify({}) });
      await viewTaskDetail(taskId);
    });
  }

  async function openTaskManageSceneModal(taskId: string) {
    setError("");
    try {
      const detail = await apiFetch<TaskDetail>(`/tasks/${taskId}`);
      setTaskManageSceneData({ task: detail.task, scenes: detail.scenes });
      setShowTaskManageSceneModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载场景失败");
    }
  }

  async function openTaskDataModal(taskId: string) {
    setError("");
    try {
      const detail = await apiFetch<TaskDetail>(`/tasks/${taskId}`);
      setTaskDataDetail(detail);
      setShowTaskDataModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载任务数据失败");
    }
  }

  async function stopTask(taskId: string) {
    await submitAction("任务已停用。", async () => {
      await apiFetch(`/tasks/${taskId}/stop`, { method: "POST", body: JSON.stringify({}) });
      await loadData();
    });
  }

  function duplicateTask(task: Task) {
    showTaskToast(`已创建任务副本「${task.name}」，可在待发布任务中编辑`);
  }

  function extendTask(task: Task) {
    showTaskToast(`已延长「${task.name}」的截止时间，任务恢复进行中`);
  }

  async function viewTaskDetail(taskId: string) {
    setError("");
    try {
      const detail = await apiFetch<TaskDetail>(`/tasks/${taskId}`);
      setSelectedTaskDetail(detail);
      setSelectedTaskSceneId(detail.scenes[0]?.id ?? null);
      handleNavClick("task-detail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载任务详情失败");
    }
  }

  function startPracticeFromTaskScene(task: Task, taskScene: TaskScene | null | undefined) {
    if (!taskScene?.sceneId) {
      setError("当前任务未绑定可对练场景，请先在任务中配置场景。");
      return;
    }
    const params = new URLSearchParams({
      sceneId: taskScene.sceneId,
      taskId: task.id,
    });
    navigateTo(`/practice?${params.toString()}`);
  }

  async function viewRecordDetail(recordId: string) {
    setError("");
    try {
      const detail = await apiFetch<TrainingRecordDetail>(`/training-records/${recordId}`);
      setSelectedRecordDetail(detail);
      setAppealForm((prev) => ({ ...prev, bizId: recordId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载训练记录详情失败");
    }
  }

  async function handleCreateTrainingRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction("训练记录已录入，复盘数据已刷新。", async () => {
      const detail = await apiFetch<TrainingRecordDetail>("/training-records", {
        method: "POST",
        body: JSON.stringify({
          taskId: recordForm.taskId || null,
          sceneId: recordForm.sceneId,
          userId: recordForm.userId || null,
          mode: recordForm.mode,
          status: "completed",
          score: recordForm.score,
          startedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
          finishedAt: new Date().toISOString(),
          turns: [
            { speaker: "ai", text: recordForm.aiText, durationMs: 8000 },
            { speaker: "learner", text: recordForm.learnerText, durationMs: 12000 },
          ],
          scores: [
            { score: recordForm.score, deductionReason: recordForm.deductionReason, evidenceText: recordForm.evidenceText },
          ],
        }),
      });
      setSelectedRecordDetail(detail);
      setAppealForm((prev) => ({ ...prev, bizId: detail.record.id }));
    });
  }

  async function handleCreateAppeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction("复核申诉已提交，待管理员处理。", async () => {
      await apiFetch<Appeal>("/appeals", {
        method: "POST",
        body: JSON.stringify({ bizType: "training_record", bizId: appealForm.bizId, reason: appealForm.reason }),
      });
      setAppealForm((prev) => ({ ...initialAppealForm, bizId: prev.bizId }));
      handleNavClick("appeals");
    });
  }

  async function handleWizardSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const industryId = aiGenerateForm.industryPackageId || industries[0]?.id || "";
      if (aiGenerateDraft) {
        // Scene already created by AI generate API, just close wizard
        setMessage("AI 生成场景已保存为草稿。");
      } else {
        // Manual create path
        await apiFetch<Scene>("/scenes", {
          method: "POST",
          body: JSON.stringify({
            industryPackageId: industryId,
            name: aiGenerateForm.sceneDescription.slice(0, 30) || "新场景",
            code: makeCode("CJ"),
            mode: aiGenerateForm.mode,
            createMode: aiGenerateForm.createMode || "fixed_practice",
            sceneType: wizardRoleForm.aiIdentity ? "对话" : "常规对话",
            description: aiGenerateForm.sceneDescription,
            aiRole: {
              identity: wizardRoleForm.aiIdentity,
              background: wizardRoleForm.aiBackground,
              personality: wizardRoleForm.aiPersonality,
              emotion: wizardRoleForm.aiEmotion,
              languageStyle: wizardRoleForm.aiStyle,
              goal: wizardRoleForm.dialogueGoal,
            },
            learnerRole: {
              identity: wizardRoleForm.learnerIdentity,
              goal: wizardRoleForm.dialogueGoal,
            },
            endCondition: wizardRoleForm.endCondition,
            interruptCondition: wizardRoleForm.interruptCondition,
            dialogueExample: wizardRoleForm.dialogueExample,
            initiator: wizardRoleForm.initiator,
            scoringRules: wizardScoringRules.map((r) => ({
              name: r.name,
              score: r.score,
              criteria: r.criteria,
              deductionRule: r.deductionRule,
              evidenceRequired: r.evidenceRequired,
            })),
          }),
        });
        setMessage("场景已创建为草稿。");
      }
      setShowSceneWizard(false);
      setSceneWizardStep(1);
      setAiGenerateDraft(null);
      setWizardRoleForm({ aiIdentity: "", aiBackground: "", aiPersonality: "", aiEmotion: "", aiStyle: "", learnerIdentity: "", dialogueGoal: "", initiator: "ai", endCondition: "", interruptCondition: "", dialogueExample: "", sceneDescription: "" });
      setWizardScoringRules([
        { name: "需求识别", score: 25, criteria: "准确识别客户核心诉求", deductionRule: "", evidenceRequired: "" },
        { name: "合规表达", score: 25, criteria: "按业务规范说明边界", deductionRule: "", evidenceRequired: "" },
        { name: "情绪处理", score: 20, criteria: "稳定沟通氛围并体现同理心", deductionRule: "", evidenceRequired: "" },
        { name: "闭环推进", score: 30, criteria: "明确下一步动作和反馈时限", deductionRule: "", evidenceRequired: "" },
      ]);
      setAiGenerateForm({ ...initialAiGenerateForm, industryPackageId: industryId });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建场景失败");
    } finally {
      setSubmitting(false);
    }
  }

  function addWizardScoringRule() {
    setWizardScoringRules((prev) => [...prev, { name: "新评分项", score: 0, criteria: "", deductionRule: "", evidenceRequired: "" }]);
  }

  function removeWizardScoringRule(index: number) {
    setWizardScoringRules((prev) => prev.filter((_, i) => i !== index));
  }

  function updateWizardScoringRule(index: number, patch: Partial<ScoringRule>) {
    setWizardScoringRules((prev) => prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  async function handleAppealStatus(appealId: string, status: "approved" | "rejected") {
    const handlerId = users.find((user) => user.roleCode === "tenant_admin")?.id || users[0]?.id || null;
    await submitAction(status === "approved" ? "申诉已通过。" : "申诉已驳回。", async () => {
      await apiFetch<Appeal>(`/appeals/${appealId}`, {
        method: "PUT",
        body: JSON.stringify({ status, handlerId }),
      });
    });
  }
  function toggleTaskScene(sceneId: string) {
    setTaskForm((prev) => ({
      ...prev,
      sceneIds: prev.sceneIds.includes(sceneId) ? prev.sceneIds.filter((id) => id !== sceneId) : [...prev.sceneIds, sceneId],
    }));
  }

  function toggleTaskParticipant(userId: string) {
    setTaskForm((prev) => ({
      ...prev,
      participantUserIds: prev.participantUserIds.includes(userId) ? prev.participantUserIds.filter((id) => id !== userId) : [...prev.participantUserIds, userId],
    }));
  }

  function toggleTaskOrg(orgId: string) {
    setTaskForm((prev) => ({
      ...prev,
      participantOrgIds: prev.participantOrgIds.includes(orgId) ? prev.participantOrgIds.filter((id) => id !== orgId) : [...prev.participantOrgIds, orgId],
    }));
  }

  // 首次加载：从 URL ?section=xxx 恢复目标菜单区块（从其他页面跳转回来时生效）
  useEffect(() => {
    const storedAuth = readStoredAuth();
    if (!storedAuth) return;
    setAuth(storedAuth);
    const sectionParam = new URLSearchParams(window.location.search).get("section");
    if (sectionParam && VALID_SECTIONS.has(sectionParam)) {
      setActiveSection(sectionParam as ActiveSection);
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!auth) {
    return (
      <div className="login-redesign" id="loginPage">
        <div className="login-glow"></div>
        <div className="login-wash wash-one"></div>
        <div className="login-wash wash-two"></div>
        <div className="login-layout">
          <section className="login-intro">
            <div className="login-brand"><i className="mark"></i><strong>智训通</strong><span>企业培训管理平台</span></div>
            <div className="login-kicker">SMART TRAINING · SMART GROWTH</div>
            <h1>让学习创造<br /><span>更大价值</span></h1>
            <p className="login-subtitle">智能场景训练 · 数据驱动成长</p>
            <div className="login-hero-art" aria-hidden="true">
              <div className="hero-orbit orbit-a"></div>
              <div className="hero-orbit orbit-b"></div>
              <div className="hero-orbit orbit-c"></div>
              <div className="hero-glow"></div>
              <div className="hero-platform"><div className="hero-platform-top"></div><div className="hero-platform-side"></div></div>
              <div className="hero-panel"><div className="hero-panel-head"><span className="panel-dot"></span><b>智训通工作台</b><small>LIVE</small></div><div className="hero-panel-body"><div className="hero-bars"><i></i><i></i><i></i><i></i><i></i></div><div className="hero-line"></div><div className="hero-avatar"></div></div></div>
              <div className="hero-cube"><b>智</b><small>TRAIN</small></div>
              <div className="hero-card float-card-one"><i>✓</i><span>训练完成度<br /><b>86%</b></span></div>
              <div className="hero-card float-card-two"><i>↗</i><span>本周成长值<br /><b>+24.8</b></span></div>
              <div className="hero-spark spark-one">✦</div>
              <div className="hero-spark spark-two">✦</div>
              <div className="hero-spark spark-three">·</div>
            </div>
            <div className="login-features">
              <div className="login-feature"><i>▣</i><span><b>弹性学习</b><small>随时随地提升能力</small></span></div>
              <div className="login-feature"><i>✓</i><span><b>安全合规</b><small>企业级数据保障</small></span></div>
              <div className="login-feature"><i>↗</i><span><b>智能调度</b><small>精准连接每一次成长</small></span></div>
            </div>
          </section>
          <section className="login-card">
            <div className="login-card-head">
              <div className="login-card-badge">智训通</div>
              <h2>欢迎登录</h2>
              <p>登录后进入智训通管理工作台</p>
            </div>
            <form id="loginForm" onSubmit={handleLogin}>
              <label className="login-field"><i className="field-icon">♙</i>
                <input value={loginForm.mobile} onChange={(e) => setLoginForm({ ...loginForm, mobile: e.target.value })} type="text" maxLength={32} placeholder="请输入账号 / 手机号" autoComplete="username" required />
              </label>
              <label className="login-field login-password"><i className="field-icon">▣</i>
                <input value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} type={showPassword ? "text" : "password"} maxLength={32} placeholder="请输入密码" autoComplete="current-password" required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="显示密码">◉</button>
              </label>
              <label className="login-field login-code"><i className="field-icon">✉</i>
                <input value={loginForm.code} onChange={(e) => setLoginForm({ ...loginForm, code: e.target.value })} type="text" maxLength={8} placeholder="请输入验证码" required />
                <button type="button" disabled={!!codeCountdown || submitting} onClick={handleSendCode}>{codeCountdown > 0 ? `${codeCountdown}s 后重发` : "获取验证码"}</button>
              </label>
              {error ? <div className="login-tip" role="alert">{error}</div> : null}
              <div className="login-links"><a onClick={(e) => e.preventDefault()}>忘记密码?</a></div>
              <button className="login-submit" type="submit" disabled={submitting}>{submitting ? "登录中..." : "登录"}</button>
              <label className="login-agreement"><input type="checkbox" defaultChecked /><span>阅读并接受 <a>《服务条款》</a> 和 <a>《隐私政策》</a></span></label>
            </form>
          </section>
        </div>
        <div className="login-foot">© 2026 智训通 · 企业培训与人才发展平台</div>
      </div>
    );
  }
  const navItems: NavItem[] = [
    { id: "home", key: "overview", label: "首页", icon: <BarChart3 size={18} /> },
    { id: "student-home", key: "student-home", label: "学员首页", icon: <Users size={18} /> },
    { id: "my-tasks", key: "my-tasks", label: "我的任务", icon: <ClipboardList size={18} />, badge: tasks.filter((task) => task.status !== "completed").length },
    { id: "my-exams", key: "my-exams", label: "我的考试", icon: <FileText size={18} />, badge: 0 },
    { id: "scenes", key: "scenes", label: "场景管理", icon: <Bot size={18} /> },
    { id: "knowledge", key: "knowledge", label: "企业知识库", icon: <Database size={18} /> },
    { id: "tasks", key: "tasks", label: "任务管理", icon: <ClipboardList size={18} /> },
    { id: "appeals", key: "appeals", label: "申诉管理", icon: <AlertCircle size={18} />, badge: appeals.filter((appeal) => appeal.status === "pending").length },
    {
      id: "statistics", key: "statistics", label: "数据统计", icon: <BarChart3 size={18} />, group: "statistics",
      children: [
        { id: "statistics-dept", key: "statistics-dept", label: "部门数据", icon: <Building2 size={16} /> },
        { id: "statistics-learner", key: "statistics-learner", label: "学员统计", icon: <Users size={16} /> },
      ],
    },
    { id: "materials", key: "materials", label: "素材管理", icon: <FileText size={18} /> },
    { id: "settings", key: "settings", label: "全局配置", icon: <Settings size={18} /> },
    {
      id: "sys", key: "sys", label: "系统管理", icon: <ShieldCheck size={18} />, group: "sys",
      children: [
        { id: "sys-users", key: "sys-users", label: "用户管理", icon: <Users size={16} /> },
        { id: "sys-roles", key: "sys-roles", label: "角色管理", icon: <KeyRound size={16} /> },
        { id: "sys-menus", key: "sys-menus", label: "菜单管理", icon: <Menu size={16} /> },
        { id: "sys-departments", key: "sys-departments", label: "部门管理", icon: <Building2 size={16} /> },
        { id: "sys-posts", key: "sys-posts", label: "岗位管理", icon: <Briefcase size={16} /> },
        { id: "sys-tenants", key: "sys-tenants", label: "租户管理", icon: <Landmark size={16} /> },
      ],
    },
  ];
  const currentNavItem = (() => {
    for (const item of navItems) {
      if (item.key === activeSection) return item;
      if (item.children?.some((c) => c.key === activeSection)) return item;
    }
    return navItems[0];
  })();
  const currentNavLabel = currentNavItem?.label || "首页";
  const currentNavChild = currentNavItem?.children?.find((c) => c.key === activeSection);
  const currentChildLabel = currentNavChild?.label;
  const learnerCount = users.filter((user) => user.roleCode === "learner").length;
  const publishedExams = exams.filter((exam) => exam.status === "published");
  const publishedTaskCount = tasks.filter((task) => task.status === "published").length;
  const pendingAppealCount = appeals.filter((appeal) => appeal.status === "pending").length;
  const completedRecordCount = records.filter((record) => record.status === "completed").length;
  const getTaskRuntimeStatus = (task: Task) => {
    if (task.status === "completed") return "completed";
    const endTime = task.endAt ? new Date(task.endAt).getTime() : Number.NaN;
    if (Number.isFinite(endTime) && endTime < Date.now()) return "overdue";
    if (task.status === "published") return "in_progress";
    return task.status;
  };
  const TASK_TYPE_LABELS: Record<string, string> = {
    free_practice: "自由对练",
    fixed_practice: "固定对练",
    free_exam: "自由考试",
    fixed_exam: "固定考试",
    scenario_training: "场景对练",
    mixed: "混合模式",
  };
  const taskTypeLabel = (type: string) => TASK_TYPE_LABELS[type] || type || "任务";
  const myTaskStats = tasks.reduce(
    (stats, task) => {
      const runtimeStatus = getTaskRuntimeStatus(task);
      stats.total += 1;
      if (runtimeStatus === "overdue") stats.overdue += 1;
      if (runtimeStatus === "completed") stats.completed += 1;
      if (runtimeStatus === "in_progress") stats.inProgress += 1;
      return stats;
    },
    { total: 0, overdue: 0, completed: 0, inProgress: 0 },
  );
  const filteredMyTasks = tasks.filter((task) => {
    const runtimeStatus = getTaskRuntimeStatus(task);
    const selectedStatus = taskFilter.status;
    const matchesStatus =
      selectedStatus === "all" ||
      selectedStatus === runtimeStatus ||
      (selectedStatus === "published" && runtimeStatus === "in_progress");
    const keyword = taskFilter.keyword.trim().toLowerCase();
    const matchesKeyword = !keyword || `${task.name} ${task.code || ""}`.toLowerCase().includes(keyword);
    return matchesStatus && matchesKeyword;
  });
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">智</div>
          <div>
            <p className="brand-title">AI 智训通</p>
            <p className="brand-subtitle">行业角色实训平台</p>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => {
            if (item.children && item.group) {
              const open = openNavGroups[item.group];
              const hasActiveChild = item.children.some((c) => c.key === activeSection);
              return (
                <div className={`nav-group ${open || hasActiveChild ? "open" : ""}`} key={item.id}>
                  <button
                    className={`nav-item group-head ${hasActiveChild ? "active" : ""}`}
                    type="button"
                    onClick={() => setOpenNavGroups((prev) => ({ ...prev, [item.group as string]: !prev[item.group as string] }))}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-caret">{open || hasActiveChild ? "⌄" : "›"}</span>
                  </button>
                  {(open || hasActiveChild) && (
                    <div className="nav-sub">
                      {item.children.map((child) => (
                        <button
                          className={`nav-item sub ${child.key === activeSection ? "active" : ""}`}
                          key={child.id}
                          type="button"
                          onClick={() => handleNavClick(child.key)}
                        >
                          <span className="nav-icon">{child.icon}</span>
                          <span className="nav-label">{child.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button className={`nav-item ${activeSection === item.key ? "active" : ""}`} key={item.id} onClick={() => handleNavClick(item.key)} type="button">
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {typeof item.badge === "number" && item.badge > 0 ? <span className="nav-badge">{item.badge}</span> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="content">
        <div className="topbar prototype-topbar">
          <div className="breadcrumb"><strong>工作台</strong><span>/</span><span>{currentNavLabel}</span>{currentChildLabel ? <><span>/</span><span>{currentChildLabel}</span></> : null}</div>
          <div className="top-actions">
            <span className="top-message">◌ 消息通知</span>
            <span className="tenant-selector">{tenantForm.name || overview?.tenantName || "智训通本地验证租户"} ⌄</span>
            <span className="avatar" />
            <button className="user-menu" onClick={handleLogout} disabled={submitting} type="button">
              {auth.user.name}⌄
            </button>
          </div>
        </div>
        {error ? <div className="notice"><AlertCircle size={16} /> {error}</div> : null}
        {message ? <div className="success"><CheckCircle2 size={16} /> {message}</div> : null}

        {(activeSection === "overview" || loading) && (
          <HomeSection auth={auth} submitting={submitting} onRefresh={() => loadData()} />
        )}

        {activeSection === "practice" && (
          <section className="page-section">
            <div style={{ background: "#dcfce7", color: "#166534", padding: "8px 12px", borderRadius: 6, fontSize: 12 }}>
              ✓ practice section 渲染中 · activeSection={String(activeSection)} · scenes={Array.isArray(scenes) ? scenes.length : "undef"} · records={Array.isArray(records) ? records.length : "undef"}
            </div>
            <div className="page-header">
              <div>
                <h1 className="page-title">对练中心</h1>
                <p className="page-desc">选择场景开始 AI 对练，或查看历史训练记录。</p>
              </div>
            </div>
            <div className="home-grid">
              <div className="home-main">
                <div className="card section" style={{ padding: 20 }}>
                  <h3 style={{ margin: "0 0 16px" }}>可对练场景</h3>
                  {(!Array.isArray(scenes) || scenes.length === 0) ? (
                    <div className="empty">暂无可用场景，请先在「场景管理」创建。</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                      {scenes.map((scene) => (
                        <div key={scene.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--panel)" }}>
                          <strong style={{ display: "block", marginBottom: 6 }}>{scene?.name || "(未命名场景)"}</strong>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                            合格线 80
                          </div>
                          <button className="btn primary full" type="button" onClick={() => navigateTo(`/practice?sceneId=${encodeURIComponent(scene.id)}`)}>
                            开始对练 →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <aside className="home-side">
                <div className="card section" style={{ padding: 20 }}>
                  <h3 style={{ margin: "0 0 12px" }}>最近训练</h3>
                  {(!Array.isArray(records) || records.length === 0) ? (
                    <div className="empty">暂无训练记录。</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {records.slice(0, 5).map((r) => (
                        <div key={r.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{r?.sceneName || "—"}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r?.score ?? 0} 分 · {formatDate(r?.finishedAt)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </section>
        )}

        {activeSection === "scenes" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main sc-mod">
                <div className="scene-head card">
                  <div>
                    <h1>场景管理</h1>
                    <p className="muted">管理智能对练场景，快速创建并关联培训任务。</p>
                  </div>
                  <div className="scene-actions">
                    <button className="btn outline" type="button" onClick={toggleBatchMode}>
                      {batchMode ? (selectedSceneIds.length > 0 ? `删除已选(${selectedSceneIds.length})` : "取消") : "批量删除"}
                    </button>
                    <button className="btn" type="button" onClick={() => setShowSceneModePicker(true)}>＋ 添加场景</button>
                  </div>
                </div>

                <div className="scene-filter card">
                  <input className="field" type="text" placeholder="搜索名称 / 编号" value={sceneFilter.keyword || ""} onChange={(e) => { setSceneFilter({ ...sceneFilter, keyword: e.target.value }); setScenePage(1); }} />
                  <select className="field" value={sceneFilter.status} onChange={(e) => { setSceneFilter({ ...sceneFilter, status: e.target.value }); setScenePage(1); }}>
                    <option value="all">状态：全部</option>
                    <option value="enabled">启用</option>
                    <option value="disabled">停用</option>
                  </select>
                  <select className="field" value={sceneFilter.mode} onChange={(e) => { setSceneFilter({ ...sceneFilter, mode: e.target.value }); setScenePage(1); }}>
                    <option value="all">对话模式：全部</option>
                    <option value="ai_practice">AI对练模式</option>
                    <option value="ai_exam">AI对练+考试模式</option>
                    <option value="fixed_practice">固定对练模式</option>
                    <option value="fixed_exam">固定对练+考试模式</option>
                    <option value="voice">语音模式</option>
                    <option value="text">文本模式</option>
                  </select>
                  <select className="field" value={sceneFilter.org} onChange={(e) => { setSceneFilter({ ...sceneFilter, org: e.target.value }); setScenePage(1); }}>
                    <option value="all">创建部门：全部</option>
                    {organizations.map((org) => <option value={org.id} key={org.id}>{org.name}</option>)}
                  </select>
                  <button className="btn" type="button" onClick={() => setScenePage(1)}>查询</button>
                </div>

                <div className={`scene-list card ${batchMode ? "batch-mode" : ""}`}>
                  <div className="table-wrap">
                    <table className="scene-table">
                      <thead>
                        <tr>
                          <th className="batch-col"><input type="checkbox" checked={allCurrentPageChecked} onChange={(e) => toggleAllCurrentPage(e.target.checked)} /></th>
                          <th>序号</th>
                          <th>场景编号</th>
                          <th>场景名称</th>
                          <th>状态</th>
                          <th>关联任务数</th>
                          <th>创建部门</th>
                          <th>创建人</th>
                          <th>创建时间</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scenePageItems.map((scene, idx) => {
                          const statusOn = scene.status === "enabled" || scene.status === "published" || scene.status === "active";
                          const subMode = createModeLabel(scene.createMode) || modeLabel(scene.mode);
                          return (
                            <tr key={scene.id}>
                              <td className="batch-col"><input type="checkbox" checked={selectedSceneIds.includes(scene.id)} onChange={() => toggleSceneSelection(scene.id)} /></td>
                              <td>{(safeScenePage - 1) * SCENE_PAGE_SIZE + idx + 1}</td>
                              <td>{scene.code}</td>
                              <td className="name">{scene.name}<br /><small className="muted">{subMode}</small></td>
                              <td><span className={`status ${statusOn ? "on" : "off"}`}>{statusOn ? "启用" : "停用"}</span></td>
                              <td>{scene.taskCount ?? 0}</td>
                              <td>{scene.creatorOrgName || "—"}</td>
                              <td>{scene.creatorName || "—"}</td>
                              <td>{scene.createdAt ? formatDate(scene.createdAt) : "—"}</td>
                              <td>
                                <div className="table-ops">
                                  <a onClick={() => navigateTo(`/scenes/${scene.id}`)}>预览</a>
                                  <a onClick={() => navigateTo(`/scenes/${scene.id}/edit`)}>编辑</a>
                                  {statusOn ? <a onClick={() => disableScene(scene.id)}>禁用</a> : <a onClick={() => publishScene(scene.id)}>启用</a>}
                                  <a>复制</a>
                                  <a onClick={() => navigateTo(`/practice?sceneId=${scene.id}`)}>创建任务</a>
                                  <a className="del" onClick={() => setSceneToDelete(scene)}>删除</a>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {scenePageItems.length === 0 && (
                          <tr className="empty-row"><td colSpan={10}>暂无符合条件的场景</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagebar">
                    <span>共 {filteredScenes.length} 条记录，第 {safeScenePage}/{totalScenePages} 页</span>
                    <div className="pager">
                      <button type="button" disabled={safeScenePage === 1} onClick={() => setScenePage(safeScenePage - 1)}>‹</button>
                      {Array.from({ length: totalScenePages }, (_, i) => i + 1).map((p) => (
                        <button type="button" key={p} className={p === safeScenePage ? "active" : ""} onClick={() => setScenePage(p)}>{p}</button>
                      ))}
                      <button type="button" disabled={safeScenePage === totalScenePages} onClick={() => setScenePage(safeScenePage + 1)}>›</button>
                    </div>
                  </div>
                </div>



            {showSceneModePicker && (
              <div className="scene-prompt-mask show" onClick={() => setShowSceneModePicker(false)}>
                <div className="scene-prompt" role="dialog" aria-modal="true" aria-labelledby="scenePromptTitle" onClick={(e) => e.stopPropagation()}>
                  <button className="close-prompt" type="button" onClick={() => setShowSceneModePicker(false)} aria-label="关闭">×</button>
                  <div className="prompt-mode-step">
                    <h2>选择场景创建模式</h2>
                    <p className="prompt-mode-desc">请选择一种对话模式，开始配置训练场景</p>
                    <div className="mode-choice-grid">
                      <button type="button" className="mode-choice ai" onClick={() => { setShowSceneModePicker(false); setAiGenerateForm((prev) => ({ ...prev, createMode: "ai_practice" })); setSceneWizardStep(1); setShowSceneWizard(true); }}>
                        <span className="mode-choice-badge">智能生成</span>
                        <span className="mode-choice-icon">✦</span>
                        <h3>AI对练模式</h3>
                        <p>输入场景描述，由 AI 辅助生成角色、对话目标和评分规则，适合开放式沟通训练。</p>
                      </button>
                      <button type="button" className="mode-choice ai exam" onClick={() => { setShowSceneModePicker(false); setAiGenerateForm((prev) => ({ ...prev, createMode: "ai_exam" })); setSceneWizardStep(1); setShowSceneWizard(true); }}>
                        <span className="mode-choice-badge">智能生成</span>
                        <span className="mode-choice-icon">✦</span>
                        <h3>AI对练+考试模式</h3>
                        <p>由 AI 生成对练场景，并结合考试评分要求进行能力评估，适合综合训练与考核。</p>
                      </button>
                      <button type="button" className="mode-choice fixed" onClick={() => { setShowSceneModePicker(false); navigateTo("/scenes/new?mode=fixed_practice"); }}>
                        <span className="mode-choice-icon">▤</span>
                        <h3>固定对练模式</h3>
                        <p>配置预设对话流程和话术节点，适合标准化、流程化的对话训练。</p>
                      </button>
                      <button type="button" className="mode-choice fixed exam" onClick={() => { setShowSceneModePicker(false); navigateTo("/scenes/new?mode=fixed_exam"); }}>
                        <span className="mode-choice-icon">▤</span>
                        <h3>固定对练+考试模式</h3>
                        <p>配置固定对话流程，并结合考试评分要求进行能力评估，适合标准化训练与考核。</p>
                      </button>
                    </div>
                    <div className="prompt-mode-note">创建后仍可在场景配置页继续修改角色、目标和评分规则。</div>
                    <div className="prompt-actions prompt-mode-actions">
                      <button className="btn outline" type="button" onClick={() => setShowSceneModePicker(false)}>取消</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <ConfirmDialog
              open={!!sceneToDelete}
              message={`确定删除场景「${sceneToDelete?.name || ""}」吗？删除后不可恢复，请谨慎操作。`}
              onCancel={() => setSceneToDelete(null)}
              onConfirm={confirmDeleteScene}
            />

            <ConfirmDialog
              open={showBatchDeleteConfirm}
              message={`确定删除选中的 ${selectedSceneIds.length} 个场景吗？删除后不可恢复，请谨慎操作。`}
              onCancel={() => setShowBatchDeleteConfirm(false)}
              onConfirm={confirmBatchDeleteScenes}
            />

            {showSceneWizard && (
              <div className="scene-prompt-mask show ai-flow" onClick={() => setShowSceneWizard(false)}>
                <div className="scene-prompt" role="dialog" aria-modal="true" aria-labelledby="scenePromptTitle" onClick={(e) => e.stopPropagation()}>
                  <button className="close-prompt" type="button" onClick={() => setShowSceneWizard(false)} aria-label="关闭">×</button>
                  <div>
                    <h2 id="scenePromptTitle">你需要创建什么场景？</h2>
                    <div className="prompt-box">
                      <textarea
                        value={aiGenerateForm.sceneDescription}
                        onChange={(e) => setAiGenerateForm({ ...aiGenerateForm, sceneDescription: e.target.value })}
                        minLength={10}
                        maxLength={500}
                        placeholder="请输入场景内容，例如：模拟客户投诉、产品推介或安全生产问答等场景"
                      />
                      <div className="prompt-upload">
                        <div className="prompt-upload-head">
                          <div className="prompt-upload-title">上传附件<span>支持本地文件或企业知识库资料</span></div>
                          <div className="prompt-upload-actions">
                            <label className="prompt-upload-label" onClick={() => sceneAttachmentInputRef.current?.click()}>＋ 本地文件
                              <input ref={sceneAttachmentInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.pptx,.txt,.md" onChange={handleSceneAttachmentsSelected} />
                            </label>
                            <button type="button" className="prompt-knowledge-select" onClick={openSceneKbPicker}>▣ 企业知识库</button>
                          </div>
                        </div>
                        <div className="prompt-attachment-list">
                          {sceneAttachments.map((item) => (
                            <span className={`prompt-attachment ${item.status === "failed" ? "" : ""}`} key={item.name}>
                              📎 {item.name}
                              {item.status === "uploading" && <small> 上传解析中…</small>}
                              {item.status === "done" && <small> 已入库</small>}
                              {item.status === "failed" && <small> 解析失败</small>}
                              <button type="button" onClick={() => removeSceneAttachment(item.name)} aria-label="移除附件">×</button>
                            </span>
                          ))}
                        </div>
                        {sceneAttachments.length === 0 && <div className="prompt-upload-empty">暂未选择附件</div>}
                      </div>
                      <div className="prompt-footer">
                        <span className="prompt-count"><b>{aiGenerateForm.sceneDescription.length}</b>/500</span>
                        {aiGenerateForm.sceneDescription.trim().length > 0 && aiGenerateForm.sceneDescription.trim().length < 10 && (
                          <span style={{ color: "#e5484d", fontWeight: 600, marginLeft: 8 }}>场景描述至少需要 10 个字（当前 {aiGenerateForm.sceneDescription.trim().length} 字）</span>
                        )}
                        <b>◈ 建议</b>　包含人物、场景、痛点、目标和关键沟通要求。<p><b>▣ 示例</b>　一位客户咨询套餐资费，认为线下价格偏高且担心售后。训练学员识别诉求、解释方案并促成办理。</p>
                      </div>
                    </div>
                    {/* P2 主动追问：AI 认为描述信息不足时在此补问 */}
                    {aiFollowUpQuestions && aiFollowUpQuestions.length > 0 && (
                      <div className="ai-followup-card">
                        <div className="ai-followup-title">
                          <Sparkles size={15} />
                          <span>AI 需要补充几个关键信息才能生成更好的场景</span>
                        </div>
                        {aiFollowUpQuestions.map((q, i) => (
                          <div key={i} className="ai-followup-item">
                            <span className="ai-followup-q">{i + 1}. {q}</span>
                            <input
                              value={aiFollowUpAnswers[i] || ""}
                              onChange={(e) => setAiFollowUpAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                              placeholder="在此补充…"
                            />
                          </div>
                        ))}
                        <div className="ai-followup-actions">
                          <button className="btn" type="button" onClick={() => setAiFollowUpQuestions(null)}>跳过，直接生成</button>
                          <button className="btn primary" type="button" disabled={submitting} onClick={handleAiRegenerateWithAnswers}>
                            {submitting ? "生成中…" : "补充后重新生成"}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="prompt-actions">
                      <button className="btn outline" type="button" onClick={() => setShowSceneWizard(false)}>取消</button>
                      <button className="btn" type="button" onClick={handleAiGenerateAndNext} disabled={submitting || !aiGenerateForm.sceneDescription.trim() || aiGenerateForm.sceneDescription.trim().length < 10}>{submitting ? "AI 生成中..." : "提交"}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showSceneKbPicker && (
              <div className="modal-overlay" onClick={() => setShowSceneKbPicker(false)}>
                <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 620 }}>
                  <div className="modal-head">
                    <h2>从企业知识库选择</h2>
                    <button className="link-btn" type="button" onClick={() => setShowSceneKbPicker(false)}>×</button>
                  </div>
                  <p className="section-note" style={{ marginBottom: 12 }}>选择已入库文件作为场景生成依据，可多选。</p>
                  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                    <select className="filter-select" value={sceneKbFolderId} onChange={(e) => loadSceneKbFiles(e.target.value)} style={{ flex: 1 }}>
                      <option value="">请选择知识库文件夹</option>
                      {sceneKbFolders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}
                    </select>
                  </div>
                  <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
                    {!sceneKbFolderId && <div className="empty" style={{ padding: 24 }}>请先选择知识库文件夹。</div>}
                    {sceneKbFolderId && sceneKbFiles.length === 0 && <div className="empty" style={{ padding: 24 }}>该文件夹暂无已入库文件。</div>}
                    {sceneKbFiles.map((file) => (
                      <label key={file.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #f0f2f7", cursor: "pointer", fontSize: 13 }}>
                        <input type="checkbox" checked={selectedKbFileIds.includes(file.id)} onChange={() => toggleKbFileSelection(file.id)} />
                        <Paperclip size={14} style={{ color: "#8b98aa" }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                        {file.parseStatus === "done" ? <span style={{ color: "#22c55e", fontSize: 12 }}>已解析</span> : <span style={{ color: "#b08a00", fontSize: 12 }}>解析中</span>}
                      </label>
                    ))}
                  </div>
                  <div className="modal-actions">
                    <button className="btn" type="button" onClick={() => setShowSceneKbPicker(false)}>取消</button>
                    <button className="btn primary" type="button" disabled={selectedKbFileIds.length === 0} onClick={confirmAddKbFiles}>添加所选（{selectedKbFileIds.length}）</button>
                  </div>
                </div>
              </div>
            )}
              </div>
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}

        {activeSection === "materials" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
            <div className="page-header">
              <div>
                <h1 className="page-title">素材管理</h1>
                <p className="page-desc">沉淀客服投诉、套餐资费、网络故障等话术资料，后续作为 AI 生成场景和评分依据。</p>
              </div>
              <div className="toolbar">
                <button className="btn primary" type="button" onClick={() => setShowMaterialCreate(true)}><Plus size={16} /> 新增资料</button>
              </div>
            </div>

            <div className="stats prototype-stats stats-4">
              <div className="metric card"><span>资料总数</span><strong>{materials.length}</strong><small>已录入</small></div>
              <div className="metric card"><span>话术</span><strong>{materials.filter((m) => m.type === "script").length}</strong><small>标准话术</small></div>
              <div className="metric card"><span>问答</span><strong>{materials.filter((m) => m.type === "faq").length}</strong><small>FAQ 资料</small></div>
              <div className="metric card"><span>制度</span><strong>{materials.filter((m) => m.type === "policy").length}</strong><small>规范制度</small></div>
            </div>

            <div className="card section">
              <DataTable headers={["资料名称", "类型", "行业包", "场景", "标签", "状态", "操作"]}>
                {materials.map((material) => (
                  <tr key={material.id}>
                    <td><strong>{material.name}</strong></td>
                    <td>{materialTypeLabel(material.type)}</td>
                    <td>{material.industryPackageName || "通用"}</td>
                    <td>{material.sceneName || "未绑定"}</td>
                    <td>{parseTags(material.tags).join("、") || "-"}</td>
                    <td>{statusBadge(material.status)}</td>
                    <td><button className="link-btn" type="button">查看</button></td>
                  </tr>
                ))}
              </DataTable>
              {!materials.length && <div className="empty">暂无资料，请新增话术或培训资料</div>}
            </div>

            {showMaterialCreate && (
              <div className="modal-overlay" onClick={() => setShowMaterialCreate(false)}>
                <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                  <div className="section-head">
                    <div>
                      <h2 className="section-title">新增资料/话术</h2>
                      <p className="section-note">先支持文本录入，后续再接文件上传和向量化。</p>
                    </div>
                  </div>
                  <form onSubmit={handleCreateMaterial}>
                    <div className="form-card" style={{ display: "grid", gap: 14 }}>
                      <Field label="资料名称"><input value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} placeholder="如：网络故障投诉处理标准话术" required /></Field>
                      <Field label="资料类型"><select value={materialForm.type} onChange={(e) => setMaterialForm({ ...materialForm, type: e.target.value })}><option value="script">话术</option><option value="faq">问答</option><option value="policy">制度</option><option value="case">案例</option><option value="other">其他</option></select></Field>
                      <Field label="归属行业包"><select value={materialForm.industryPackageId} onChange={(e) => setMaterialForm({ ...materialForm, industryPackageId: e.target.value })}><option value="">通用资料</option>{industries.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
                      <Field label="绑定场景"><select value={materialForm.sceneId} onChange={(e) => setMaterialForm({ ...materialForm, sceneId: e.target.value })}><option value="">不绑定场景</option>{scenes.map((scene) => <option value={scene.id} key={scene.id}>{scene.name}</option>)}</select></Field>
                      <Field label="标签"><input value={materialForm.tags} onChange={(e) => setMaterialForm({ ...materialForm, tags: e.target.value })} placeholder="用逗号分隔，如：投诉,故障,闭环" /></Field>
                      <Field label="资料内容"><textarea value={materialForm.content} onChange={(e) => setMaterialForm({ ...materialForm, content: e.target.value })} placeholder="录入标准话术、处理规则、FAQ 或案例复盘" required /></Field>
                      <div className="wizard-footer" style={{ justifyContent: "flex-end", gap: 12 }}>
                        <button className="btn" type="button" onClick={() => setShowMaterialCreate(false)}>取消</button>
                        <button className="btn primary" disabled={submitting} type="submit"><Save size={16} /> 保存资料</button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
              </div>
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}

        {activeSection === "sys-departments" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
            <div className="page-header">
              <div>
                <h1 className="page-title">部门管理</h1>
                <p className="page-desc">管理租户下部门、团队和外部组织，为人员归属和按组织发放任务打基础。</p>
              </div>
              <div className="toolbar">
                <button className="btn primary" type="button" onClick={() => setShowOrgCreate(true)}><Plus size={16} /> 新增组织</button>
              </div>
            </div>

            <div className="stats prototype-stats">
              <div className="metric card"><span>组织总数</span><strong>{organizations.length}</strong><small>已创建</small></div>
              <div className="metric card"><span>部门</span><strong>{organizations.filter((o) => o.type === "department").length}</strong><small>按部门管理</small></div>
              <div className="metric card"><span>总人数</span><strong>{organizations.reduce((sum, o) => sum + o.userCount, 0)}</strong><small>组织内成员</small></div>
            </div>

            <div className="card section">
              <DataTable headers={["组织名称", "编码", "类型", "上级组织", "人数", "排序", "操作"]}>
                {organizations.map((org) => (
                  <tr key={org.id}>
                    <td><strong>{org.name}</strong></td>
                    <td className="muted-text">{org.code}</td>
                    <td>{organizationTypeLabel(org.type)}</td>
                    <td>{org.parentName || "-"}</td>
                    <td>{org.userCount}</td>
                    <td>{org.sortOrder}</td>
                    <td><button className="link-btn" type="button">编辑</button></td>
                  </tr>
                ))}
              </DataTable>
              {!organizations.length && <div className="empty">暂无组织</div>}
            </div>

            {showOrgCreate && (
              <div className="modal-overlay" onClick={() => setShowOrgCreate(false)}>
                <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                  <div className="section-head">
                    <div>
                      <h2 className="section-title">新增组织</h2>
                      <p className="section-note">先支持本地维护，后续可对接企微/钉钉通讯录同步。</p>
                    </div>
                  </div>
                  <form onSubmit={handleCreateOrganization}>
                    <div className="form-card" style={{ display: "grid", gap: 14 }}>
                      <Field label="组织名称"><input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} placeholder="如：客户服务部" required /></Field>
                      <Field label="组织编码"><input value={orgForm.code} onChange={(e) => setOrgForm({ ...orgForm, code: e.target.value })} placeholder="留空自动生成" /></Field>
                      <Field label="组织类型"><select value={orgForm.type} onChange={(e) => setOrgForm({ ...orgForm, type: e.target.value })}><option value="department">部门</option><option value="company">公司</option><option value="team">班组</option><option value="external">外部组织</option></select></Field>
                      <Field label="上级组织"><select value={orgForm.parentId} onChange={(e) => setOrgForm({ ...orgForm, parentId: e.target.value })}><option value="">无上级组织</option>{organizations.map((org) => <option value={org.id} key={org.id}>{org.name}</option>)}</select></Field>
                      <Field label="排序"><input type="number" min="0" value={orgForm.sortOrder} onChange={(e) => setOrgForm({ ...orgForm, sortOrder: Number(e.target.value) })} /></Field>
                      <div className="wizard-footer" style={{ justifyContent: "flex-end", gap: 12 }}>
                        <button className="btn" type="button" onClick={() => setShowOrgCreate(false)}>取消</button>
                        <button className="btn primary" disabled={submitting || !orgForm.name} type="submit"><Plus size={16} /> 保存组织</button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
              </div>
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}
        {activeSection === "sys-users" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
            <div className="page-header">
              <div>
                <h1 className="page-title">用户管理</h1>
                <p className="page-desc">管理系统账号、参训学员与内训师，并绑定所属部门。</p>
              </div>
              <div className="toolbar">
                <button className="btn primary" type="button" onClick={() => setShowUserCreate(true)}><Plus size={16} /> 新增人员</button>
              </div>
            </div>

            <div className="stats prototype-stats stats-4">
              <div className="metric card"><span>人员总数</span><strong>{users.length}</strong><small>已录入</small></div>
              <div className="metric card"><span>学员</span><strong>{users.filter((u) => u.roleCode === "learner").length}</strong><small>参训学员</small></div>
              <div className="metric card"><span>管理员</span><strong>{users.filter((u) => u.roleCode === "tenant_admin").length}</strong><small>管理账号</small></div>
              <div className="metric card"><span>活跃</span><strong className="text-green">{users.filter((u) => u.status === "active").length}</strong><small>正常状态</small></div>
            </div>

            <div className="card section">
              <DataTable headers={["姓名", "手机号", "邮箱", "角色", "组织", "状态", "操作"]}>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong></td>
                    <td className="muted-text">{user.mobile}</td>
                    <td className="muted-text">{user.email || "-"}</td>
                    <td>{user.roleCode === "learner" ? "学员" : user.roleCode === "trainer" ? "内训师" : "管理员"}</td>
                    <td>{user.orgName || "未分配"}</td>
                    <td>{statusBadge(user.status)}</td>
                    <td><button className="link-btn" type="button">编辑</button></td>
                  </tr>
                ))}
              </DataTable>
              {!users.length && <div className="empty">暂无人员</div>}
            </div>

            {showUserCreate && (
              <div className="modal-overlay" onClick={() => setShowUserCreate(false)}>
                <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                  <div className="section-head">
                    <div>
                      <h2 className="section-title">新增参训人员</h2>
                      <p className="section-note">人员会写入 SQLite，并可绑定到本租户组织。</p>
                    </div>
                  </div>
                  <form onSubmit={handleCreateUser}>
                    <div className="form-card" style={{ display: "grid", gap: 14 }}>
                      <Field label="姓名"><input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="如：李明" required /></Field>
                      <Field label="手机号"><input value={userForm.mobile} onChange={(e) => setUserForm({ ...userForm, mobile: e.target.value })} placeholder="用于登录或唯一识别" required /></Field>
                      <Field label="邮箱"><input value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="选填" /></Field>
                      <Field label="所属组织"><select value={userForm.orgId} onChange={(e) => setUserForm({ ...userForm, orgId: e.target.value })}><option value="">未分配</option>{organizations.map((org) => <option value={org.id} key={org.id}>{org.name}</option>)}</select></Field>
                      <Field label="角色"><select value={userForm.roleCode} onChange={(e) => setUserForm({ ...userForm, roleCode: e.target.value })}><option value="learner">学员</option><option value="trainer">内训师</option><option value="tenant_admin">管理员</option></select></Field>
                      <Field label="初始密码"><input value={userForm.initialPassword} onChange={(e) => setUserForm({ ...userForm, initialPassword: e.target.value })} type="password" minLength={8} required /></Field>
                      <div className="wizard-footer" style={{ justifyContent: "flex-end", gap: 12 }}>
                        <button className="btn" type="button" onClick={() => setShowUserCreate(false)}>取消</button>
                        <button className="btn primary" disabled={submitting} type="submit"><Plus size={16} /> 保存人员</button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
              </div>
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}
        {activeSection === "tasks" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main tm-mod">
                <div className="module-head card">
                  <div>
                    <h1>任务管理</h1>
                    <p className="muted">发布和管理企业培训、对练及考试任务。</p>
                  </div>
                  <div className="module-actions">
                    <button className="btn outline" type="button" onClick={loadData} disabled={submitting}>刷新数据</button>
                    <button className="btn" type="button" onClick={() => navigateTo("/tasks/new")}>＋ 创建任务</button>
                  </div>
                </div>

                <div className="summary-grid">
                  <div className="summary-card card">
                    <label>任务总数</label>
                    <strong>{tasks.length}</strong>
                    <small className="muted">本年度已创建</small>
                  </div>
                  <div className="summary-card card">
                    <label>进行中</label>
                    <strong className="blue">{tasks.filter((t) => getTaskRuntimeStatus(t) === "in_progress").length}</strong>
                    <small className="muted">正在执行</small>
                  </div>
                  <div className="summary-card card">
                    <label>已完成</label>
                    <strong style={{ color: "#31a877" }}>{tasks.filter((t) => getTaskRuntimeStatus(t) === "completed").length}</strong>
                    <small className="muted">完成率 {tasks.length ? Math.round((tasks.filter((t) => getTaskRuntimeStatus(t) === "completed").length / tasks.length) * 100) : 0}%</small>
                  </div>
                  <div className="summary-card card">
                    <label>待发布</label>
                    <strong style={{ color: "#e49a38" }}>{tasks.filter((t) => getTaskRuntimeStatus(t) === "draft").length}</strong>
                    <small className="muted">等待确认</small>
                  </div>
                </div>

                <div className="module-filter card">
                  <select className="field" value={taskFilter.status} onChange={(e) => setTaskFilter({ ...taskFilter, status: e.target.value })}>
                    <option value="all">全部任务状态</option>
                    <option value="in_progress">进行中</option>
                    <option value="draft">待发布</option>
                    <option value="completed">已完成</option>
                    <option value="overdue">已逾期</option>
                    <option value="stopped">已停用</option>
                  </select>
                  <select className="field" value={taskFilter.type} onChange={(e) => setTaskFilter({ ...taskFilter, type: e.target.value })}>
                    <option value="all">全部任务类型</option>
                    <option value="free_practice">自由对练</option>
                    <option value="fixed_practice">固定对练</option>
                    <option value="free_exam">自由考试</option>
                    <option value="fixed_exam">固定考试</option>
                  </select>
                  <input className="field" placeholder="搜索任务名称" value={taskFilter.keyword ?? ""} onChange={(e) => setTaskFilter({ ...taskFilter, keyword: e.target.value })} />
                  <button className="btn" type="button" onClick={() => setTaskFilter({ ...taskFilter })}>查询</button>
                </div>

                <div className="card" style={{ overflow: "hidden" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>任务名称</th>
                        <th>任务类型</th>
                        <th>包含场景</th>
                        <th>参与人数</th>
                        <th>截止时间</th>
                        <th>状态</th>
                        <th>创建人</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks
                        .filter((task) => {
                          const runtimeStatus = getTaskRuntimeStatus(task);
                          const matchStatus = taskFilter.status === "all" || runtimeStatus === taskFilter.status;
                          const typeLabel = taskTypeLabel(task.type);
                          const matchType = taskFilter.type === "all" || typeLabel === taskTypeLabel(taskFilter.type) || task.type === taskFilter.type;
                          const keyword = taskFilter.keyword.trim().toLowerCase();
                          const matchKeyword = !keyword || `${task.name} ${task.code || ""}`.toLowerCase().includes(keyword);
                          return matchStatus && matchType && matchKeyword;
                        })
                        .map((task) => {
                          const runtimeStatus = getTaskRuntimeStatus(task);
                          const statusMeta: Record<string, { label: string; cls: string }> = {
                            in_progress: { label: "进行中", cls: "blue" },
                            draft: { label: "待发布", cls: "orange" },
                            completed: { label: "已完成", cls: "green" },
                            overdue: { label: "已逾期", cls: "red" },
                            stopped: { label: "已停用", cls: "red" },
                          };
                          const meta = statusMeta[runtimeStatus] || { label: runtimeStatus, cls: "blue" };
                          return (
                            <tr key={task.id} data-task-scene-ids={(task.sceneCount ?? 0)}>
                              <td><strong>{task.name}</strong></td>
                              <td>{taskTypeLabel(task.type)}</td>
                              <td className="task-scene-cell">
                                <button aria-label="查看包含场景" className="task-scene-toggle" type="button" onClick={() => openTaskManageSceneModal(task.id)}>{task.sceneCount ?? 0}</button>
                              </td>
                              <td>{task.participantCount ?? 0} 人</td>
                              <td>{task.endAt ? formatDate(task.endAt) : "—"}</td>
                              <td><span className={`tag ${meta.cls}`}>{meta.label}</span></td>
                              <td>{task.creatorName || "—"}</td>
                              <td className="task-actions">
                                {(runtimeStatus === "in_progress" || runtimeStatus === "completed" || runtimeStatus === "overdue" || runtimeStatus === "stopped") && (
                                  <a onClick={() => openTaskDataModal(task.id)}>查看数据</a>
                                )}
                                <a onClick={() => viewTaskDetail(task.id)}>详情</a>
                                {runtimeStatus === "in_progress" && <a onClick={() => stopTask(task.id)}>停用</a>}
                                {runtimeStatus === "draft" && <a onClick={() => showTaskToast("请在创建任务页完善并发布该任务")}>编辑</a>}
                                {runtimeStatus === "draft" && <a onClick={() => publishTask(task.id)}>发布</a>}
                                {(runtimeStatus === "completed" || runtimeStatus === "stopped") && <a onClick={() => duplicateTask(task)}>复制</a>}
                                {runtimeStatus === "overdue" && <a onClick={() => extendTask(task)}>延长时间</a>}
                              </td>
                            </tr>
                          );
                        })}
                      {tasks.filter((task) => {
                        const runtimeStatus = getTaskRuntimeStatus(task);
                        const matchStatus = taskFilter.status === "all" || runtimeStatus === taskFilter.status;
                        const keyword = taskFilter.keyword.trim().toLowerCase();
                        const matchKeyword = !keyword || `${task.name} ${task.code || ""}`.toLowerCase().includes(keyword);
                        return matchStatus && matchKeyword;
                      }).length === 0 && (
                        <tr><td colSpan={8} style={{ textAlign: "center", color: "#97a5b6", padding: 30 }}>暂无符合条件的任务</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {showTaskManageSceneModal && taskManageSceneData && (
                  <div className="modal-mask show" onClick={() => setShowTaskManageSceneModal(false)}>
                    <div className="modal task-manage-scene-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="task-manage-scene-modal-head">
                        <h3>包含场景</h3>
                        <button aria-label="关闭" className="task-manage-scene-close" type="button" onClick={() => setShowTaskManageSceneModal(false)}>×</button>
                      </div>
                      <p className="task-manage-scene-modal-desc">当前任务包含以下场景</p>
                      <div className="task-manage-scene-modal-list">
                        {taskManageSceneData.scenes.map((scene) => (
                          <a key={scene.id} className="task-manage-scene-modal-item" onClick={() => navigateTo(`/scenes/${scene.sceneId}`)}>
                            <span>{scene.sceneName || scene.sceneCode || "未命名场景"}</span>
                            <b>›</b>
                          </a>
                        ))}
                        {taskManageSceneData.scenes.length === 0 && <div className="task-manage-scene-modal-empty">暂未配置场景</div>}
                      </div>
                    </div>
                  </div>
                )}

                {showTaskDataModal && taskDataDetail && (
                  <div className="modal-mask show" onClick={() => setShowTaskDataModal(false)}>
                    <div className="modal task-data-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="task-data-modal-head">
                        <div>
                          <h3 id="taskDataModalTitle">{taskDataDetail.task.name}</h3>
                          <p id="taskDataModalSub">实时查看任务执行情况</p>
                        </div>
                        <button aria-label="关闭" className="task-manage-scene-close" type="button" onClick={() => setShowTaskDataModal(false)}>×</button>
                      </div>
                      <div className="task-data-kpis">
                        <div><small>参与人数</small><strong>{taskDataDetail.task.participantCount ?? 0}</strong></div>
                        <div><small>完成率</small><strong>{taskDataDetail.task.status === "completed" ? "100%" : `${taskDataDetail.task.progressPercent ?? 0}%`}</strong></div>
                        <div><small>平均分</small><strong>{taskDataDetail.task.status === "completed" ? "88.6" : "82.5"}</strong></div>
                        <div><small>待跟进</small><strong>{taskDataDetail.task.status === "completed" ? "0" : "12"}</strong></div>
                      </div>
                      <div className="task-data-section">
                        <div className="task-data-section-title">
                          <b>场景完成情况</b>
                          <span>{taskDataDetail.scenes.length} 个场景</span>
                        </div>
                        <div className="task-data-scene-rows">
                          {taskDataDetail.scenes.map((scene) => {
                            const pct = scene.requiredTrainTimes > 0 ? Math.min(100, Math.round(((scene.completedTrainCount ?? 0) / scene.requiredTrainTimes) * 100)) : 0;
                            return (
                              <div key={scene.id} className="task-data-scene-row">
                                <b>{scene.sceneName || scene.sceneCode || "未命名场景"}</b>
                                <span className="line"><i style={{ width: `${pct}%` }} /></span>
                                <span className="pct">{pct}%</span>
                              </div>
                            );
                          })}
                          {taskDataDetail.scenes.length === 0 && <div className="task-data-empty">暂未配置场景</div>}
                        </div>
                      </div>
                      <div className="task-data-tip">数据每 5 分钟自动更新</div>
                    </div>
                  </div>
                )}

                <div className={`task-toast${taskToast ? " show" : ""}`}>{taskToast}</div>
              </div>

              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{tasks.filter((t) => t.status === "completed").length}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>{examAttempts.length}</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((r) => r.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}

        {activeSection === "records" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
                <div className="page-header">
                  <div>
                    <h1 className="page-title">训练记录</h1>
                    <p className="page-desc">查看学员对练、考试等训练记录，支持对话文本复盘和评分证据回溯。</p>
                  </div>
                  <div className="toolbar">
                    <button className="btn" type="button" onClick={loadData} disabled={submitting}><RefreshCcw size={16} /> 刷新</button>
                    <button className="btn primary" type="button" onClick={() => setShowRecordCreate(true)}><Plus size={16} /> 录入记录</button>
                  </div>
                </div>

                <div className="stats prototype-stats stats-4">
                  <div className="metric card"><span>记录总数</span><strong>{records.length}</strong><small>已完成</small></div>
                  <div className="metric card"><span>平均分</span><strong>{records.length ? Math.round(records.reduce((s, r) => s + r.score, 0) / records.length) : 0}</strong><small>综合平均</small></div>
                  <div className="metric card"><span>合格率</span><strong className="text-green">{records.length ? Math.round((records.filter((r) => r.score >= 80).length / records.length) * 100) : 0}%</strong><small>≥80分</small></div>
                  <div className="metric card"><span>语音训练</span><strong>{records.filter((r) => r.mode === "voice").length}</strong><small>语音模式</small></div>
                </div>

                <div className="card section">
                  <DataTable headers={["记录号", "学员", "任务", "场景", "模式", "分数", "完成时间", "操作"]}>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td className="muted-text">{record.recordNo}</td>
                        <td>{record.userName || "-"}</td>
                        <td>{record.taskName || "-"}</td>
                        <td>{record.sceneName || "-"}</td>
                        <td>{modeLabel(record.mode)}</td>
                        <td><strong style={{ color: record.score >= 80 ? "var(--success)" : record.score >= 60 ? "var(--warning)" : "var(--danger)" }}>{record.score}</strong></td>
                        <td className="muted-text">{formatDate(record.finishedAt)}</td>
                        <td><button className="link-btn" type="button" onClick={() => viewRecordDetail(record.id)}>查看详情</button></td>
                      </tr>
                    ))}
                  </DataTable>
                  {!records.length && <div className="empty">暂无训练记录</div>}
                </div>

                {selectedRecordDetail && (
                  <div className="card section">
                    <div className="section-head">
                      <div>
                        <h2 className="section-title">复盘详情 · {selectedRecordDetail.record.recordNo}</h2>
                        <p className="section-note">展示学员对话、AI 评分明细和扣分依据。</p>
                      </div>
                      <button className="link-btn" type="button" onClick={() => setSelectedRecordDetail(null)}>关闭</button>
                    </div>
                    <div className="detail-panel">
                      <div className="detail-summary">
                        <strong>{selectedRecordDetail.record.recordNo}</strong>
                        <span>{selectedRecordDetail.record.userName || "-"}</span>
                        <span>{selectedRecordDetail.record.sceneName || "-"}</span>
                        <span>{selectedRecordDetail.record.score} 分</span>
                      </div>

                      <div className="detail-block">
                        <h3>对话文本</h3>
                        <div className="turn-list">
                          {selectedRecordDetail.turns.map((turn) => (
                            <div className={`turn ${turn.speaker}`} key={turn.id}>
                              <strong>{turn.speaker === "ai" ? "AI 客户" : "学员"}</strong>
                              <p>{turn.text}</p>
                              <span>{Math.round(turn.durationMs / 1000)} 秒</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="detail-block">
                        <h3>评分证据</h3>
                        <div className="score-list">
                          {selectedRecordDetail.scores.map((score) => (
                            <div className="score-item" key={score.id}>
                              <div>
                                <strong>{score.ruleName || "评分项"}</strong>
                                <span>{score.score} 分</span>
                              </div>
                              <p>{score.deductionReason || "无扣分说明"}</p>
                              <small>{score.evidenceText || "暂无证据文本"}</small>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {showRecordCreate && (
                  <div className="modal-overlay" onClick={() => setShowRecordCreate(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                      <div className="section-head">
                        <div>
                          <h2 className="section-title">录入训练结果</h2>
                          <p className="section-note">先支持后台录入文本复盘数据，后续替换为学员端语音训练自动回写。</p>
                        </div>
                      </div>
                      <form onSubmit={handleCreateTrainingRecord}>
                        <div className="form-card" style={{ display: "grid", gap: 14 }}>
                          <Field label="关联任务"><select value={recordForm.taskId} onChange={(e) => setRecordForm({ ...recordForm, taskId: e.target.value })}><option value="">不关联任务</option>{tasks.map((task) => <option value={task.id} key={task.id}>{task.name}</option>)}</select></Field>
                          <Field label="训练场景"><select value={recordForm.sceneId} onChange={(e) => setRecordForm({ ...recordForm, sceneId: e.target.value })} required>{scenes.map((scene) => <option value={scene.id} key={scene.id}>{scene.name}</option>)}</select></Field>
                          <Field label="参训学员"><select value={recordForm.userId} onChange={(e) => setRecordForm({ ...recordForm, userId: e.target.value })}><option value="">未知学员</option>{users.filter((user) => user.roleCode === "learner").map((user) => <option value={user.id} key={user.id}>{user.name} · {user.mobile}</option>)}</select></Field>
                          <div className="score-editor-grid">
                            <Field label="训练模式"><select value={recordForm.mode} onChange={(e) => setRecordForm({ ...recordForm, mode: e.target.value })}><option value="voice">语音模式</option><option value="text">文本模式</option></select></Field>
                            <Field label="综合得分"><input type="number" min="0" max="100" value={recordForm.score} onChange={(e) => setRecordForm({ ...recordForm, score: Number(e.target.value) })} /></Field>
                          </div>
                          <Field label="AI 客户话术"><textarea value={recordForm.aiText} onChange={(e) => setRecordForm({ ...recordForm, aiText: e.target.value })} required /></Field>
                          <Field label="学员回应"><textarea value={recordForm.learnerText} onChange={(e) => setRecordForm({ ...recordForm, learnerText: e.target.value })} required /></Field>
                          <Field label="扣分/评价说明"><textarea value={recordForm.deductionReason} onChange={(e) => setRecordForm({ ...recordForm, deductionReason: e.target.value })} /></Field>
                          <Field label="证据文本"><input value={recordForm.evidenceText} onChange={(e) => setRecordForm({ ...recordForm, evidenceText: e.target.value })} /></Field>
                          <div className="wizard-footer" style={{ justifyContent: "flex-end", gap: 12 }}>
                            <button className="btn" type="button" onClick={() => setShowRecordCreate(false)}>取消</button>
                            <button className="btn primary" disabled={submitting || !recordForm.sceneId || !recordForm.aiText || !recordForm.learnerText} type="submit"><Save size={16} /> 保存训练记录</button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>

              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}
        {activeSection === "appeals" && (
          <AppealsSection
            auth={auth}
            records={records}
            appeals={appeals}
            appealForm={appealForm}
            submitting={submitting}
            completedRecordCount={completedRecordCount}
            pendingAppealCount={pendingAppealCount}
            loadData={loadData}
            handleCreateAppeal={handleCreateAppeal}
            setAppealForm={setAppealForm}
          />
        )}
        {activeSection === "student-home" && overview && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
                {/* 学习空间横幅 */}
                <section className="home-hero-card card" style={{ marginBottom: 24 }}>
                  <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
                    <p>我的学习空间</p>
                    <h1>早上好，{auth.user.name}</h1>
                    <p style={{ marginTop: 8, opacity: 0.85 }}>持续学习，提升专业能力，今天也向目标迈进一步。</p>
                  </div>
                  <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginLeft: "auto" }}>
                    <div style={{ width: 100, height: 100, borderRadius: "50%", border: "6px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", position: "relative" }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{overview.monthProgress ?? 0}%</span>
                    </div>
                    <strong style={{ color: "#fff" }}>本月学习进度</strong>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>已完成 {overview.points ? Math.round(overview.points / 10) : 0} 个学习任务</p>
                  </div>
                </section>

                {/* 3统计卡 */}
                <div className="stats prototype-stats" style={{ marginBottom: 24 }}>
                  <div className="metric card"><span>待完成任务</span><strong style={{ color: "#e6a23c" }}>{overview.pendingTaskCount ?? 0}</strong><small>含即将到期</small></div>
                  <div className="metric card"><span>累计学习时长</span><strong><span className="text-blue">{(overview.studyDurationHours ?? 0).toFixed(1)}</span> <span style={{ fontSize: 16, color: "#8b98aa" }}>小时</span></strong><small>较上月持续增长</small></div>
                  <div className="metric card"><span>学习积分</span><strong>{overview.points ?? 0}</strong><small>本月持续积累</small></div>
                </div>

                {/* 待完成学习任务 + 学习日历 并排 */}
                <div className="home-bottom-grid">
                  {/* 待完成学习任务 */}
                  <section className="card section" style={{ padding: 20 }}>
                    <div className="section-head compact" style={{ marginBottom: 12 }}>
                      <h2 className="section-title">待完成学习任务</h2>
                      <button className="link-btn" type="button" onClick={() => handleNavClick("my-tasks")}>查看全部 ›</button>
                    </div>
                    {tasks.slice(0, 3).map((task) => (
                      <div key={task.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#4e63f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="#fff"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" strokeWidth="2" fill="none"/></svg>
                          </div>
                          <div>
                            <strong style={{ display: "block" }}>{task.name}</strong>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{task.type === "scenario_training" ? "情景对练" : task.type} · {task.status === "published" ? "进行中" : "待开始"}</span>
                          </div>
                        </div>
                        <button className="btn" type="button" style={{ background: "#4e63f0", color: "#fff", border: "none", borderRadius: 4, padding: "6px 16px", cursor: "pointer" }} onClick={() => viewTaskDetail(task.id)}>查看任务</button>
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <div style={{ padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>暂无待办任务</div>
                    )}
                  </section>

                  {/* 学习日历 */}
                  <section className="card section" style={{ padding: 20 }}>
                    <div className="section-head compact" style={{ marginBottom: 12 }}>
                      <h2 className="section-title">学习日历</h2>
                      <span style={{ color: "#8b98aa", fontSize: 13 }}>{new Date().getFullYear()}年{new Date().getMonth() + 1}月</span>
                    </div>
                    {/* 日历表头 */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontSize: 12, color: "#8b98aa", marginBottom: 4 }}>
                      <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
                    </div>
                    {/* 日历日期 */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontSize: 13, gap: 4 }}>
                      {(() => {
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = now.getMonth();
                        const firstDay = new Date(year, month, 1).getDay();
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
                        const today = now.getDate();
                        // 学习日集合：任务截止日 + 训练记录完成日
                        const studyDays = new Set<number>();
                        tasks.forEach((t) => {
                          if (t.endAt) {
                            const d = new Date(t.endAt);
                            if (d.getFullYear() === year && d.getMonth() === month) studyDays.add(d.getDate());
                          }
                        });
                        records.forEach((r) => {
                          if (r.finishedAt) {
                            const d = new Date(r.finishedAt);
                            if (d.getFullYear() === year && d.getMonth() === month) studyDays.add(d.getDate());
                          }
                        });
                        return Array.from({ length: totalCells }, (_, i) => {
                          const dayNum = i - firstDay + 1;
                          if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} style={{ padding: 6 }} />;
                          const isToday = dayNum === today;
                          const isGreen = studyDays.has(dayNum);
                          return (
                            <div key={i} style={{ padding: 6, borderRadius: 6, background: isToday ? "#4e63f0" : isGreen ? "#e8f5e9" : "transparent", color: isToday ? "#fff" : "#333" }}>
                              {dayNum}
                            </div>
                          );
                        });
                      })()}
                    </div>
                    {/* 推荐课程 */}
                    <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                      <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>推荐课程</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {materials.slice(0, 3).map((m) => (
                          <span key={m.id} style={{ color: "#5a6b80", fontSize: 13 }}>{m.name}</span>
                        ))}
                        {materials.length === 0 && (
                          <span style={{ color: "#5a6b80", fontSize: 13 }}>暂无推荐课程</span>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              {/* 右侧3卡 — 独立通栏 */}
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}
        {activeSection === "my-tasks" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
                <div className="page-header">
                  <div>
                    <h1 className="page-title">我的任务</h1>
                    <p className="page-desc">集中查看个人培训、对练和考试任务，合理安排学习进度。</p>
                  </div>
                </div>

                {/* 4统计卡 */}
                <div className="stats prototype-stats stats-4" style={{ marginBottom: 24 }}>
                  <div className="metric card"><span>全部任务</span><strong>{myTaskStats.total}</strong><small>本年度累计</small></div>
                  <div className="metric card"><span>已逾期</span><strong style={{ color: "#e6a23c" }}>{myTaskStats.overdue}</strong><small>需尽快处理</small></div>
                  <div className="metric card"><span>已完成</span><strong className="text-green">{myTaskStats.completed}</strong><small>学习完成</small></div>
                  <div className="metric card"><span>进行中</span><strong className="text-blue">{myTaskStats.inProgress}</strong><small>正在执行</small></div>
                </div>

                {/* 筛选区 */}
                <div className="filter-bar card">
                  <div className="filter-row">
                    <div className="filter-item">
                      <select className="filter-select" value={taskFilter.status === "all" ? "" : taskFilter.status} onChange={(e) => setTaskFilter({ ...taskFilter, status: e.target.value || "all" })}>
                        <option value="">全部任务状态</option>
                        <option value="published">进行中</option>
                        <option value="completed">已完成</option>
                        <option value="overdue">已逾期</option>
                      </select>
                    </div>
                    <input className="filter-input" type="text" placeholder="请输入任务名称" value={taskFilter.keyword || ""} onChange={(e) => setTaskFilter({ ...taskFilter, keyword: e.target.value })} />
                    <button className="btn primary" type="button" onClick={() => { /* filter applied reactively */ }}>搜索</button>
                    <button className="btn" type="button" onClick={() => { setTaskFilter({ status: "all", type: "all", keyword: "" }); }}>重置</button>
                  </div>
                </div>

                <div className="card section" style={{ padding: 0 }}>
                  {/* 任务卡片列表 */}
                  {filteredMyTasks.length === 0 && <div className="empty" style={{ padding: 40 }}>暂无任务</div>}
                  {filteredMyTasks.map((task, idx) => {
                    const runtimeStatus = getTaskRuntimeStatus(task);
                    const isOverdue = runtimeStatus === "overdue";
                    const isCompleted = runtimeStatus === "completed";
                    const categoryColors = ["#e6a23c", "#4e63f0", "#8b62e8", "#52c41a"];
                    const categoryLabels = ["安全培训", "客户沟通", "业务对练", "入职课程"];
                    const catColor = categoryColors[idx % categoryColors.length];
                    const catLabel = categoryLabels[idx % categoryLabels.length];
                    const statusLabel = isCompleted ? "已完成" : isOverdue ? "已逾期" : "进行中";
                    const statusBg = isCompleted ? "#f6ffed" : isOverdue ? "#fff7e6" : "#e6f4ff";
                    const statusColor = isCompleted ? "#52c41a" : isOverdue ? "#e6a23c" : "#4e63f0";
                    const actionLabel = isCompleted ? "查看记录" : idx === 0 ? "继续学习" : "开始学习";
                    return (
                      <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderBottom: idx < tasks.length - 1 ? "1px solid var(--border)" : "none" }}>
                        {/* 左侧分类图标 */}
                        <div style={{ width: 52, height: 52, borderRadius: 10, background: catColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 12, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>
                          {catLabel}
                        </div>
                        {/* 中间任务信息 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ display: "block", fontSize: 15, marginBottom: 4 }}>{task.name}</strong>
                          <span style={{ fontSize: 12, color: "#8b98aa", display: "block", marginBottom: 2 }}>
                            常规对话 | 语音形式 | 场景数：1 | 完成进度：{isCompleted ? "100" : "68"}%
                          </span>
                          <span style={{ fontSize: 12, color: "#8b98aa" }}>
                            任务编号：{task.code || task.id}{"   "}
                            {isCompleted ? "完成时间" : "截止时间"}：{isCompleted ? formatDate(task.endAt || "—") : formatDate(task.endAt)}
                          </span>
                        </div>
                        {/* 右侧状态+操作 */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                          <span style={{ padding: "2px 10px", borderRadius: 4, background: statusBg, color: statusColor, fontSize: 12, fontWeight: 600 }}>{statusLabel}</span>
                          <button className="link-btn" type="button" style={{ color: "#4e63f0", fontSize: 13, fontWeight: 600 }} onClick={() => { navigateTo('/tasks/' + task.id); }}>
                            {actionLabel} &gt;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右侧3卡 */}
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}

        {activeSection === "task-detail" && selectedTaskDetail && (() => {
          const task = selectedTaskDetail.task;
          const scenes = selectedTaskDetail.scenes;
          const currentScene = scenes.find((s) => s.id === selectedTaskSceneId) || scenes[0];
          const statusLabel =
            task.status === "completed" ? "已完成"
            : task.status === "draft" ? "待发布"
            : task.status === "overdue" ? "已逾期"
            : "进行中";
          const statusBadgeClass =
            task.status === "completed" ? "green"
            : task.status === "draft" ? "default"
            : "info";
          const answerForm = currentScene?.mode === "text" ? "文本回答" : "语音回答";
          return (
          <section className="page-section">
            <div className="breadcrumb" style={{ marginBottom: 16, color: "#8b98aa", fontSize: 13 }}>
              工作台 / 我的任务 / 任务详情
            </div>
            <div className="home-grid">
              <div className="home-main">
                <div className="page-header">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <h1 className="page-title">{task.name}</h1>
                      <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>
                    </div>
                    <p className="page-desc">任务编号: {task.code || task.id}</p>
                  </div>
                  <div className="toolbar">
                    <button className="btn" type="button" onClick={() => handleNavClick("my-tasks")}>返回我的任务</button>
                  </div>
                </div>

                <div className="card section" style={{ marginBottom: 20 }}>
                  <h3 className="section-title" style={{ marginBottom: 12 }}>任务描述</h3>
                  <p style={{ color: "#52657f", lineHeight: 1.7, marginBottom: 16 }}>完成客户服务沟通场景的学习、对练与考试。</p>
                  <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
                    <div><span style={{ color: "#8b98aa", fontSize: 13 }}>截止时间</span><br /><strong>{formatDate(task.endAt)}</strong></div>
                    <div><span style={{ color: "#8b98aa", fontSize: 13 }}>整体进度</span><br /><strong>0%（0/{scenes.length} 场景）</strong></div>
                    <div><span style={{ color: "#8b98aa", fontSize: 13 }}>发布部门</span><br /><strong>客服培训部</strong></div>
                  </div>
                </div>

                <div className="card section" style={{ marginBottom: 20 }}>
                  <div className="section-head compact" style={{ marginBottom: 16 }}>
                    <h2 className="section-title">场景学习</h2>
                    <span style={{ color: "#8b98aa", fontSize: 13 }}>选择场景进行学习，按顺序完成</span>
                  </div>
                  {scenes.map((scene, i) => {
                    const active = scene.id === currentScene?.id;
                    return (
                      <div
                        key={scene.id}
                        onClick={() => setSelectedTaskSceneId(scene.id)}
                        style={{
                          border: active ? "1px solid #4e63f0" : "1px solid var(--border)",
                          borderRadius: 8,
                          padding: 16,
                          marginBottom: 12,
                          cursor: "pointer",
                          background: active ? "#f5f9ff" : "#fff",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <span style={{ width: 28, height: 28, borderRadius: 6, background: active ? "#4e63f0" : "#c0c4cc", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
                        <strong>{scene.sceneName || "场景名称"}</strong>
                        <span className="badge info" style={{ marginLeft: "auto" }}>进行中</span>
                      </div>
                    );
                  })}
                </div>

                {currentScene && (
                  <div className="card section">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <h2 className="section-title">{currentScene.sceneName || "场景名称"}</h2>
                        <p style={{ color: "#8b98aa", fontSize: 13, marginTop: 4 }}>围绕客户诉求进行沟通、安抚和问题解决。</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <span className="badge default">合格标准 ≥{currentScene.passScore}%</span>
                        <span className="badge default">任务类型 {currentScene.sceneType || "自由对练"}</span>
                        <span className="badge default">回答形式 {answerForm}</span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                      <div>
                        <div className="section-head compact" style={{ marginBottom: 12 }}>
                          <h3 className="section-title">场景学习</h3>
                          <span style={{ color: "#8b98aa", fontSize: 13 }}>{currentScene.sceneName || "场景名称"}</span>
                        </div>
                        <div style={{ display: "grid", gap: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                            <div><strong>资料学习</strong><br /><span style={{ fontSize: 12, color: "#8b98aa" }}>查看学习资料，掌握场景要点。</span></div>
                            <button className="btn" type="button">开始学习</button>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                            <div><strong>AI对练</strong><br /><span style={{ fontSize: 12, color: "#8b98aa" }}>与AI进行模拟对话训练。</span></div>
                            <button className="btn" type="button" onClick={() => startPracticeFromTaskScene(task, currentScene)}>开始对练</button>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                            <div><strong>场景考试</strong><br /><span style={{ fontSize: 12, color: "#8b98aa" }}>完成场景相关综合能力测评。</span></div>
                            <button className="btn" type="button" disabled>开始考试</button>
                          </div>
                        </div>
                        <p style={{ background: "#f5f7fa", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "#8b98aa", marginTop: 12 }}>资料学习和AI对练均可直接开始，完成AI对练后解锁场景考试。</p>
                      </div>

                      <div>
                        <div className="section-head compact" style={{ marginBottom: 12 }}>
                          <h3 className="section-title">场景学习记录</h3>
                          <span style={{ color: "#8b98aa", fontSize: 13 }}>{currentScene.sceneName || "场景名称"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
                          <button className="link-btn" type="button" style={{ color: "#4e63f0", fontWeight: 600, borderBottom: "2px solid #4e63f0", paddingBottom: 8 }}>对练记录</button>
                          <button className="link-btn" type="button">考试记录</button>
                        </div>
                        <div className="empty" style={{ padding: 24 }}>完成AI对练后显示对练记录</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
          );
        })()}
        {activeSection === "my-exams" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
                <div className="page-header">
                  <div>
                    <h1 className="page-title">我的考试</h1>
                    <p className="page-desc">查看待参加、进行中和已完成的考试记录。</p>
                  </div>
                </div>

                {/* 4统计卡 */}
                <div className="stats prototype-stats stats-4" style={{ marginBottom: 24 }}>
                  <div className="metric card"><span>全部考试</span><strong>5</strong><small>本年度累计</small></div>
                  <div className="metric card"><span>待参加</span><strong style={{ color: "#e6a23c" }}>2</strong><small>请按时完成</small></div>
                  <div className="metric card"><span>已通过</span><strong className="text-green">2</strong><small>通过率66.7%</small></div>
                  <div className="metric card"><span>平均成绩</span><strong>78<span style={{ fontSize: 16 }}> 分</span></strong><small>近12个月</small></div>
                </div>

                {/* 筛选区 */}
                <div className="filter-bar card">
                  <div className="filter-row">
                    <div className="filter-item">
                      <select className="filter-select" defaultValue="">
                        <option value="">全部考试状态</option>
                        <option value="pending">待参加</option>
                        <option value="passed">已通过</option>
                        <option value="failed">未通过</option>
                      </select>
                    </div>
                    <input className="filter-input" type="text" placeholder="搜索考试名称" />
                    <button className="btn primary" type="button">查询</button>
                  </div>
                </div>

                {/* 考试表格 */}
                <div className="card section">
                  <DataTable headers={["考试名称", "考试类型", "考试时间", "成绩", "状态", "操作"]}>
                    {examAttempts.length > 0 ? examAttempts.slice(0, 20).map((attempt, i) => {
                      const statusLabel = attempt.status === "passed" ? "已通过" : attempt.status === "failed" ? "未通过" : "待参加";
                      const statusClass = attempt.status === "passed" ? "green" : attempt.status === "failed" ? "red" : "amber";
                      const scoreText = attempt.score != null && attempt.totalScore ? `${attempt.score}分` : "—";
                      const actionLabel = attempt.status === "passed" ? "查看解析" : attempt.status === "failed" ? "重新考试" : "开始考试";
                      const exam = exams.find((e) => e.id === attempt.examId);
                      return (
                        <tr key={attempt.id || i}>
                          <td><strong>{attempt.examName || exam?.name || "考试"}</strong></td>
                          <td>{exam?.status === "stage" ? "阶段考试" : exam?.status === "final" ? "结业考试" : "在线考试"}</td>
                          <td className="muted-text">{attempt.startedAt ? new Date(attempt.startedAt).toLocaleString("zh-CN", { hour12: false }).slice(0, 16) : "—"}</td>
                          <td>{scoreText}</td>
                          <td><span className={`badge ${statusClass}`}>{statusLabel}</span></td>
                          <td>
                            {attempt.status === "passed" ? (
                              <button className="link-btn" type="button" onClick={() => setViewingExamResult(attempt)}>查看解析</button>
                            ) : (
                              <button className="link-btn" type="button" disabled={submitting} onClick={() => { if (exam) void createExamAttemptAndStart(exam); else void resumeExamAttempt(attempt.examId); }}>{actionLabel}</button>
                            )}
                          </td>
                        </tr>
                      );
                    }) : [
                      { name: "客户服务沟通技巧", type: "在线考试", time: "2026-08-05 09:00—23:59", score: "—", status: "待参加", statusClass: "amber", action: "开始考试" },
                      { name: "安全生产基础知识", type: "阶段考试", time: "2026-07-28 14:00—15:00", score: "86分", status: "已通过", statusClass: "green", action: "查看解析" },
                      { name: "新员工入职培训考试", type: "结业考试", time: "2026-07-25 10:00—11:00", score: "58分", status: "未通过", statusClass: "red", action: "重新考试" },
                      { name: "信息安全意识培训", type: "在线考试", time: "2026-07-18 09:00—23:59", score: "90分", status: "已通过", statusClass: "green", action: "查看解析" },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td><strong>{row.name}</strong></td>
                        <td>{row.type}</td>
                        <td className="muted-text">{row.time}</td>
                        <td>{row.score}</td>
                        <td><span className={`badge ${row.statusClass}`}>{row.status}</span></td>
                        <td><button className="link-btn" type="button">{row.action}</button></td>
                      </tr>
                    ))}
                  </DataTable>
                </div>

                {/* 查看解析弹窗（学员成绩报告） */}
                {viewingExamResult && (
                  <div className="modal-overlay" onClick={() => setViewingExamResult(null)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 620 }}>
                      <div className="modal-head">
                        <h2>学员成绩报告</h2>
                        <button className="link-btn" type="button" onClick={() => setViewingExamResult(null)}>×</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", padding: "16px 18px", background: "#f7faff", border: "1px solid #e8eff8", borderRadius: 12 }}>
                        <div><span style={{ color: "#8494a8", fontSize: 12 }}>考试名称</span><b style={{ display: "block", marginTop: 5 }}>{viewingExamResult.examName || "考试"}</b></div>
                        <div><span style={{ color: "#8494a8", fontSize: 12 }}>学员</span><b style={{ display: "block", marginTop: 5 }}>{viewingExamResult.userName || "—"}</b></div>
                        <div><span style={{ color: "#8494a8", fontSize: 12 }}>完成时间</span><b style={{ display: "block", marginTop: 5 }}>{viewingExamResult.finishedAt ? new Date(viewingExamResult.finishedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</b></div>
                        <div><span style={{ color: "#8494a8", fontSize: 12 }}>用时</span><b style={{ display: "block", marginTop: 5 }}>{viewingExamResult.durationSeconds ? `${Math.round(viewingExamResult.durationSeconds / 60)} 分钟` : "—"}</b></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, padding: "14px 18px", borderRadius: 12, background: viewingExamResult.status === "passed" ? "#f0fbf5" : "#fff4f0", color: viewingExamResult.status === "passed" ? "#318b68" : "#dc7662" }}>
                        <span>本次成绩</span>
                        <strong style={{ fontSize: 20 }}>{viewingExamResult.score}{viewingExamResult.totalScore ? ` / ${viewingExamResult.totalScore}` : ""} 分</strong>
                      </div>
                      <div style={{ marginTop: 16, color: "#71849d", fontSize: 13, lineHeight: 1.8 }}>
                        {viewingExamResult.status === "passed" ? "已通过本次考试，成绩合格。建议回顾错题解析，巩固薄弱知识点。" : "未通过本次考试。建议重新学习相关资料后再次参加考试。"}
                      </div>
                      <div className="modal-actions">
                        <button className="btn" type="button" onClick={() => setViewingExamResult(null)}>关闭</button>
                        {viewingExamResult.status === "failed" && (
                          <button className="btn primary" type="button" onClick={() => { const exam = exams.find((e) => e.id === viewingExamResult.examId); setViewingExamResult(null); if (exam) void createExamAttemptAndStart(exam); }}>重新考试</button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧3卡 */}
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}
        {activeSection === "knowledge" && (
          <KnowledgeSection
            auth={auth}
            records={records}
            completedRecordCount={completedRecordCount}
            pendingAppealCount={pendingAppealCount}
          />
        )}
        {(activeSection === "statistics-dept" || activeSection === "statistics-learner") && (
          <StatisticsSection
            activeSection={activeSection}
            auth={auth}
            submitting={submitting}
            completedRecordCount={completedRecordCount}
            pendingAppealCount={pendingAppealCount}
            recordsCount={records.length}
            onSwitchTab={(section) => handleNavClick(section)}
            onRefresh={loadData}
          />
        )}
        {activeSection === "settings" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
            <div className="page-header">
              <div>
                <h1 className="page-title">全局配置</h1>
                <p className="page-desc">管理租户套餐、大模型接口与当前模型配置，所有配置本地 SQLite 持久化。</p>
              </div>
            </div>

            <div className="grid layout-two">
              <form className="card section form-card" onSubmit={handleSaveTenantSettings}>
              <div className="section-head compact">
                <div>
                  <h2 className="section-title">租户与套餐</h2>
                  <p className="section-note">本地 SQLite 保存租户套餐、到期时间和资源额度，后续可平滑迁移到 MySQL 多租户部署。</p>
                </div>
              </div>
              <Field label="租户名称"><input value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} required /></Field>
              <Field label="套餐版本"><select value={tenantForm.planCode} onChange={(e) => setTenantForm({ ...tenantForm, planCode: e.target.value })}><option value="trial">试用版</option><option value="standard">标准版</option><option value="professional">专业版</option><option value="enterprise">企业版</option></select></Field>
              <Field label="到期时间"><input type="datetime-local" value={tenantForm.expireAt} onChange={(e) => setTenantForm({ ...tenantForm, expireAt: e.target.value })} /></Field>
              <div className="score-editor-grid">
                <Field label="场景额度"><input type="number" min="0" value={tenantForm.resourceQuota.sceneLimit} onChange={(e) => setTenantForm({ ...tenantForm, resourceQuota: { ...tenantForm.resourceQuota, sceneLimit: Number(e.target.value) } })} /></Field>
                <Field label="LLM Token"><input type="number" min="0" value={tenantForm.resourceQuota.aiTokenLimit} onChange={(e) => setTenantForm({ ...tenantForm, resourceQuota: { ...tenantForm.resourceQuota, aiTokenLimit: Number(e.target.value) } })} /></Field>
              </div>
              <div className="score-editor-grid">
                <Field label="STT 秒数"><input type="number" min="0" value={tenantForm.resourceQuota.sttSeconds} onChange={(e) => setTenantForm({ ...tenantForm, resourceQuota: { ...tenantForm.resourceQuota, sttSeconds: Number(e.target.value) } })} /></Field>
                <Field label="TTS 字符"><input type="number" min="0" value={tenantForm.resourceQuota.ttsCharacters} onChange={(e) => setTenantForm({ ...tenantForm, resourceQuota: { ...tenantForm.resourceQuota, ttsCharacters: Number(e.target.value) } })} /></Field>
              </div>
              <button className="btn primary full" disabled={submitting || !tenantForm.name} type="submit"><Save size={16} /> 保存租户配置</button>
            </form>

            <form className="card section form-card" onSubmit={handleSaveAiProvider}>
              <div className="section-head compact">
                <div>
                  <h2 className="section-title">大模型接口配置</h2>
                  <p className="section-note">采用 OpenAI 兼容 Chat Completions 协议，API Key 只保存在后端数据库。</p>
                </div>
              </div>
              <Field label="能力类型"><select value={aiForm.providerType} onChange={(e) => setAiForm({ ...aiForm, providerType: e.target.value })}><option value="llm">大模型 LLM</option><option value="stt">语音识别 STT</option><option value="tts">语音合成 TTS</option></select></Field>
              <Field label="供应商名称"><input value={aiForm.providerName} onChange={(e) => setAiForm({ ...aiForm, providerName: e.target.value })} placeholder="如：通义千问 / DeepSeek / OpenAI" required /></Field>
              <Field label="模型名称"><input value={aiForm.modelName} onChange={(e) => setAiForm({ ...aiForm, modelName: e.target.value })} placeholder="如：qwen-plus" required /></Field>
              <Field label="Base URL"><input value={aiForm.baseUrl} onChange={(e) => setAiForm({ ...aiForm, baseUrl: e.target.value })} placeholder="https://api.example.com/v1" required /></Field>
              <Field label="API Key"><input value={aiForm.apiKey} onChange={(e) => setAiForm({ ...aiForm, apiKey: e.target.value })} placeholder="留空则保留原 Key" type="password" /></Field>
              <Field label="状态"><select value={aiForm.status} onChange={(e) => setAiForm({ ...aiForm, status: e.target.value })}><option value="enabled">启用</option><option value="disabled">停用</option></select></Field>
              <button className="btn primary full" disabled={submitting} type="submit"><Save size={16} /> 保存模型配置</button>
            </form>

            <div className="card section">
              <div className="section-head">
                <div>
                  <h2 className="section-title">当前模型配置</h2>
                  <p className="section-note">前端不展示 Key，避免泄露。</p>
                </div>
              </div>
              <div className="side-list">
                {providers.map((provider) => (
                  <div className="todo" key={provider.id}>
                    <div>
                      <strong>{provider.providerName}</strong>
                      <span> {provider.modelName || "未配置模型"}</span>
                      <small>{provider.baseUrl || "未配置 Base URL"}</small>
                    </div>
                    {statusBadge(provider.status)}
                  </div>
                ))}
                </div>
              </div>
            </div>
              </div>
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}
        {activeSection === "sys-roles" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
                <SysRolesSection />
              </div>
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}
        {activeSection === "sys-menus" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
                <SysMenusSection navItems={navItems} />
              </div>
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}
        {activeSection === "sys-posts" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
                <SysPostsSection organizations={organizations} />
              </div>
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}
        {activeSection === "sys-tenants" && (
          <section className="page-section">
            <div className="home-grid">
              <div className="home-main">
            <div className="page-header">
              <div>
                <h1 className="page-title">租户管理</h1>
                <p className="page-desc">查看与维护当前租户信息、套餐与资源额度，支持多租户隔离配置。</p>
              </div>
              <div className="toolbar">
                <button className="btn primary" type="button" onClick={saveTenantSettingsAction} disabled={submitting}><Save size={16} /> 保存租户</button>
              </div>
            </div>
            <div className="grid layout-two">
              <form className="card section form-card" onSubmit={handleSaveTenantSettings}>
                <div className="section-head compact">
                  <div>
                    <h2 className="section-title">租户基础信息</h2>
                    <p className="section-note">本地 SQLite 保存租户套餐、到期时间和资源额度。</p>
                  </div>
                </div>
                <Field label="租户名称"><input value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} required /></Field>
                <Field label="套餐版本"><select value={tenantForm.planCode} onChange={(e) => setTenantForm({ ...tenantForm, planCode: e.target.value })}><option value="trial">试用版</option><option value="standard">标准版</option><option value="professional">专业版</option><option value="enterprise">企业版</option></select></Field>
                <Field label="到期时间"><input type="datetime-local" value={tenantForm.expireAt} onChange={(e) => setTenantForm({ ...tenantForm, expireAt: e.target.value })} /></Field>
                <div className="score-editor-grid">
                  <Field label="场景额度"><input type="number" min="0" value={tenantForm.resourceQuota.sceneLimit} onChange={(e) => setTenantForm({ ...tenantForm, resourceQuota: { ...tenantForm.resourceQuota, sceneLimit: Number(e.target.value) } })} /></Field>
                  <Field label="LLM Token"><input type="number" min="0" value={tenantForm.resourceQuota.aiTokenLimit} onChange={(e) => setTenantForm({ ...tenantForm, resourceQuota: { ...tenantForm.resourceQuota, aiTokenLimit: Number(e.target.value) } })} /></Field>
                </div>
                <div className="score-editor-grid">
                  <Field label="STT 秒数"><input type="number" min="0" value={tenantForm.resourceQuota.sttSeconds} onChange={(e) => setTenantForm({ ...tenantForm, resourceQuota: { ...tenantForm.resourceQuota, sttSeconds: Number(e.target.value) } })} /></Field>
                  <Field label="TTS 字符"><input type="number" min="0" value={tenantForm.resourceQuota.ttsCharacters} onChange={(e) => setTenantForm({ ...tenantForm, resourceQuota: { ...tenantForm.resourceQuota, ttsCharacters: Number(e.target.value) } })} /></Field>
                </div>
                <button className="btn primary full" disabled={submitting || !tenantForm.name} type="submit"><Save size={16} /> 保存租户配置</button>
              </form>
              <div className="card section">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">租户说明</h2>
                    <p className="section-note">租户隔离基于 x-tenant-code 请求头，本地验证租户为 zxt-demo。</p>
                  </div>
                </div>
                <div className="side-list">
                  <div className="todo"><div><strong>租户编码</strong><span>zxt-demo</span></div>{statusBadge("active")}</div>
                  <div className="todo"><div><strong>套餐版本</strong><span>{tenantForm.planCode}</span></div>{statusBadge("active")}</div>
                  <div className="todo"><div><strong>场景额度</strong><span>{tenantForm.resourceQuota.sceneLimit}</span></div>{statusBadge("active")}</div>
                </div>
              </div>
            </div>
              </div>
              <aside className="right-rail">
                <div className="profile card">
                  <span className="avatar large" />
                  <div>
                    <h2>{auth.user.name}</h2>
                    <p>企业管理员</p>
                    <p>培训负责人</p>
                  </div>
                </div>
                <div className="sidecard card">
                  <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                  <strong>{completedRecordCount}</strong>
                  <p>已完成培训任务</p>
                  <div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round((records.filter((record) => record.score >= 80).length / records.length) * 100)}%` : "0%"}</b></span></div>
                </div>
                <div className="sidecard card">
                  <h2>通知消息</h2>
                  <p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
                </div>
              </aside>
            </div>
          </section>
        )}
      {activeExamTaking && (
          <div className="modal-overlay" onClick={() => exitExamTaking()}>
            <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
              {!submittedAttempt ? (
                <>
                  <div className="section-head">
                    <div>
                      <h2 className="section-title">{activeExamTaking.name} · 答题</h2>
                      <p className="section-note">共 {activeExamTaking.questions.length} 题，满分 {activeExamTaking.totalScore} 分，及格 {activeExamTaking.passScore} 分。</p>
                    </div>
                    <button className="btn" type="button" onClick={() => exitExamTaking()}>退出</button>
                  </div>
                  <div className="exam-taker">
                    {activeExamTaking.questions.map((question, index) => (
                      <div key={question.id} className="exam-question">
                        <div className="exam-question-head">
                          <span className="badge blue">第 {index + 1} 题 · {questionTypeLabel(question.type)} · {question.score} 分</span>
                        </div>
                        <p className="exam-stem">{question.stem}</p>
                        <div className="exam-options">
                          {question.options.map((option, optIndex) => {
                            const key = String.fromCharCode(65 + optIndex);
                            const current = takeAnswers[question.id] || "";
                            const isMulti = question.type === "multi";
                            const selected = isMulti ? current.includes(key) : current === key;
                            function toggleOption() {
                              if (isMulti) {
                                const next = current.includes(key) ? current.replace(key, "") : (current + key);
                                const sorted = next.split("").sort().join("");
                                setTakeAnswers((prev) => ({ ...prev, [question.id]: sorted }));
                              } else {
                                setTakeAnswers((prev) => ({ ...prev, [question.id]: key }));
                              }
                            }
                            return (
                              <label key={key} className={`check-row ${selected ? "checked" : ""}`}>
                                <input type={isMulti ? "checkbox" : "radio"} name={`q-${question.id}`} checked={selected} onChange={toggleOption} />
                                <span><strong>{key}.</strong> {option}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="wizard-footer">
                    <button className="btn" type="button" onClick={() => exitExamTaking()}>取消</button>
                    <button className="btn primary" type="button" onClick={submitExamTaking} disabled={submitting || !Object.keys(takeAnswers).length}><Send size={16} /> {submitting ? "提交中…" : "交卷"}</button>
                  </div>
                </>
              ) : (
                <div className="exam-result">
                  <h2 className="section-title">{activeExamTaking.name} · 成绩</h2>
                  <div className="result-score">
                    <span className="big-score" style={{ color: submittedAttempt.score >= activeExamTaking.passScore ? "var(--success)" : "var(--danger)" }}>{submittedAttempt.score}</span>
                    <span className="muted-text">/ {activeExamTaking.totalScore} 分</span>
                    <div>{submittedAttempt.status === "passed" ? <span className="badge green">已通过</span> : <span className="badge red">未通过</span>}</div>
                  </div>
                  <p className="section-note">及格分数线 {activeExamTaking.passScore} 分</p>
                  <div className="wizard-footer">
                    <button className="btn primary" type="button" onClick={() => exitExamTaking()}>返回</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {showBankCreate && (
          <div className="modal-overlay" onClick={() => setShowBankCreate(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="section-head">
                <div>
                  <h2 className="section-title">新建题库</h2>
                  <p className="section-note">题库用于组织考试题目，可反复用于组卷。</p>
                </div>
              </div>
              <form onSubmit={createBankAction}>
                <div className="form-card" style={{ display: "grid", gap: 14 }}>
                  <Field label="题库名称"><input value={examBankForm.name} onChange={(e) => setExamBankForm({ ...examBankForm, name: e.target.value })} placeholder="如：客服服务规范题库" required /></Field>
                  <Field label="题库说明"><textarea value={examBankForm.description} onChange={(e) => setExamBankForm({ ...examBankForm, description: e.target.value })} placeholder="可选，描述题库覆盖范围" rows={3} /></Field>
                </div>
                <div className="wizard-footer">
                  <button className="btn" type="button" onClick={() => setShowBankCreate(false)}>取消</button>
                  <button className="btn primary" type="submit" disabled={submitting}><Save size={16} /> 保存题库</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showQuestionCreate && (
          <div className="modal-overlay" onClick={() => setShowQuestionCreate(false)}>
            <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
              <div className="section-head">
                <div>
                  <h2 className="section-title">新增题目</h2>
                  <p className="section-note">正确答案需与选项字母一致（单选/多选用字母组合，判断用 A/B）。</p>
                </div>
              </div>
              <form onSubmit={createQuestionAction}>
                <div className="form-card" style={{ display: "grid", gap: 14 }}>
                  <div className="score-editor-grid">
                    <Field label="题型"><select value={examQuestionForm.type} onChange={(e) => setExamQuestionForm({ ...examQuestionForm, type: e.target.value as "single" | "multi" | "judge" })}><option value="single">单选题</option><option value="multi">多选题</option><option value="judge">判断题</option></select></Field>
                    <Field label="分值"><input type="number" min={1} max={100} value={examQuestionForm.score} onChange={(e) => setExamQuestionForm({ ...examQuestionForm, score: Number(e.target.value) })} /></Field>
                  </div>
                  <Field label="题干"><textarea value={examQuestionForm.stem} onChange={(e) => setExamQuestionForm({ ...examQuestionForm, stem: e.target.value })} placeholder="请输入题目内容" rows={3} required /></Field>
                  <span className="field-label">选项（填字母对应答案，如 A、AB）</span>
                  <div className="check-list">
                    {examQuestionForm.options.map((option, index) => (
                      <label key={index} className="check-row">
                        <strong>{String.fromCharCode(65 + index)}.</strong>
                        <input value={option} onChange={(e) => { const next = [...examQuestionForm.options]; next[index] = e.target.value; setExamQuestionForm({ ...examQuestionForm, options: next }); }} placeholder={`选项 ${String.fromCharCode(65 + index)}`} />
                      </label>
                    ))}
                  </div>
                  <div className="score-editor-grid">
                    <Field label="正确答案"><input value={examQuestionForm.answer} onChange={(e) => setExamQuestionForm({ ...examQuestionForm, answer: e.target.value })} placeholder="如 A、C、AB" required /></Field>
                    <Field label="答案解析"><input value={examQuestionForm.analysis} onChange={(e) => setExamQuestionForm({ ...examQuestionForm, analysis: e.target.value })} placeholder="可选" /></Field>
                  </div>
                </div>
                <div className="wizard-footer">
                  <button className="btn" type="button" onClick={() => setShowQuestionCreate(false)}>取消</button>
                  <button className="btn primary" type="submit" disabled={submitting}><Save size={16} /> 保存题目</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showExamCreate && (
          <div className="modal-overlay" onClick={() => setShowExamCreate(false)}>
            <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
              <div className="section-head">
                <div>
                  <h2 className="section-title">新建考试</h2>
                  <p className="section-note">从题库选择题目组成考卷，保存后需发布学员方可参加。</p>
                </div>
              </div>
              <form onSubmit={createExamAction}>
                <div className="form-card" style={{ display: "grid", gap: 14 }}>
                  <Field label="考试名称"><input value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })} placeholder="如：客服岗位入职考试" required /></Field>
                  <div className="score-editor-grid">
                    <Field label="考试编码"><input value={examForm.code} onChange={(e) => setExamForm({ ...examForm, code: e.target.value })} placeholder="留空自动生成" /></Field>
                    <Field label="所属题库"><select value={examForm.bankId} onChange={(e) => onExamFormBankChange(e.target.value)}><option value="">综合卷（全部题目）</option>{examBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></Field>
                  </div>
                  <Field label="考试说明"><textarea value={examForm.description} onChange={(e) => setExamForm({ ...examForm, description: e.target.value })} placeholder="可选" rows={2} /></Field>
                  <div className="score-editor-grid">
                    <Field label="考试时长（分钟）"><input type="number" min={1} max={600} value={examForm.durationMinutes} onChange={(e) => setExamForm({ ...examForm, durationMinutes: Number(e.target.value) })} /></Field>
                    <Field label="及格分"><input type="number" min={0} max={100} value={examForm.passScore} onChange={(e) => setExamForm({ ...examForm, passScore: Number(e.target.value) })} /></Field>
                  </div>
                  <div className="check-list">
                    <span className="field-label">所选题库题目预览（考试自动取该题库全部题目组成考卷）</span>
                    {examFormQuestions.map((question) => (
                      <label key={question.id} className="check-row">
                        <span>[{questionTypeLabel(question.type)}] {question.stem} · {question.score} 分</span>
                      </label>
                    ))}
                    {!examFormQuestions.length && <div className="empty">当前题库暂无题目，请先在题库管理录入。</div>}
                  </div>
                </div>
                <div className="wizard-footer">
                  <button className="btn" type="button" onClick={() => setShowExamCreate(false)}>取消</button>
                  <button className="btn primary" type="submit" disabled={submitting}><Save size={16} /> 保存考试</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {selectedExam && (
          <div className="modal-overlay" onClick={() => setSelectedExam(null)}>
            <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
              <div className="section-head">
                <div>
                  <h2 className="section-title">{selectedExam.name} · 考试详情</h2>
                  <p className="section-note">共 {selectedExam.questions.length} 题，满分 {selectedExam.totalScore} 分，及格 {selectedExam.passScore} 分，时长 {selectedExam.durationMinutes} 分钟。</p>
                </div>
                <button className="btn" type="button" onClick={() => setSelectedExam(null)}>关闭</button>
              </div>
              <div className="exam-taker">
                {selectedExam.questions.map((question, index) => (
                  <div key={question.id} className="exam-question">
                    <div className="exam-question-head">
                      <span className="badge blue">第 {index + 1} 题 · {questionTypeLabel(question.type)} · {question.score} 分</span>
                    </div>
                    <p className="exam-stem">{question.stem}</p>
                    <div className="exam-options">
                      {question.options.map((option, optIndex) => {
                        const key = String.fromCharCode(65 + optIndex);
                        return (
                          <label key={key} className={`check-row ${(question.answer.includes(key)) ? "checked" : ""}`}>
                            <span><strong>{key}.</strong> {option} {question.answer.includes(key) ? "（正确答案）" : ""}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}













