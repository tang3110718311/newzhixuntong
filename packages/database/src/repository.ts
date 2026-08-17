import { randomBytes } from "node:crypto";
import { all, createId, get, run } from "./sqlite";
import { hashPassword, hashSessionToken, verifyPassword } from "./password";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./secret";

export type TenantRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  planCode?: string;
  expireAt?: string | null;
  resourceQuotaJson?: string;
};

export type TenantSettingsRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  planCode: string;
  expireAt: string | null;
  resourceQuota: {
    sceneLimit: number;
    aiTokenLimit: number;
    sttSeconds: number;
    ttsCharacters: number;
    userLimit: number;
    storageMb: number;
  };
};

export type OrganizationRow = {
  id: string;
  parentId: string | null;
  parentName: string | null;
  code: string;
  name: string;
  type: string;
  sortOrder: number;
  userCount: number;
  createdAt: string;
};
export type UserRow = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  roleCode: string;
  status: string;
  orgId: string | null;
  orgName: string | null;
};
export type AuthUserRow = UserRow & {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  passwordMustChange: number;
};

export type AuthSessionRow = {
  token: string;
  expiresAt: string;
  user: AuthUserRow;
};

export type IndustryPackageRow = {
  id: string;
  name: string;
  code: string;
  industryType: string;
  targetRoles: string;
  status: string;
  version: string;
  isSystemTemplate: number;
  description?: string;
};

export type CapabilityItemRow = {
  id: string;
  name: string;
  weight: number;
  scoreDesc: string;
  riskTag: string;
};

export type CapabilityModelRow = {
  id: string;
  industryPackageId: string;
  industryPackageName: string | null;
  name: string;
  description: string;
  passScore: number;
  itemCount: number;
  weightTotal: number;
  createdAt: string;
  items: CapabilityItemRow[];
};

export type SceneRow = {
  id: string;
  name: string;
  code: string;
  industryPackageId?: string | null;
  industryPackageName?: string | null;
  sceneType: string;
  mode: string;
  createMode: string;
  status: string;
  isTemplate: number;
  sourceType: string;
  description?: string;
  passScore: number;
  taskCount?: number;
  creatorName?: string | null;
  creatorOrgName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};


export type SceneRoleRow = {
  id: string;
  roleType: string;
  identity: string;
  background: string;
  personality: string;
  emotion: string;
  languageStyle?: string;
  goal: string;
};

export type SceneRuleRow = {
  id: string;
  initiator: string;
  endCondition: string;
  interruptCondition: string;
  description: string;
};

export type ScoringRuleRow = {
  id: string;
  name: string;
  score: number;
  criteria: string;
  deductionRule: string;
  evidenceRequired: string;
  sortOrder: number;
};

export type SceneDetail = {
  scene: SceneRow & { industryPackageName: string | null };
  roles: SceneRoleRow[];
  rule: SceneRuleRow | null;
  scoringRules: ScoringRuleRow[];
  materials: MaterialRow[];
};
export type TaskRow = {
  id: string;
  name: string;
  code: string;
  type: string;
  description: string;
  status: string;
  startAt?: string | null;
  endAt: string | null;
  publishAt?: string | null;
  completedAt?: string | null;
  createdBy?: string | null;
  creatorName?: string | null;
  creatorOrgName?: string | null;
  participantCount: number;
  sceneCount: number;
  completedSceneCount: number;
  progressPercent: number;
  primarySceneType?: string | null;
  primaryMode?: string | null;
};

export type TaskSceneRow = {
  id: string;
  sceneId: string;
  sceneName: string | null;
  sceneCode: string | null;
  sceneType: string | null;
  mode: string | null;
  status: string | null;
  sortOrder: number;
  requiredTrainTimes: number;
  passScore: number;
  completedTrainCount: number;
};

export type TaskParticipantRow = {
  id: string;
  participantType: "user" | "org";
  userId: string | null;
  userName: string | null;
  mobile: string | null;
  orgId: string | null;
  orgName: string | null;
  status: string;
  finishedAt: string | null;
};

export type TaskDetail = {
  task: TaskRow;
  scenes: TaskSceneRow[];
  participants: TaskParticipantRow[];
};

export type MaterialRow = {
  id: string;
  name: string;
  type: string;
  industryPackageId: string | null;
  industryPackageName: string | null;
  sceneId: string | null;
  sceneName: string | null;
  tags: string;
  status: string;
  content: string;
  createdAt: string;
};

export type AiProviderRow = {
  id: string;
  providerType: string;
  providerName: string;
  modelName: string;
  baseUrl: string;
  status: string;
  isDefault: number;
};

export type TrainingRecordRow = {
  id: string;
  recordNo: string;
  taskId: string | null;
  taskName: string | null;
  sceneId: string;
  sceneName: string | null;
  userId: string | null;
  userName: string | null;
  mode: string;
  status: string;
  score: number;
  startedAt: string | null;
  finishedAt: string | null;
  sessionId?: string | null;
  summaryJson?: string | null;
};

export type TrainingTurnRow = {
  id: string;
  speaker: string;
  text: string;
  durationMs: number;
  startedAt: string | null;
  emotion: string;
};

export type ScoreDetailRow = {
  id: string;
  ruleName: string | null;
  score: number;
  deductionReason: string;
  evidenceText: string;
  /** 能力评级：excellent（精通）/ pass（达标）/ developing（待提升）/ 空（无） */
  level?: string | null;
  /** 评分所属轮次：0 表示整场评分，>0 表示第 N 轮的单轮评分 */
  roundNo?: number;
};

export type TrainingRecordDetail = {
  record: TrainingRecordRow;
  turns: TrainingTurnRow[];
  scores: ScoreDetailRow[];
  /** 每轮评分（round_no>0 的评分明细，按轮次聚合），供报告页对话记录展示 */
  turnScores?: Array<{ roundNo: number; scores: ScoreDetailRow[] }>;
  suggestions: string[];
  highlights?: string[];
  weaknesses?: string[];
  /** 能力综述（P0 胜任力画像） */
  capabilityProfile?: string;
};

export type CreateTrainingRecordInput = {
  taskId?: string | null;
  sceneId: string;
  userId?: string | null;
  mode: "voice" | "text";
  status: "completed" | "in_progress";
  score: number;
  sessionId?: string | null;
  suggestions?: string[];
  highlights?: string[];
  weaknesses?: string[];
  startedAt?: string | null;
  finishedAt?: string | null;
  capabilityProfile?: string | null;
  turns: Array<{ speaker: "ai" | "learner"; text: string; durationMs?: number; startedAt?: string | null; emotion?: string }>;
  scores: Array<{ scoringRuleId?: string | null; score: number; deductionReason?: string; evidenceText?: string; level?: string | null; roundNo?: number }>;
};

export type AiTrainingSessionMessage = {
  role: "ai" | "learner";
  content: string;
  emotion?: string;
  createdAt?: string;
};

export type AiTrainingSessionRow = {
  id: string;
  tenantId: string;
  userId: string | null;
  sceneId: string;
  status: "in_progress" | "completed" | "abandoned";
  historyJson: string;
  offTopicCount: number;
  roundCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppealRow = {
  id: string;
  bizType: string;
  bizId: string;
  recordNo: string | null;
  taskName: string | null;
  sceneName: string | null;
  score: number | null;
  userId: string | null;
  userName: string | null;
  reason: string;
  status: string;
  handlerId: string | null;
  handlerName: string | null;
  handledAt: string | null;
  createdAt: string;
};

export type GeneratedSceneInput = {
  industryPackageId?: string | null;
  name: string;
  code?: string;
  mode: "voice" | "text";
  createMode?: string;
  createdBy?: string | null;
  sceneType: string;
  description: string;
  sourceType: string;
  aiRole: {
    identity: string;
    background: string;
    personality: string;
    emotion: string;
    languageStyle?: string;
    goal: string;
  };
  learnerRole: {
    identity: string;
    goal: string;
  };
  endCondition: string;
  interruptCondition: string;
  scoringRules: Array<{
    name: string;
    score: number;
    criteria: string;
    deductionRule: string;
    evidenceRequired: string;
  }>;
};

export function getTenantByCode(code: string) {
  return get<TenantRow>(
    "select id, name, code, status, plan_code as planCode, expire_at as expireAt, resource_quota_json as resourceQuotaJson from tenants where code = ? and deleted_at is null limit 1",
    [code],
  );
}
type AuthUserWithPassword = AuthUserRow & { passwordHash: string };

function selectAuthUserWhere(whereSql: string, params: unknown[], orderSql = "") {
  return get<AuthUserWithPassword>(
    `select u.id, u.tenant_id as tenantId, t.code as tenantCode, t.name as tenantName,
            u.name, u.mobile, u.email, u.role_code as roleCode, u.status, u.org_id as orgId, o.name as orgName,
            u.password_hash as passwordHash, u.password_must_change as passwordMustChange
     from users u
     inner join tenants t on t.id = u.tenant_id and t.deleted_at is null and t.status = 'active'
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where ${whereSql} and u.deleted_at is null ${orderSql} limit 1`,
    params,
  );
}

function stripPassword(row: AuthUserWithPassword): AuthUserRow {
  const { passwordHash: _passwordHash, ...user } = row;
  return user;
}

/** 按手机号匹配激活租户下的用户；同一手机号可存在于多个租户（支持登录/切换企业） */
function findAuthUserByMobile(mobile: string, tenantCode?: string): AuthUserWithPassword | undefined {
  if (tenantCode) {
    return selectAuthUserWhere("u.mobile = ? and t.code = ?", [mobile, tenantCode]);
  }
  // 未指定租户时取最近登录的租户（同手机号多租户时按最近登录排序）
  return selectAuthUserWhere(
    "u.mobile = ?",
    [mobile],
    "order by u.last_login_at desc, u.updated_at desc",
  );
}

function createSessionForUser(user: AuthUserWithPassword, input: { userAgent?: string; ip?: string }): AuthSessionRow {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  run(
    `insert into user_sessions (id, tenant_id, user_id, token_hash, expires_at, user_agent, ip, created_at, last_seen_at)
     values (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [createId("sess"), user.tenantId, user.id, tokenHash, expiresAt, input.userAgent ?? "", input.ip ?? ""],
  );
  run("update users set last_login_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?", [user.tenantId, user.id]);
  return { token, expiresAt, user: stripPassword(user) };
}

export function loginWithPassword(input: { mobile: string; password: string; tenantCode?: string; userAgent?: string; ip?: string }): AuthSessionRow | undefined {
  // 按手机号匹配激活租户下的用户（同一手机号多租户时取最近登录的租户；登录后可选租户）
  const user = findAuthUserByMobile(input.mobile, input.tenantCode);
  if (!user || user.status !== "active" || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) return undefined;
  return createSessionForUser(user, input);
}

/** 查询同一手机号可登录的所有激活租户（切换企业列表） */
export function listTenantsByMobile(mobile: string) {
  return all<{ id: string; name: string; code: string; status: string }>(
    `select distinct t.id, t.name, t.code, t.status
     from users u
     inner join tenants t on t.id = u.tenant_id and t.deleted_at is null and t.status = 'active'
     where u.mobile = ? and u.deleted_at is null and u.status = 'active'
     order by t.name, t.code`,
    [mobile],
  );
}

/** 切换企业：直接为当前手机号在目标租户下创建新会话（免重复输密码） */
export function switchTenantSession(input: { mobile: string; tenantCode: string; userAgent?: string; ip?: string }): AuthSessionRow | undefined {
  const user = findAuthUserByMobile(input.mobile, input.tenantCode);
  if (!user || user.status !== "active") return undefined;
  return createSessionForUser(user, input);
}

export function getUserBySessionToken(token: string): AuthUserRow | undefined {
  if (!token) return undefined;
  const tokenHash = hashSessionToken(token);
  const user = selectAuthUserWhere(
    `u.id = (
       select s.user_id from user_sessions s
       where s.token_hash = ? and s.revoked_at is null and datetime(s.expires_at) > datetime('now')
       limit 1
     )`,
    [tokenHash],
  );
  if (!user) return undefined;
  run("update user_sessions set last_seen_at = datetime('now') where token_hash = ?", [tokenHash]);
  return stripPassword(user);
}

export function revokeSessionToken(token: string) {
  if (!token) return { revoked: 0 };
  const result = run("update user_sessions set revoked_at = datetime('now') where token_hash = ? and revoked_at is null", [hashSessionToken(token)]);
  return { revoked: result.changes };
}

function parseTenantQuota(raw?: string | null) {
  const fallback = { sceneLimit: 50, aiTokenLimit: 100000, sttSeconds: 3600, ttsCharacters: 100000, userLimit: 100, storageMb: 1024 };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<typeof fallback>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function getTenantSettings(tenantId: string) {
  const row = get<TenantRow>(
    "select id, name, code, status, plan_code as planCode, expire_at as expireAt, resource_quota_json as resourceQuotaJson from tenants where id = ? and deleted_at is null limit 1",
    [tenantId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status,
    planCode: row.planCode || "trial",
    expireAt: row.expireAt ?? null,
    resourceQuota: parseTenantQuota(row.resourceQuotaJson),
  } satisfies TenantSettingsRow;
}

export function updateTenantSettings(
  tenantId: string,
  input: {
    name: string;
    planCode: string;
    expireAt?: string | null;
    resourceQuota: { sceneLimit: number; aiTokenLimit: number; sttSeconds: number; ttsCharacters: number; userLimit: number; storageMb: number };
  },
) {
  run(
    `update tenants set name = ?, plan_code = ?, expire_at = ?, resource_quota_json = ?, updated_at = datetime('now')
     where id = ? and deleted_at is null`,
    [input.name, input.planCode, input.expireAt ?? null, JSON.stringify(input.resourceQuota), tenantId],
  );
  return getTenantSettings(tenantId);
}
export function getDashboardOverview(tenantId: string, tenantName: string, userId?: string) {
  const industryPackageCount = get<{ count: number }>(
    "select count(*) as count from industry_packages where tenant_id = ? and deleted_at is null",
    [tenantId],
  )?.count ?? 0;
  const sceneCount = get<{ count: number }>("select count(*) as count from scenes where tenant_id = ? and deleted_at is null", [tenantId])?.count ?? 0;
  const publishedTaskCount = get<{ count: number }>(
    "select count(*) as count from tasks where tenant_id = ? and status = 'published' and deleted_at is null",
    [tenantId],
  )?.count ?? 0;
  const completedTaskCount = get<{ count: number }>(
    "select count(*) as count from tasks where tenant_id = ? and status = 'completed' and deleted_at is null",
    [tenantId],
  )?.count ?? 0;
  const trainingRecordCount = get<{ count: number }>(
    "select count(*) as count from training_records where tenant_id = ? and deleted_at is null",
    [tenantId],
  )?.count ?? 0;
  const passedTrainingRecordCount = get<{ count: number }>(
    "select count(*) as count from training_records where tenant_id = ? and status = 'completed' and score >= 80 and deleted_at is null",
    [tenantId],
  )?.count ?? 0;
  const avgScore = get<{ value: number | null }>(
    "select avg(score) as value from training_records where tenant_id = ? and deleted_at is null",
    [tenantId],
  )?.value ?? 0;
  const examAttemptStats = get<{ count: number; passCount: number }>(
    `select count(*) as count,
            sum(case when status in ('passed', 'completed') or (score is not null and score >= total_score * 0.6) then 1 else 0 end) as passCount
     from exam_attempts
     where tenant_id = ? and deleted_at is null and status not in ('pending', 'in_progress')`,
    [tenantId],
  );
  const aiUsage = get<{ tokenCount: number | null; sttSeconds: number | null }>(
    "select sum(tokens) as tokenCount, sum(audio_seconds) as sttSeconds from ai_call_logs where tenant_id = ? and deleted_at is null",
    [tenantId],
  );
  const pendingAppeals = get<{ count: number }>(
    "select count(*) as count from appeals where tenant_id = ? and status = 'pending' and deleted_at is null",
    [tenantId],
  )?.count ?? 0;
  const draftTasks = get<{ count: number }>(
    "select count(*) as count from tasks where tenant_id = ? and status = 'draft' and deleted_at is null",
    [tenantId],
  )?.count ?? 0;
  const modelTodo = get<{ count: number }>(
    "select count(*) as count from ai_provider_configs where tenant_id = ? and provider_type = 'llm' and (status <> 'enabled' or base_url = '' or api_key_encrypted = '') and deleted_at is null",
    [tenantId],
  )?.count ?? 0;

  // 用户视角字段
  const pendingTaskCount = userId ? (get<{ count: number }>(
    `select count(*) as count from task_participants tp
     join tasks t on t.id = tp.task_id and t.tenant_id = tp.tenant_id
     where tp.tenant_id = ? and tp.user_id = ? and tp.status != 'completed' and t.deleted_at is null`,
    [tenantId, userId],
  )?.count ?? 0) : 0;

  const completedCounts = userId ? get<{ taskCount: number; recordCount: number }>(
    `select
      (select count(*) from task_participants tp join tasks t on t.id = tp.task_id
       where tp.tenant_id = ? and tp.user_id = ? and tp.status = 'completed' and t.deleted_at is null) as taskCount,
      (select count(*) from training_records
       where tenant_id = ? and user_id = ? and status = 'completed' and deleted_at is null) as recordCount`,
    [tenantId, userId, tenantId, userId],
  ) : null;

  const points = completedCounts ? (completedCounts.taskCount + completedCounts.recordCount) * 10 : 0;

  const studyDurationHours = userId ? ((get<{ value: number }>(
    `select count(*) as value from training_records where tenant_id = ? and user_id = ? and status = 'completed' and deleted_at is null`,
    [tenantId, userId],
  )?.value ?? 0) * 8 / 60) : 0;

  const monthProgress = completedCounts ? Math.min(100, Math.round((completedCounts.taskCount + completedCounts.recordCount) / 25 * 100)) : 0;

  return {
    tenantName,
    industryPackageCount,
    sceneCount,
    publishedTaskCount,
    completedTaskCount,
    trainingRecordCount,
    trainingPassRate: trainingRecordCount ? Math.round((passedTrainingRecordCount / trainingRecordCount) * 100) : 0,
    examAttemptCount: examAttemptStats?.count ?? 0,
    examPassRate: examAttemptStats?.count ? Math.round(((examAttemptStats.passCount ?? 0) / examAttemptStats.count) * 100) : 0,
    averageTrainingScore: Math.round(avgScore),
    aiUsage: {
      tokenCount: aiUsage?.tokenCount ?? 0,
      sttSeconds: aiUsage?.sttSeconds ?? 0,
      ttsCharacters: 0,
    },
    todos: [
      { label: "待处理申诉", count: pendingAppeals, href: "/appeals" },
      { label: "待配置模型", count: modelTodo, href: "/settings/ai" },
      { label: "待发布任务", count: draftTasks, href: "/tasks" },
    ],
    pendingTaskCount,
    studyDurationHours,
    points,
    monthProgress,
  };
}

export function getOrganization(tenantId: string, orgId?: string | null) {
  if (!orgId) return undefined;
  return get<OrganizationRow>(
    `select o.id, o.parent_id as parentId, p.name as parentName, o.code, o.name, o.type, o.sort_order as sortOrder,
            count(u.id) as userCount, o.created_at as createdAt
     from organizations o
     left join organizations p on p.id = o.parent_id and p.tenant_id = o.tenant_id
     left join users u on u.org_id = o.id and u.tenant_id = o.tenant_id and u.deleted_at is null
     where o.tenant_id = ? and o.id = ? and o.deleted_at is null
     group by o.id limit 1`,
    [tenantId, orgId],
  );
}

export function listOrganizations(tenantId: string, options: { page: number; pageSize: number; keyword?: string; type?: string }) {
  const filters = ["o.tenant_id = ?", "o.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.type) {
    filters.push("o.type = ?");
    params.push(options.type);
  }
  if (options.keyword) {
    filters.push("(o.name like ? or o.code like ? or p.name like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`, `%${options.keyword}%`);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(
    `select count(*) as count
     from organizations o
     left join organizations p on p.id = o.parent_id and p.tenant_id = o.tenant_id
     where ${where}`,
    params,
  )?.count ?? 0;
  const items = all<OrganizationRow>(
    `select o.id, o.parent_id as parentId, p.name as parentName, o.code, o.name, o.type, o.sort_order as sortOrder,
            count(u.id) as userCount, o.created_at as createdAt
     from organizations o
     left join organizations p on p.id = o.parent_id and p.tenant_id = o.tenant_id
     left join users u on u.org_id = o.id and u.tenant_id = o.tenant_id and u.deleted_at is null
     where ${where}
     group by o.id
     order by o.sort_order asc, o.created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createOrganization(
  tenantId: string,
  input: { name: string; code: string; type: string; parentId?: string | null; sortOrder?: number },
) {
  if (input.parentId) {
    const parent = getOrganization(tenantId, input.parentId);
    if (!parent) return undefined;
  }
  const id = createId("org");
  run(
    `insert into organizations (id, tenant_id, parent_id, code, name, type, sort_order, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.parentId ?? null, input.code, input.name, input.type, input.sortOrder ?? 0],
  );
  return getOrganization(tenantId, id);
}

export function updateOrganization(
  tenantId: string,
  id: string,
  input: { name?: string; code?: string; type?: string; parentId?: string | null; sortOrder?: number },
) {
  const existing = get<OrganizationRow>(
    `select o.id, o.parent_id as parentId, p.name as parentName, o.code, o.name, o.type, o.sort_order as sortOrder,
            count(u.id) as userCount, o.created_at as createdAt
     from organizations o
     left join organizations p on p.id = o.parent_id and p.tenant_id = o.tenant_id
     left join users u on u.org_id = o.id and u.tenant_id = o.tenant_id and u.deleted_at is null
     where o.tenant_id = ? and o.id = ? and o.deleted_at is null
     group by o.id limit 1`,
    [tenantId, id],
  );
  if (!existing) return undefined;
  // 校验新的上级组织存在，且不能把自己或自己的后代设为上级（避免成环）
  const parentId = input.parentId === undefined ? existing.parentId : input.parentId || null;
  if (parentId && parentId !== id) {
    const parent = getOrganization(tenantId, parentId);
    if (!parent) return undefined;
    let cursor: string | null | undefined = parent.parentId;
    while (cursor) {
      if (cursor === id) return undefined;
      const ancestor = getOrganization(tenantId, cursor);
      cursor = ancestor?.parentId ?? null;
    }
  }
  run(
    `update organizations set name = ?, code = ?, type = ?, parent_id = ?, sort_order = ?, updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [
      input.name ?? existing.name,
      input.code ?? existing.code,
      input.type ?? existing.type,
      parentId,
      input.sortOrder ?? existing.sortOrder,
      tenantId,
      id,
    ],
  );
  return getOrganization(tenantId, id);
}

export function deleteOrganization(tenantId: string, id: string): "ok" | "NOT_FOUND" | "HAS_CHILDREN" | "HAS_MEMBERS" {
  const existing = getOrganization(tenantId, id);
  if (!existing) return "NOT_FOUND";
  const children = get<{ count: number }>(
    `select count(*) as count from organizations where tenant_id = ? and parent_id = ? and deleted_at is null`,
    [tenantId, id],
  )?.count ?? 0;
  if (children > 0) return "HAS_CHILDREN";
  const members = get<{ count: number }>(
    `select count(*) as count from users where tenant_id = ? and org_id = ? and deleted_at is null`,
    [tenantId, id],
  )?.count ?? 0;
  if (members > 0) return "HAS_MEMBERS";
  run(`update organizations set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?`, [tenantId, id]);
  return "ok";
}
export function listUsers(tenantId: string, options: { page: number; pageSize: number; keyword?: string; status?: string; roleCode?: string }) {
  const filters = ["u.tenant_id = ?", "u.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("u.status = ?");
    params.push(options.status);
  }
  if (options.roleCode) {
    filters.push("u.role_code = ?");
    params.push(options.roleCode);
  }
  if (options.keyword) {
    filters.push("(u.name like ? or u.mobile like ? or u.role_code like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`, `%${options.keyword}%`);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(`select count(*) as count from users u where ${where}`, params)?.count ?? 0;
  const items = all<UserRow>(
    `select u.id, u.name, u.mobile, u.email, u.role_code as roleCode, u.status, u.org_id as orgId, o.name as orgName
     from users u
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where ${where} order by u.created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createUser(
  tenantId: string,
  input: { name: string; mobile: string; email?: string; roleCode: string; orgId?: string | null; initialPassword: string },
) {
  const id = createId("user");
  run(
    `insert into users (id, tenant_id, org_id, name, mobile, email, role_code, status, password_hash, password_must_change, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, 'active', ?, 1, datetime('now'), datetime('now'))`,
    [id, tenantId, input.orgId ?? null, input.name, input.mobile, input.email || null, input.roleCode, hashPassword(input.initialPassword)],
  );
  return get<UserRow>(
    `select u.id, u.name, u.mobile, u.email, u.role_code as roleCode, u.status, u.org_id as orgId, o.name as orgName
     from users u
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where u.tenant_id = ? and u.id = ?`,
    [tenantId, id],
  );
}

export function updateUser(
  tenantId: string,
  id: string,
  input: { name?: string; mobile?: string; email?: string; roleCode?: string; orgId?: string | null; status?: string },
) {
  const existing = get<UserRow>(
    `select u.id, u.name, u.mobile, u.email, u.role_code as roleCode, u.status, u.org_id as orgId, o.name as orgName
     from users u
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where u.tenant_id = ? and u.id = ? and u.deleted_at is null limit 1`,
    [tenantId, id],
  );
  if (!existing) return undefined;
  const orgId = input.orgId === undefined ? existing.orgId : input.orgId || null;
  run(
    `update users set name = ?, mobile = ?, email = ?, role_code = ?, org_id = ?, status = ?, updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [
      input.name ?? existing.name,
      input.mobile ?? existing.mobile,
      input.email === undefined ? existing.email : input.email || null,
      input.roleCode ?? existing.roleCode,
      orgId,
      input.status ?? existing.status,
      tenantId,
      id,
    ],
  );
  return get<UserRow>(
    `select u.id, u.name, u.mobile, u.email, u.role_code as roleCode, u.status, u.org_id as orgId, o.name as orgName
     from users u
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where u.tenant_id = ? and u.id = ?`,
    [tenantId, id],
  );
}

export function deleteUser(tenantId: string, id: string) {
  run(`update users set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?`, [tenantId, id]);
}

export function resetUserPassword(tenantId: string, id: string, newPassword: string) {
  const existing = get<{ id: string }>(
    `select id from users where tenant_id = ? and id = ? and deleted_at is null limit 1`,
    [tenantId, id],
  );
  if (!existing) return undefined;
  run(
    `update users set password_hash = ?, password_must_change = 1, updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [hashPassword(newPassword), tenantId, id],
  );
  return existing;
}

export function listIndustryPackages(tenantId: string, options: { page: number; pageSize: number; keyword?: string; status?: string }) {
  const filters = ["tenant_id = ?", "deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("status = ?");
    params.push(options.status);
  }
  if (options.keyword) {
    filters.push("(name like ? or code like ? or target_roles like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`, `%${options.keyword}%`);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(`select count(*) as count from industry_packages where ${where}`, params)?.count ?? 0;
  const items = all<IndustryPackageRow>(
    `select id, name, code, industry_type as industryType, target_roles as targetRoles, status, version, is_system_template as isSystemTemplate, description
     from industry_packages where ${where}
     order by is_system_template desc, created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function getIndustryPackage(tenantId: string, id?: string | null) {
  if (!id) return undefined;
  return get<IndustryPackageRow>(
    `select id, name, code, industry_type as industryType, target_roles as targetRoles, status, version, is_system_template as isSystemTemplate, description
     from industry_packages where tenant_id = ? and id = ? and deleted_at is null limit 1`,
    [tenantId, id],
  );
}

export function createIndustryPackage(tenantId: string, input: { name: string; code: string; industryType: string; targetRoles: string; description?: string }) {
  const id = createId("ind");
  run(
    `insert into industry_packages (id, tenant_id, name, code, industry_type, target_roles, description, status, version, is_system_template, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, 'enabled', '1.0.0', 0, datetime('now'), datetime('now'))`,
    [id, tenantId, input.name, input.code, input.industryType, input.targetRoles, input.description ?? ""],
  );
  return get<IndustryPackageRow>(
    "select id, name, code, industry_type as industryType, target_roles as targetRoles, status, version, is_system_template as isSystemTemplate, description from industry_packages where id = ?",
    [id],
  );
}

export function getCapabilityModel(tenantId: string, modelId: string) {
  const model = get<Omit<CapabilityModelRow, "items">>(
    `select cm.id, cm.industry_package_id as industryPackageId, ip.name as industryPackageName,
            cm.name, cm.description, cm.pass_score as passScore, cm.created_at as createdAt,
            count(ci.id) as itemCount, coalesce(sum(ci.weight), 0) as weightTotal
     from capability_models cm
     left join industry_packages ip on ip.id = cm.industry_package_id and ip.tenant_id = cm.tenant_id
     left join capability_items ci on ci.capability_model_id = cm.id and ci.tenant_id = cm.tenant_id and ci.deleted_at is null
     where cm.tenant_id = ? and cm.id = ? and cm.deleted_at is null
     group by cm.id limit 1`,
    [tenantId, modelId],
  );
  if (!model) return undefined;
  const items = all<CapabilityItemRow>(
    `select id, name, weight, score_desc as scoreDesc, risk_tag as riskTag
     from capability_items where tenant_id = ? and capability_model_id = ? and deleted_at is null order by created_at asc`,
    [tenantId, modelId],
  );
  return { ...model, items };
}

export function listCapabilityModels(tenantId: string, options: { page: number; pageSize: number; keyword?: string; industryPackageId?: string }) {
  const filters = ["cm.tenant_id = ?", "cm.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.industryPackageId) {
    filters.push("cm.industry_package_id = ?");
    params.push(options.industryPackageId);
  }
  if (options.keyword) {
    filters.push("(cm.name like ? or cm.description like ? or ip.name like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`, `%${options.keyword}%`);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(
    `select count(*) as count
     from capability_models cm
     left join industry_packages ip on ip.id = cm.industry_package_id and ip.tenant_id = cm.tenant_id
     where ${where}`,
    params,
  )?.count ?? 0;
  const rows = all<Omit<CapabilityModelRow, "items">>(
    `select cm.id, cm.industry_package_id as industryPackageId, ip.name as industryPackageName,
            cm.name, cm.description, cm.pass_score as passScore, cm.created_at as createdAt,
            count(ci.id) as itemCount, coalesce(sum(ci.weight), 0) as weightTotal
     from capability_models cm
     left join industry_packages ip on ip.id = cm.industry_package_id and ip.tenant_id = cm.tenant_id
     left join capability_items ci on ci.capability_model_id = cm.id and ci.tenant_id = cm.tenant_id and ci.deleted_at is null
     where ${where}
     group by cm.id
     order by cm.created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  const items = rows.map((row) => ({
    ...row,
    items: all<CapabilityItemRow>(
      `select id, name, weight, score_desc as scoreDesc, risk_tag as riskTag
       from capability_items where tenant_id = ? and capability_model_id = ? and deleted_at is null order by created_at asc`,
      [tenantId, row.id],
    ),
  }));
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createCapabilityModel(
  tenantId: string,
  input: {
    industryPackageId: string;
    name: string;
    description?: string;
    passScore: number;
    items: Array<{ name: string; weight: number; scoreDesc?: string; riskTag?: string }>;
  },
) {
  const industry = getIndustryPackage(tenantId, input.industryPackageId);
  if (!industry) return undefined;
  const id = createId("cap");
  run(
    `insert into capability_models (id, tenant_id, industry_package_id, name, description, pass_score, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.industryPackageId, input.name, input.description ?? "", input.passScore],
  );
  input.items.forEach((item) => {
    run(
      `insert into capability_items (id, tenant_id, capability_model_id, name, weight, score_desc, risk_tag, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [createId("capitem"), tenantId, id, item.name, item.weight, item.scoreDesc ?? "", item.riskTag ?? ""],
    );
  });
  return getCapabilityModel(tenantId, id);
}
export function listScenes(tenantId: string, options: { page: number; pageSize: number; keyword?: string; status?: string; mode?: string; createMode?: string; orgId?: string }) {
  const filters = ["s.tenant_id = ?", "s.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("s.status = ?");
    params.push(options.status);
  }
  if (options.mode) {
    filters.push("s.mode = ?");
    params.push(options.mode);
  }
  if (options.createMode) {
    filters.push("s.create_mode = ?");
    params.push(options.createMode);
  }
  if (options.keyword) {
    filters.push("(s.name like ? or s.code like ? or s.scene_type like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`, `%${options.keyword}%`);
  }
  if (options.orgId) {
    filters.push("u.org_id = ?");
    params.push(options.orgId);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(
    `select count(*) as count from scenes s
     left join users u on u.id = s.created_by and u.tenant_id = s.tenant_id
     where ${where}`,
    params,
  )?.count ?? 0;
  const items = all<SceneRow>(
    `select s.id, s.name, s.code, s.industry_package_id as industryPackageId, ip.name as industryPackageName,
            s.scene_type as sceneType, s.mode, coalesce(s.create_mode, 'ai_practice') as createMode, s.status,
            s.is_template as isTemplate, s.source_type as sourceType, s.description, coalesce(s.pass_score, 80) as passScore,
            s.created_at as createdAt, s.updated_at as updatedAt, u.name as creatorName, o.name as creatorOrgName,
            (select count(*) from task_scenes ts where ts.tenant_id = s.tenant_id and ts.scene_id = s.id and ts.deleted_at is null) as taskCount
     from scenes s
     left join industry_packages ip on ip.id = s.industry_package_id and ip.tenant_id = s.tenant_id
     left join users u on u.id = s.created_by and u.tenant_id = s.tenant_id
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where ${where} order by s.is_template desc, s.created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createScene(tenantId: string, input: { industryPackageId?: string | null; name: string; code: string; mode: string; createMode?: string; createdBy?: string | null; sceneType: string; description: string; aiRole?: { identity: string; background: string; personality: string; emotion: string; languageStyle?: string; goal: string }; learnerRole?: { identity: string; goal: string }; endCondition?: string; interruptCondition?: string; dialogueExample?: string; initiator?: string; scoringRules?: Array<{ name: string; score: number; criteria: string; deductionRule: string; evidenceRequired: string }> }) {
  const id = createId("scene");
  run(
    `insert into scenes (id, tenant_id, industry_package_id, name, code, mode, create_mode, scene_type, description, status, source_type, is_template, version, created_by, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'manual', 0, '1.0.0', ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.industryPackageId ?? null, input.name, input.code, input.mode, input.createMode ?? "ai_practice", input.sceneType, input.description, input.createdBy ?? null],
  );
  // AI 角色
  if (input.aiRole?.identity) {
    run(
      `insert into scene_roles (id, tenant_id, scene_id, role_type, identity, background, personality, emotion, language_style, goal, created_at, updated_at)
       values (?, ?, ?, 'ai', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [createId("role"), tenantId, id, input.aiRole.identity, input.aiRole.background || "", input.aiRole.personality || "", input.aiRole.emotion || "", input.aiRole.languageStyle || "", input.aiRole.goal || ""],
    );
  }
  // 学员角色
  if (input.learnerRole?.identity) {
    run(
      `insert into scene_roles (id, tenant_id, scene_id, role_type, identity, goal, created_at, updated_at)
       values (?, ?, ?, 'learner', ?, ?, datetime('now'), datetime('now'))`,
      [createId("role"), tenantId, id, input.learnerRole.identity, input.learnerRole.goal || ""],
    );
  }
  // 对话规则（结束/中断条件/发起人）
  if (input.endCondition || input.interruptCondition) {
    run(
      `insert into scene_rules (id, tenant_id, scene_id, initiator, end_condition, interrupt_condition, description, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [createId("rule"), tenantId, id, input.initiator || "ai", input.endCondition || "", input.interruptCondition || "", input.dialogueExample || ""],
    );
  }
  // 评分规则
  input.scoringRules?.forEach((rule, index) => {
    run(
      `insert into scoring_rules (id, tenant_id, scene_id, name, score, criteria, deduction_rule, evidence_required, sort_order, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [createId("score"), tenantId, id, rule.name, rule.score, rule.criteria, rule.deductionRule, rule.evidenceRequired, index + 1],
    );
  });
  return get<SceneRow>(
    "select id, name, code, industry_package_id as industryPackageId, scene_type as sceneType, mode, coalesce(create_mode, 'ai_practice') as createMode, status, is_template as isTemplate, source_type as sourceType, description, coalesce(pass_score, 80) as passScore, created_at as createdAt from scenes where id = ?",
    [id],
  );
}

export function createGeneratedScene(tenantId: string, input: GeneratedSceneInput) {
  const id = createId("scene");
  const safeCode = input.code || `AI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  run(
    `insert into scenes (id, tenant_id, industry_package_id, name, code, mode, create_mode, scene_type, description, status, source_type, is_template, version, created_by, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, 0, '1.0.0', ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.industryPackageId ?? null, input.name, safeCode, input.mode, input.createMode ?? "ai_practice", input.sceneType, input.description, input.sourceType, input.createdBy ?? null],
  );
  run(
    `insert into scene_roles (id, tenant_id, scene_id, role_type, identity, background, personality, emotion, language_style, goal, created_at, updated_at)
     values (?, ?, ?, 'ai', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [createId("role"), tenantId, id, input.aiRole.identity, input.aiRole.background, input.aiRole.personality, input.aiRole.emotion, input.aiRole.languageStyle || "", input.aiRole.goal],
  );
  run(
    `insert into scene_roles (id, tenant_id, scene_id, role_type, identity, goal, created_at, updated_at)
     values (?, ?, ?, 'learner', ?, ?, datetime('now'), datetime('now'))`,
    [createId("role"), tenantId, id, input.learnerRole.identity, input.learnerRole.goal],
  );
  run(
    `insert into scene_rules (id, tenant_id, scene_id, initiator, end_condition, interrupt_condition, description, created_at, updated_at)
     values (?, ?, ?, 'ai', ?, ?, ?, datetime('now'), datetime('now'))`,
    [createId("rule"), tenantId, id, input.endCondition, input.interruptCondition, input.description],
  );
  input.scoringRules.forEach((rule, index) => {
    run(
      `insert into scoring_rules (id, tenant_id, scene_id, name, score, criteria, deduction_rule, evidence_required, sort_order, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [createId("score"), tenantId, id, rule.name, rule.score, rule.criteria, rule.deductionRule, rule.evidenceRequired, index + 1],
    );
  });

  return get<SceneRow>(
    "select id, name, code, industry_package_id as industryPackageId, scene_type as sceneType, mode, coalesce(create_mode, 'ai_practice') as createMode, status, is_template as isTemplate, source_type as sourceType, description, coalesce(pass_score, 80) as passScore, created_at as createdAt from scenes where id = ?",
    [id],
  );
}

export function getSceneDetail(tenantId: string, sceneId: string): SceneDetail | undefined {
  const scene = get<SceneRow & { industryPackageName: string | null }>(
    `select s.id, s.name, s.code, s.industry_package_id as industryPackageId, ip.name as industryPackageName,
            s.scene_type as sceneType, s.mode, coalesce(s.create_mode, 'ai_practice') as createMode, s.status, s.is_template as isTemplate, s.source_type as sourceType, s.description,
            coalesce(s.pass_score, 80) as passScore, s.created_at as createdAt, s.updated_at as updatedAt,
            u.name as creatorName, o.name as creatorOrgName,
            (select count(*) from task_scenes ts where ts.tenant_id = s.tenant_id and ts.scene_id = s.id and ts.deleted_at is null) as taskCount
     from scenes s
     left join industry_packages ip on ip.id = s.industry_package_id and ip.tenant_id = s.tenant_id
     left join users u on u.id = s.created_by and u.tenant_id = s.tenant_id
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where s.tenant_id = ? and s.id = ? and s.deleted_at is null limit 1`,
    [tenantId, sceneId],
  );
  if (!scene) return undefined;
  const roles = all<SceneRoleRow>(
    `select id, role_type as roleType, identity, background, personality, emotion, coalesce(language_style, '') as languageStyle, goal
     from scene_roles where tenant_id = ? and scene_id = ? and deleted_at is null order by role_type asc, created_at asc`,
    [tenantId, sceneId],
  );
  const rule = get<SceneRuleRow>(
    `select id, initiator, end_condition as endCondition, interrupt_condition as interruptCondition, description
     from scene_rules where tenant_id = ? and scene_id = ? and deleted_at is null limit 1`,
    [tenantId, sceneId],
  ) ?? null;
  const scoringRules = all<ScoringRuleRow>(
    `select id, name, score, criteria, deduction_rule as deductionRule, evidence_required as evidenceRequired, sort_order as sortOrder
     from scoring_rules where tenant_id = ? and scene_id = ? and deleted_at is null order by sort_order asc, created_at asc`,
    [tenantId, sceneId],
  );
  const materials = all<MaterialRow>(
    `select m.id, m.name, m.type, m.industry_package_id as industryPackageId, ip.name as industryPackageName,
            m.scene_id as sceneId, s.name as sceneName, m.tags, m.status, m.content, m.created_at as createdAt
     from materials m
     left join industry_packages ip on ip.id = m.industry_package_id and ip.tenant_id = m.tenant_id
     left join scenes s on s.id = m.scene_id and s.tenant_id = m.tenant_id
     where m.tenant_id = ? and m.scene_id = ? and m.deleted_at is null order by m.created_at desc`,
    [tenantId, sceneId],
  );
  return { scene, roles, rule, scoringRules, materials };
}

export function replaceSceneScoringRules(
  tenantId: string,
  sceneId: string,
  rules: Array<{ name: string; score: number; criteria: string; deductionRule?: string; evidenceRequired?: string }>,
) {
  run(
    `update scoring_rules set deleted_at = datetime('now'), updated_at = datetime('now')
     where tenant_id = ? and scene_id = ? and deleted_at is null`,
    [tenantId, sceneId],
  );
  rules.forEach((rule, index) => {
    run(
      `insert into scoring_rules (id, tenant_id, scene_id, name, score, criteria, deduction_rule, evidence_required, sort_order, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [createId("score"), tenantId, sceneId, rule.name, rule.score, rule.criteria, rule.deductionRule ?? "", rule.evidenceRequired ?? "", index + 1],
    );
  });
  return getSceneDetail(tenantId, sceneId);
}
export function updateSceneStatus(tenantId: string, sceneId: string, status: "draft" | "published" | "disabled") {
  run("update scenes set status = ?, updated_at = datetime('now') where tenant_id = ? and id = ? and deleted_at is null", [status, tenantId, sceneId]);
  return get<SceneRow>(
    "select id, name, code, industry_package_id as industryPackageId, scene_type as sceneType, mode, coalesce(create_mode, 'ai_practice') as createMode, status, is_template as isTemplate, source_type as sourceType, description, coalesce(pass_score, 80) as passScore from scenes where tenant_id = ? and id = ?",
    [tenantId, sceneId],
  );
}

export function updateSceneDetail(
  tenantId: string,
  sceneId: string,
  input: {
    name?: string;
    description?: string;
    aiRole?: { identity: string; background: string; personality: string; emotion: string; languageStyle?: string; goal: string };
    learnerRole?: { identity: string; goal: string };
    endCondition?: string;
    interruptCondition?: string;
    dialogueExample?: string;
    initiator?: string;
    scoringRules?: Array<{ name: string; score: number; criteria: string; deductionRule?: string; evidenceRequired?: string }>;
  },
): SceneDetail | undefined {
  const exists = get<{ id: string }>(
    "select id from scenes where tenant_id = ? and id = ? and deleted_at is null limit 1",
    [tenantId, sceneId],
  );
  if (!exists) return undefined;
  run("update scenes set updated_at = datetime('now') where tenant_id = ? and id = ?", [tenantId, sceneId]);
  if (input.name !== undefined || input.description !== undefined) {
    const scene = get<{ name: string; description: string }>(
      "select name, description from scenes where id = ?", [sceneId],
    ) ?? { name: "", description: "" };
    run(
      "update scenes set name = ?, description = ?, updated_at = datetime('now') where tenant_id = ? and id = ?",
      [input.name ?? scene.name, input.description ?? scene.description, tenantId, sceneId],
    );
  }
  // 角色：整体替换（先软删旧角色，再按当前表单插入）
  if (input.aiRole !== undefined || input.learnerRole !== undefined) {
    run(
      "update scene_roles set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and scene_id = ? and deleted_at is null",
      [tenantId, sceneId],
    );
    if (input.aiRole?.identity) {
      run(
        `insert into scene_roles (id, tenant_id, scene_id, role_type, identity, background, personality, emotion, language_style, goal, created_at, updated_at)
         values (?, ?, ?, 'ai', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [createId("role"), tenantId, sceneId, input.aiRole.identity, input.aiRole.background || "", input.aiRole.personality || "", input.aiRole.emotion || "", input.aiRole.languageStyle || "", input.aiRole.goal || ""],
      );
    }
    if (input.learnerRole?.identity) {
      run(
        `insert into scene_roles (id, tenant_id, scene_id, role_type, identity, goal, created_at, updated_at)
         values (?, ?, ?, 'learner', ?, ?, datetime('now'), datetime('now'))`,
        [createId("role"), tenantId, sceneId, input.learnerRole.identity, input.learnerRole.goal || ""],
      );
    }
  }
  // 对话规则：整体替换（scene_rules 有 (tenant_id, scene_id) 唯一约束，必须物理删除旧记录再插入）
  if (input.endCondition !== undefined || input.interruptCondition !== undefined || input.dialogueExample !== undefined || input.initiator !== undefined) {
    const oldRule = get<{ initiator: string; endCondition: string; interruptCondition: string; description: string }>(
      "select initiator, end_condition as endCondition, interrupt_condition as interruptCondition, description from scene_rules where tenant_id = ? and scene_id = ? limit 1",
      [tenantId, sceneId],
    ) ?? { initiator: "ai", endCondition: "", interruptCondition: "", description: "" };
    run(
      "delete from scene_rules where tenant_id = ? and scene_id = ?",
      [tenantId, sceneId],
    );
    run(
      `insert into scene_rules (id, tenant_id, scene_id, initiator, end_condition, interrupt_condition, description, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        createId("rule"), tenantId, sceneId,
        input.initiator ?? oldRule.initiator,
        input.endCondition ?? oldRule.endCondition,
        input.interruptCondition ?? oldRule.interruptCondition,
        input.dialogueExample ?? oldRule.description,
      ],
    );
  }
  // 评分规则：整体替换
  if (input.scoringRules !== undefined) {
    run(
      "update scoring_rules set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and scene_id = ? and deleted_at is null",
      [tenantId, sceneId],
    );
    input.scoringRules.forEach((rule, index) => {
      run(
        `insert into scoring_rules (id, tenant_id, scene_id, name, score, criteria, deduction_rule, evidence_required, sort_order, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [createId("score"), tenantId, sceneId, rule.name, rule.score, rule.criteria, rule.deductionRule ?? "", rule.evidenceRequired ?? "", index + 1],
      );
    });
  }
  return getSceneDetail(tenantId, sceneId);
}

export function deleteScene(tenantId: string, sceneId: string): boolean {
  const result = run(
    "update scenes set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ? and deleted_at is null",
    [tenantId, sceneId],
  );
  return result.changes > 0;
}

export function batchDeleteScenes(tenantId: string, sceneIds: string[]): number {
  if (!sceneIds.length) return 0;
  const placeholders = sceneIds.map(() => "?").join(", ");
  const result = run(
    `update scenes set deleted_at = datetime('now'), updated_at = datetime('now')
     where tenant_id = ? and id in (${placeholders}) and deleted_at is null`,
    [tenantId, ...sceneIds],
  );
  return result.changes;
}

export function listMaterials(tenantId: string, options: { page: number; pageSize: number; keyword?: string; status?: string }) {
  const filters = ["m.tenant_id = ?", "m.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("m.status = ?");
    params.push(options.status);
  }
  if (options.keyword) {
    filters.push("(m.name like ? or m.type like ? or m.content like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`, `%${options.keyword}%`);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(`select count(*) as count from materials m where ${where}`, params)?.count ?? 0;
  const items = all<MaterialRow>(
    `select m.id, m.name, m.type, m.industry_package_id as industryPackageId, ip.name as industryPackageName,
            m.scene_id as sceneId, s.name as sceneName, m.tags, m.status, m.content, m.created_at as createdAt
     from materials m
     left join industry_packages ip on ip.id = m.industry_package_id and ip.tenant_id = m.tenant_id
     left join scenes s on s.id = m.scene_id and s.tenant_id = m.tenant_id
     where ${where}
     order by m.created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createMaterial(
  tenantId: string,
  input: { name: string; type: string; industryPackageId?: string | null; sceneId?: string | null; tags?: string[]; content: string },
) {
  const id = createId("mat");
  run(
    `insert into materials (id, tenant_id, name, type, industry_package_id, scene_id, tags, status, content, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.name, input.type, input.industryPackageId ?? null, input.sceneId ?? null, JSON.stringify(input.tags ?? []), input.content],
  );
  return get<MaterialRow>(
    `select m.id, m.name, m.type, m.industry_package_id as industryPackageId, ip.name as industryPackageName,
            m.scene_id as sceneId, s.name as sceneName, m.tags, m.status, m.content, m.created_at as createdAt
     from materials m
     left join industry_packages ip on ip.id = m.industry_package_id and ip.tenant_id = m.tenant_id
     left join scenes s on s.id = m.scene_id and s.tenant_id = m.tenant_id
     where m.tenant_id = ? and m.id = ?`,
    [tenantId, id],
  );
}

export function listTasks(
  tenantId: string,
  options: { page: number; pageSize: number; keyword?: string; status?: string; assigneeUserId?: string; assigneeOrgId?: string | null },
) {
  const filters = ["t.tenant_id = ?", "t.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("t.status = ?");
    params.push(options.status);
  }
  if (options.keyword) {
    filters.push("(t.name like ? or t.code like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`);
  }
  if (options.assigneeUserId) {
    const participantFilters = ["tp_scope.user_id = ?"];
    params.push(options.assigneeUserId);
    if (options.assigneeOrgId) {
      participantFilters.push("tp_scope.org_id = ?");
      params.push(options.assigneeOrgId);
    }
    filters.push(
      `exists (
        select 1 from task_participants tp_scope
        where tp_scope.tenant_id = t.tenant_id
          and tp_scope.task_id = t.id
          and tp_scope.deleted_at is null
          and (${participantFilters.join(" or ")})
      )`,
    );
  }
  const where = filters.join(" and ");
  const progressUserClause = options.assigneeUserId ? " and tr.user_id = ?" : "";
  const progressParams = options.assigneeUserId ? [options.assigneeUserId] : [];
  const total = get<{ count: number }>(`select count(*) as count from tasks t where ${where}`, params)?.count ?? 0;
  const items = all<Omit<TaskRow, "progressPercent">>(
    `select t.id, t.name, t.code, t.type, coalesce(t.description, '') as description, t.status,
            t.start_at as startAt, t.end_at as endAt, t.publish_at as publishAt, t.created_by as createdBy,
            (select max(tr.finished_at) from training_records tr where tr.tenant_id = t.tenant_id and tr.task_id = t.id and tr.status = 'completed' and tr.deleted_at is null${progressUserClause}) as completedAt,
            u.name as creatorName, o.name as creatorOrgName,
            (select count(*) from task_participants tp where tp.tenant_id = t.tenant_id and tp.task_id = t.id and tp.deleted_at is null) as participantCount,
            (select count(*) from task_scenes ts where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null) as sceneCount,
            (select count(distinct tr.scene_id) from training_records tr where tr.tenant_id = t.tenant_id and tr.task_id = t.id and tr.status = 'completed' and tr.deleted_at is null${progressUserClause}) as completedSceneCount,
            (select s.scene_type from task_scenes ts left join scenes s on s.id = ts.scene_id and s.tenant_id = ts.tenant_id where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null order by ts.sort_order asc limit 1) as primarySceneType,
            (select s.mode from task_scenes ts left join scenes s on s.id = ts.scene_id and s.tenant_id = ts.tenant_id where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null order by ts.sort_order asc limit 1) as primaryMode
     from tasks t
     left join users u on u.id = t.created_by and u.tenant_id = t.tenant_id
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where ${where} order by t.created_at desc limit ? offset ?`,
    [...progressParams, ...progressParams, ...params, options.pageSize, (options.page - 1) * options.pageSize],
  ).map((task) => {
    const sceneCount = Number(task.sceneCount || 0);
    const completedSceneCount = Math.min(Number(task.completedSceneCount || 0), sceneCount);
    return {
      ...task,
      sceneCount,
      completedSceneCount,
      participantCount: Number(task.participantCount || 0),
      progressPercent: task.status === "completed" ? 100 : sceneCount ? Math.round((completedSceneCount / sceneCount) * 100) : 0,
    };
  });
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function getTaskDetail(
  tenantId: string,
  taskId: string,
  options: { viewerUserId?: string; viewerOrgId?: string | null } = {},
): TaskDetail | undefined {
  const taskFilters = ["t.tenant_id = ?", "t.id = ?", "t.deleted_at is null"];
  const taskParams: unknown[] = [tenantId, taskId];
  if (options.viewerUserId) {
    const participantFilters = ["tp_scope.user_id = ?"];
    taskParams.push(options.viewerUserId);
    if (options.viewerOrgId) {
      participantFilters.push("tp_scope.org_id = ?");
      taskParams.push(options.viewerOrgId);
    }
    taskFilters.push(
      `exists (
        select 1 from task_participants tp_scope
        where tp_scope.tenant_id = t.tenant_id
          and tp_scope.task_id = t.id
          and tp_scope.deleted_at is null
          and (${participantFilters.join(" or ")})
      )`,
    );
  }
  const progressUserClause = options.viewerUserId ? " and tr.user_id = ?" : "";
  const progressParams = options.viewerUserId ? [options.viewerUserId] : [];
  const rawTask = get<Omit<TaskRow, "progressPercent">>(
    `select t.id, t.name, t.code, t.type, coalesce(t.description, '') as description, t.status,
            t.start_at as startAt, t.end_at as endAt, t.publish_at as publishAt, t.created_by as createdBy,
            (select max(tr.finished_at) from training_records tr where tr.tenant_id = t.tenant_id and tr.task_id = t.id and tr.status = 'completed' and tr.deleted_at is null${progressUserClause}) as completedAt,
            u.name as creatorName, o.name as creatorOrgName,
            (select count(*) from task_participants tp where tp.tenant_id = t.tenant_id and tp.task_id = t.id and tp.deleted_at is null) as participantCount,
            (select count(*) from task_scenes ts where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null) as sceneCount,
            (select count(distinct tr.scene_id) from training_records tr where tr.tenant_id = t.tenant_id and tr.task_id = t.id and tr.status = 'completed' and tr.deleted_at is null${progressUserClause}) as completedSceneCount,
            (select s.scene_type from task_scenes ts left join scenes s on s.id = ts.scene_id and s.tenant_id = ts.tenant_id where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null order by ts.sort_order asc limit 1) as primarySceneType,
            (select s.mode from task_scenes ts left join scenes s on s.id = ts.scene_id and s.tenant_id = ts.tenant_id where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null order by ts.sort_order asc limit 1) as primaryMode
     from tasks t
     left join users u on u.id = t.created_by and u.tenant_id = t.tenant_id
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where ${taskFilters.join(" and ")} limit 1`,
    [...progressParams, ...progressParams, ...taskParams],
  );
  if (!rawTask) return undefined;
  const sceneCount = Number(rawTask.sceneCount || 0);
  const completedSceneCount = Math.min(Number(rawTask.completedSceneCount || 0), sceneCount);
  const task: TaskRow = {
    ...rawTask,
    sceneCount,
    completedSceneCount,
    participantCount: Number(rawTask.participantCount || 0),
    progressPercent: rawTask.status === "completed" ? 100 : sceneCount ? Math.round((completedSceneCount / sceneCount) * 100) : 0,
  };
  const scenes = all<TaskSceneRow>(
    `select ts.id, ts.scene_id as sceneId, s.name as sceneName, s.code as sceneCode, s.scene_type as sceneType,
            s.mode, s.status, ts.sort_order as sortOrder, ts.required_train_times as requiredTrainTimes, ts.pass_score as passScore,
            (select count(*) from training_records tr where tr.tenant_id = ts.tenant_id and tr.task_id = ts.task_id and tr.scene_id = ts.scene_id and tr.status = 'completed' and tr.deleted_at is null${progressUserClause}) as completedTrainCount
     from task_scenes ts
     left join scenes s on s.id = ts.scene_id and s.tenant_id = ts.tenant_id
     where ts.tenant_id = ? and ts.task_id = ? and ts.deleted_at is null
     order by ts.sort_order asc, ts.created_at asc`,
    [...progressParams, tenantId, taskId],
  );
  const participants: TaskParticipantRow[] = options.viewerUserId
    ? []
    : all<TaskParticipantRow>(
      `select tp.id,
              case when tp.user_id is not null then 'user' else 'org' end as participantType,
              tp.user_id as userId, u.name as userName, u.mobile,
              tp.org_id as orgId, o.name as orgName,
              tp.status, tp.finished_at as finishedAt
       from task_participants tp
       left join users u on u.id = tp.user_id and u.tenant_id = tp.tenant_id
       left join organizations o on o.id = tp.org_id and o.tenant_id = tp.tenant_id
       where tp.tenant_id = ? and tp.task_id = ? and tp.deleted_at is null
       order by participantType desc, tp.created_at asc`,
      [tenantId, taskId],
    );
  return { task, scenes, participants };
}
export function createTask(tenantId: string, input: { name: string; code: string; type: string; sceneIds: string[]; participantUserIds?: string[]; participantOrgIds?: string[]; startAt?: string; endAt?: string; answerForm?: string }) {
  const id = createId("task");
  run(
    `insert into tasks (id, tenant_id, name, code, type, status, answer_form, start_at, end_at, created_at, updated_at)
     values (?, ?, ?, ?, ?, 'draft', ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.name, input.code, input.type, input.answerForm ?? "voice", input.startAt ?? null, input.endAt ?? null],
  );
  input.sceneIds.forEach((sceneId, index) => {
    run(
      `insert into task_scenes (id, tenant_id, task_id, scene_id, sort_order, required_train_times, pass_score, created_at, updated_at)
       values (?, ?, ?, ?, ?, 1, 80, datetime('now'), datetime('now'))`,
      [createId("ts"), tenantId, id, sceneId, index + 1],
    );
  });
  input.participantUserIds?.forEach((userId) => {
    run(
      `insert into task_participants (id, tenant_id, task_id, user_id, status, created_at, updated_at)
       values (?, ?, ?, ?, 'not_started', datetime('now'), datetime('now'))`,
      [createId("tp"), tenantId, id, userId],
    );
  });
  input.participantOrgIds?.forEach((orgId) => {
    run(
      `insert into task_participants (id, tenant_id, task_id, org_id, status, created_at, updated_at)
       values (?, ?, ?, ?, 'not_started', datetime('now'), datetime('now'))`,
      [createId("tp"), tenantId, id, orgId],
    );
  });
  return get<TaskRow>("select id, name, code, type, status, end_at as endAt from tasks where id = ?", [id]);
}

export function updateTaskStatus(tenantId: string, taskId: string, status: "draft" | "published" | "stopped" | "completed") {
  const publishAt = status === "published" ? ", publish_at = datetime('now')" : "";
  run(`update tasks set status = ?, updated_at = datetime('now')${publishAt} where tenant_id = ? and id = ? and deleted_at is null`, [status, tenantId, taskId]);
  if (status === "stopped") {
    run(
      `update task_participants set status = 'stopped', updated_at = datetime('now')
       where tenant_id = ? and task_id = ? and deleted_at is null`,
      [tenantId, taskId],
    );
  }
  return get<TaskRow>("select id, name, code, type, status, end_at as endAt from tasks where tenant_id = ? and id = ?", [tenantId, taskId]);
}

export function deleteStoppedTask(tenantId: string, taskId: string): boolean {
  const task = get<{ id: string }>(
    "select id from tasks where tenant_id = ? and id = ? and status = 'stopped' and deleted_at is null limit 1",
    [tenantId, taskId],
  );
  if (!task) return false;
  run("update tasks set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ? and status = 'stopped' and deleted_at is null", [tenantId, taskId]);
  run("update task_participants set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and task_id = ? and deleted_at is null", [tenantId, taskId]);
  run("update task_scenes set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and task_id = ? and deleted_at is null", [tenantId, taskId]);
  return true;
}

export function createAiTrainingSession(
  tenantId: string,
  input: { sceneId: string; userId?: string | null; history?: AiTrainingSessionMessage[] },
): AiTrainingSessionRow | undefined {
  const scene = get<{ id: string }>("select id from scenes where tenant_id = ? and id = ? and deleted_at is null limit 1", [tenantId, input.sceneId]);
  if (!scene) return undefined;
  if (input.userId) {
    const user = get<{ id: string }>("select id from users where tenant_id = ? and id = ? and deleted_at is null limit 1", [tenantId, input.userId]);
    if (!user) return undefined;
  }

  const id = `sess_${randomBytes(16).toString("base64url")}`;
  const startedAt = new Date().toISOString();
  run(
    `insert into ai_training_sessions (id, tenant_id, user_id, scene_id, status, history_json, off_topic_count, round_count, started_at, created_at, updated_at)
     values (?, ?, ?, ?, 'in_progress', ?, 0, 0, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.userId ?? null, input.sceneId, JSON.stringify(input.history ?? []), startedAt],
  );
  return getAiTrainingSession(tenantId, id);
}

export function getAiTrainingSession(tenantId: string, sessionId: string): AiTrainingSessionRow | undefined {
  return get<AiTrainingSessionRow>(
    `select id, tenant_id as tenantId, user_id as userId, scene_id as sceneId, status, history_json as historyJson,
            off_topic_count as offTopicCount, round_count as roundCount, started_at as startedAt, finished_at as finishedAt,
            created_at as createdAt, updated_at as updatedAt
     from ai_training_sessions where tenant_id = ? and id = ? and deleted_at is null limit 1`,
    [tenantId, sessionId],
  );
}

export function getAiTrainingSessionForUser(tenantId: string, sessionId: string, userId?: string | null): AiTrainingSessionRow | undefined {
  const userFilter = userId ? "user_id = ?" : "user_id is null";
  const params = userId ? [tenantId, sessionId, userId] : [tenantId, sessionId];
  return get<AiTrainingSessionRow>(
    `select id, tenant_id as tenantId, user_id as userId, scene_id as sceneId, status, history_json as historyJson,
            off_topic_count as offTopicCount, round_count as roundCount, started_at as startedAt, finished_at as finishedAt,
            created_at as createdAt, updated_at as updatedAt
     from ai_training_sessions where tenant_id = ? and id = ? and ${userFilter} and deleted_at is null limit 1`,
    params,
  );
}

export function updateAiTrainingSession(
  tenantId: string,
  sessionId: string,
  input: {
    history?: AiTrainingSessionMessage[];
    status?: "in_progress" | "completed" | "abandoned";
    offTopicCount?: number;
    roundCount?: number;
    finishedAt?: string | null;
  },
) {
  const current = getAiTrainingSession(tenantId, sessionId);
  if (!current) return undefined;
  const nextStatus = input.status ?? current.status;
  const finishedAt = input.finishedAt !== undefined
    ? input.finishedAt
    : nextStatus === "completed"
      ? current.finishedAt ?? new Date().toISOString()
      : current.finishedAt;
  run(
    `update ai_training_sessions
     set history_json = ?, status = ?, off_topic_count = ?, round_count = ?, finished_at = ?, updated_at = datetime('now')
     where tenant_id = ? and id = ? and deleted_at is null`,
    [
      input.history ? JSON.stringify(input.history) : current.historyJson,
      nextStatus,
      input.offTopicCount ?? current.offTopicCount,
      input.roundCount ?? current.roundCount,
      finishedAt,
      tenantId,
      sessionId,
    ],
  );
  return getAiTrainingSession(tenantId, sessionId);
}

export function listTrainingRecords(
  tenantId: string,
  options: { page: number; pageSize: number; status?: string; userId?: string; sceneId?: string; filterUserId?: string },
) {
  const filters = ["tr.tenant_id = ?", "tr.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("tr.status = ?");
    params.push(options.status);
  }
  if (options.userId) {
    filters.push("tr.user_id = ?");
    params.push(options.userId);
  }
  if (options.sceneId) {
    filters.push("tr.scene_id = ?");
    params.push(options.sceneId);
  }
  if (options.filterUserId) {
    filters.push("tr.user_id = ?");
    params.push(options.filterUserId);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(`select count(*) as count from training_records tr where ${where}`, params)?.count ?? 0;
  const items = all<TrainingRecordRow & { passed: number; scenePassScore: number }>(
    `select tr.id, tr.record_no as recordNo, tr.task_id as taskId, t.name as taskName, tr.scene_id as sceneId, s.name as sceneName,
            tr.user_id as userId, u.name as userName, tr.mode, tr.status, tr.score, tr.started_at as startedAt, tr.finished_at as finishedAt,
            coalesce(s.pass_score, 80) as scenePassScore,
            case when tr.score >= coalesce(s.pass_score, 80) then 1 else 0 end as passed
     from training_records tr
     left join tasks t on t.id = tr.task_id and t.tenant_id = tr.tenant_id
     left join scenes s on s.id = tr.scene_id and s.tenant_id = tr.tenant_id
     left join users u on u.id = tr.user_id and u.tenant_id = tr.tenant_id
     where ${where}
     order by tr.finished_at desc, tr.created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createTrainingRecord(tenantId: string, input: CreateTrainingRecordInput) {
  // 幂等：同一对练会话（sessionId）只允许一条训练记录，重复请求直接返回已有记录
  if (input.sessionId) {
    const existingFilters = ["tenant_id = ?", "session_id = ?", "deleted_at is null"];
    const existingParams: unknown[] = [tenantId, input.sessionId];
    if (input.userId) {
      existingFilters.push("user_id = ?");
      existingParams.push(input.userId);
    }
    const existing = get<{ id: string }>(
      `select id from training_records where ${existingFilters.join(" and ")} limit 1`,
      existingParams,
    );
    if (existing) {
      return getTrainingRecordDetail(tenantId, existing.id);
    }
  }
  const scene = get<{ id: string }>("select id from scenes where tenant_id = ? and id = ? and deleted_at is null limit 1", [tenantId, input.sceneId]);
  if (!scene) {
    return undefined;
  }
  if (input.taskId) {
    const task = get<{ id: string }>("select id from tasks where tenant_id = ? and id = ? and deleted_at is null limit 1", [tenantId, input.taskId]);
    if (!task) return undefined;
  }
  if (input.userId) {
    const user = get<{ id: string }>("select id from users where tenant_id = ? and id = ? and deleted_at is null limit 1", [tenantId, input.userId]);
    if (!user) {
      return undefined;
    }
  }
  const id = createId("record");
  const recordNo = `TR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const startedAt = input.startedAt ?? new Date().toISOString();
  const finishedAt = input.finishedAt ?? (input.status === "completed" ? new Date().toISOString() : null);
  const suggestionsJson = JSON.stringify(input.suggestions ?? []);
  const summaryJson = JSON.stringify({ highlights: input.highlights ?? [], weaknesses: input.weaknesses ?? [] });
  const capabilityProfileJson = JSON.stringify([{ name: "能力综述", text: input.capabilityProfile ?? "" }]);
  run(
    `insert into training_records (id, tenant_id, record_no, task_id, scene_id, user_id, mode, status, score, session_id, suggestions, summary_json, capability_profile, started_at, finished_at, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, recordNo, input.taskId ?? null, input.sceneId, input.userId ?? null, input.mode, input.status, input.score, input.sessionId ?? null, suggestionsJson, summaryJson, capabilityProfileJson, startedAt, finishedAt],
  );
  input.turns.forEach((turn) => {
    run(
      `insert into training_turns (id, tenant_id, record_id, speaker, text, duration_ms, emotion, started_at, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [createId("turn"), tenantId, id, turn.speaker, turn.text, turn.durationMs ?? 0, turn.emotion ?? "", turn.startedAt ?? null],
    );
  });
  input.scores.forEach((score) => {
    run(
      `insert into score_details (id, tenant_id, record_id, scoring_rule_id, round_no, score, deduction_reason, evidence_text, level, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [createId("sd"), tenantId, id, score.scoringRuleId ?? null, score.roundNo ?? 0, score.score, score.deductionReason ?? "", score.evidenceText ?? "", score.level ?? ""],
    );
  });
  if (input.taskId && input.userId && input.status === "completed") {
    run(
      `update task_participants set status = 'completed', finished_at = coalesce(?, datetime('now')), updated_at = datetime('now')
       where tenant_id = ? and task_id = ? and user_id = ? and deleted_at is null`,
      [finishedAt, tenantId, input.taskId, input.userId],
    );
  }
  return getTrainingRecordDetail(tenantId, id);
}
export function getTrainingRecordDetail(
  tenantId: string,
  recordId: string,
  options: { userId?: string } = {},
): TrainingRecordDetail | undefined {
  const filters = ["tr.tenant_id = ?", "tr.id = ?", "tr.deleted_at is null"];
  const params: unknown[] = [tenantId, recordId];
  if (options.userId) {
    filters.push("tr.user_id = ?");
    params.push(options.userId);
  }
  const record = get<TrainingRecordRow>(
    `select tr.id, tr.record_no as recordNo, tr.task_id as taskId, t.name as taskName, tr.scene_id as sceneId, s.name as sceneName,
            tr.user_id as userId, u.name as userName, tr.mode, tr.status, tr.score, tr.session_id as sessionId,
            tr.summary_json as summaryJson,
            tr.started_at as startedAt, tr.finished_at as finishedAt
     from training_records tr
     left join tasks t on t.id = tr.task_id and t.tenant_id = tr.tenant_id
     left join scenes s on s.id = tr.scene_id and s.tenant_id = tr.tenant_id
     left join users u on u.id = tr.user_id and u.tenant_id = tr.tenant_id
     where ${filters.join(" and ")} limit 1`,
    params,
  );
  if (!record) return undefined;
  const turns = all<TrainingTurnRow>(
    `select id, speaker, text, duration_ms as durationMs, started_at as startedAt, emotion
     from training_turns where tenant_id = ? and record_id = ? and deleted_at is null order by created_at asc`,
    [tenantId, recordId],
  );
  const scores = all<ScoreDetailRow>(
    `select sd.id, sr.name as ruleName, sd.score, sd.deduction_reason as deductionReason, sd.evidence_text as evidenceText, sd.level as level, sd.round_no as roundNo
     from score_details sd
     left join scoring_rules sr on sr.id = sd.scoring_rule_id and sr.tenant_id = sd.tenant_id
     where sd.tenant_id = ? and sd.record_id = ? and sd.deleted_at is null order by sd.created_at asc`,
    [tenantId, recordId],
  );
  const suggestionsRow = get<{ suggestions: string }>(
    "select suggestions from training_records where tenant_id = ? and id = ? and deleted_at is null limit 1",
    [tenantId, recordId],
  );
  // 拆分：round_no=0/null 为整场评分（报告页维度分析）；round_no>0 为每轮评分（对话记录反馈卡）
  const overallScores = scores.filter((s) => !s.roundNo || s.roundNo <= 0).map(({ roundNo, ...rest }) => rest);
  const turnScoreMap = new Map<number, ScoreDetailRow[]>();
  for (const s of scores) {
    if (s.roundNo && s.roundNo > 0) {
      const arr = turnScoreMap.get(s.roundNo) ?? [];
      arr.push({ ...s });
      turnScoreMap.set(s.roundNo, arr);
    }
  }
  const turnScores = [...turnScoreMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([roundNo, list]) => ({ roundNo, scores: list }));

  let suggestions: string[] = [];
  if (suggestionsRow?.suggestions) {
    try {
      const parsed = JSON.parse(suggestionsRow.suggestions);
      if (Array.isArray(parsed)) suggestions = parsed.filter((s) => typeof s === "string");
    } catch { /* ignore invalid json */ }
  }
  let highlights: string[] = [];
  let weaknesses: string[] = [];
  if (record.summaryJson) {
    try {
      const parsed = JSON.parse(record.summaryJson) as { highlights?: unknown; weaknesses?: unknown };
      if (Array.isArray(parsed.highlights)) highlights = parsed.highlights.filter((s): s is string => typeof s === "string");
      if (Array.isArray(parsed.weaknesses)) weaknesses = parsed.weaknesses.filter((s): s is string => typeof s === "string");
    } catch { /* ignore invalid json */ }
  }
  let capabilityProfile = "";
  const profileRow = get<{ capabilityProfile: string }>(
    "select capability_profile as capabilityProfile from training_records where tenant_id = ? and id = ? and deleted_at is null limit 1",
    [tenantId, recordId],
  );
  if (profileRow?.capabilityProfile) {
    try {
      const parsed = JSON.parse(profileRow.capabilityProfile) as Array<{ name?: unknown; text?: unknown }>;
      if (Array.isArray(parsed)) {
        const first = parsed.find((p) => p && p.name === "能力综述");
        if (first && typeof first.text === "string") capabilityProfile = first.text;
      }
    } catch { /* ignore invalid json */ }
  }
  return { record, turns, scores: overallScores, turnScores, suggestions, highlights, weaknesses, capabilityProfile };
}

/** 按对练会话查询训练记录（评分异步完成后前端轮询用） */
export function getTrainingRecordBySessionId(
  tenantId: string,
  sessionId: string,
  options: { userId?: string } = {},
): TrainingRecordDetail | undefined {
  const filters = ["tenant_id = ?", "session_id = ?", "deleted_at is null"];
  const params: unknown[] = [tenantId, sessionId];
  if (options.userId) {
    filters.push("user_id = ?");
    params.push(options.userId);
  }
  const found = get<{ id: string }>(
    `select id from training_records where ${filters.join(" and ")} limit 1`,
    params,
  );
  if (!found) return undefined;
  return getTrainingRecordDetail(tenantId, found.id, options);
}

export function getAppeal(tenantId: string, appealId: string) {
  return get<AppealRow>(
    `select a.id, a.biz_type as bizType, a.biz_id as bizId, tr.record_no as recordNo, t.name as taskName,
            s.name as sceneName, tr.score as score, a.user_id as userId, u.name as userName,
            a.reason, a.status, a.handler_id as handlerId, h.name as handlerName,
            a.handled_at as handledAt, a.created_at as createdAt
     from appeals a
     left join training_records tr on tr.id = a.biz_id and a.biz_type = 'training_record' and tr.tenant_id = a.tenant_id
     left join tasks t on t.id = tr.task_id and t.tenant_id = tr.tenant_id
     left join scenes s on s.id = tr.scene_id and s.tenant_id = tr.tenant_id
     left join users u on u.id = a.user_id and u.tenant_id = a.tenant_id
     left join users h on h.id = a.handler_id and h.tenant_id = a.tenant_id
     where a.tenant_id = ? and a.id = ? and a.deleted_at is null limit 1`,
    [tenantId, appealId],
  );
}

export function listAppeals(tenantId: string, options: { page: number; pageSize: number; keyword?: string; status?: string }) {
  const filters = ["a.tenant_id = ?", "a.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("a.status = ?");
    params.push(options.status);
  }
  if (options.keyword) {
    filters.push("(a.reason like ? or tr.record_no like ? or u.name like ? or s.name like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`, `%${options.keyword}%`, `%${options.keyword}%`);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(
    `select count(*) as count
     from appeals a
     left join training_records tr on tr.id = a.biz_id and a.biz_type = 'training_record' and tr.tenant_id = a.tenant_id
     left join scenes s on s.id = tr.scene_id and s.tenant_id = tr.tenant_id
     left join users u on u.id = a.user_id and u.tenant_id = a.tenant_id
     where ${where}`,
    params,
  )?.count ?? 0;
  const items = all<AppealRow>(
    `select a.id, a.biz_type as bizType, a.biz_id as bizId, tr.record_no as recordNo, t.name as taskName,
            s.name as sceneName, tr.score as score, a.user_id as userId, u.name as userName,
            a.reason, a.status, a.handler_id as handlerId, h.name as handlerName,
            a.handled_at as handledAt, a.created_at as createdAt
     from appeals a
     left join training_records tr on tr.id = a.biz_id and a.biz_type = 'training_record' and tr.tenant_id = a.tenant_id
     left join tasks t on t.id = tr.task_id and t.tenant_id = tr.tenant_id
     left join scenes s on s.id = tr.scene_id and s.tenant_id = tr.tenant_id
     left join users u on u.id = a.user_id and u.tenant_id = a.tenant_id
     left join users h on h.id = a.handler_id and h.tenant_id = a.tenant_id
     where ${where}
     order by case a.status when 'pending' then 0 else 1 end, a.created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createAppeal(
  tenantId: string,
  input: { bizType: "training_record"; bizId: string; userId?: string | null; reason: string },
) {
  const record = get<{ userId: string | null }>(
    "select user_id as userId from training_records where tenant_id = ? and id = ? and deleted_at is null limit 1",
    [tenantId, input.bizId],
  );
  if (!record) return undefined;
  const id = createId("appeal");
  run(
    `insert into appeals (id, tenant_id, biz_type, biz_id, user_id, reason, status, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
    [id, tenantId, input.bizType, input.bizId, input.userId ?? record.userId, input.reason],
  );
  return getAppeal(tenantId, id);
}

export function handleAppeal(tenantId: string, appealId: string, input: { status: "approved" | "rejected"; handlerId?: string | null }) {
  run(
    `update appeals set status = ?, handler_id = ?, handled_at = datetime('now'), updated_at = datetime('now')
     where tenant_id = ? and id = ? and deleted_at is null`,
    [input.status, input.handlerId ?? null, tenantId, appealId],
  );
  return getAppeal(tenantId, appealId);
}
export function listAiProviders(tenantId: string) {
  return all<AiProviderRow>(
    `select id, provider_type as providerType, provider_name as providerName, model_name as modelName, base_url as baseUrl, status, is_default as isDefault
     from ai_provider_configs where tenant_id = ? and deleted_at is null order by is_default desc, created_at desc`,
    [tenantId],
  );
}

export function getDefaultAiProvider(tenantId: string, providerType = "llm") {
  const row = get<AiProviderRow & { apiKeyEncrypted: string }>(
    `select id, provider_type as providerType, provider_name as providerName, model_name as modelName, base_url as baseUrl,
            api_key_encrypted as apiKeyEncrypted, status, is_default as isDefault
     from ai_provider_configs where tenant_id = ? and provider_type = ? and is_default = 1 and deleted_at is null limit 1`,
    [tenantId, providerType],
  );
  // 返回前解密 API Key（仅服务端使用，不暴露给客户端）
  if (row) row.apiKeyEncrypted = decryptSecret(row.apiKeyEncrypted);
  return row;
}

export function upsertDefaultAiProvider(
  tenantId: string,
  input: { providerType: string; providerName: string; modelName: string; baseUrl: string; apiKey?: string; status: string; isDefault: boolean },
) {
  const existing = get<{ id: string; apiKeyEncrypted: string }>(
    "select id, api_key_encrypted as apiKeyEncrypted from ai_provider_configs where tenant_id = ? and provider_type = ? and is_default = 1 and deleted_at is null limit 1",
    [tenantId, input.providerType],
  );
  if (input.isDefault) {
    run("update ai_provider_configs set is_default = 0, updated_at = datetime('now') where tenant_id = ? and provider_type = ?", [tenantId, input.providerType]);
  }
  // API Key 写入前加密；已加密（enc:v1:）的存量值不重复加密；未提供新 key 时保留原值（原值已加密则原样，明文则加密迁移）
  let apiKey = input.apiKey ?? existing?.apiKeyEncrypted ?? "";
  if (apiKey && !isEncryptedSecret(apiKey)) apiKey = encryptSecret(apiKey);
  if (existing) {
    run(
      `update ai_provider_configs
       set provider_name = ?, model_name = ?, base_url = ?, api_key_encrypted = ?, status = ?, is_default = ?, updated_at = datetime('now')
       where tenant_id = ? and id = ?`,
      [input.providerName, input.modelName, input.baseUrl, apiKey, input.status, input.isDefault ? 1 : 0, tenantId, existing.id],
    );
  } else {
    run(
      `insert into ai_provider_configs (id, tenant_id, provider_type, provider_name, model_name, base_url, api_key_encrypted, status, is_default, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [createId("aicfg"), tenantId, input.providerType, input.providerName, input.modelName, input.baseUrl, apiKey, input.status, input.isDefault ? 1 : 0],
    );
  }
  return listAiProviders(tenantId);
}

export function logAiCall(input: {
  tenantId: string;
  providerType: string;
  modelName?: string;
  bizType: string;
  bizId?: string | null;
  tokens?: number;
  audioSeconds?: number;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
  traceId: string;
}) {
  run(
    `insert into ai_call_logs (id, tenant_id, provider_type, model_name, biz_type, biz_id, tokens, audio_seconds, duration_ms, success, error_message, trace_id, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      createId("ailog"),
      input.tenantId,
      input.providerType,
      input.modelName ?? "",
      input.bizType,
      input.bizId ?? null,
      input.tokens ?? 0,
      input.audioSeconds ?? 0,
      input.durationMs ?? 0,
      input.success ? 1 : 0,
input.errorMessage ?? "",
      input.traceId,
    ],
  );
}

// ===== 考试模块 =====

export type ExamQuestionRow = {
  id: string;
  bankId: string | null;
  type: "single" | "multi" | "judge";
  stem: string;
  options: string[];
  answer: string;
  analysis: string;
  score: number;
  sortOrder: number;
  createdAt: string;
};

export type ExamQuestionBankRow = {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  createdAt: string;
};

export type ExamRow = {
  id: string;
  name: string;
  code: string | null;
  bankId: string | null;
  description: string;
  durationMinutes: number;
  passScore: number;
  totalScore: number;
  questionCount: number;
  status: string;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
};

export type ExamAttemptRow = {
  id: string;
  examId: string;
  examName: string;
  taskId: string | null;
  sceneId: string | null;
  userId: string | null;
  userName: string | null;
  score: number | null;
  totalScore: number;
  status: string;
  durationSeconds: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type ExamAnswerRow = {
  questionId: string;
  userAnswer: string;
  isCorrect: number;
  score: number;
};

export type ExamBankWithQuestions = ExamQuestionBankRow & { questions: ExamQuestionRow[] };
export type ExamDetail = ExamRow & { questions: ExamQuestionRow[] };
export type ExamAttemptDetail = ExamAttemptRow & { answers: ExamAnswerRow[] };

export function createExamBank(tenantId: string, input: { name: string; description?: string }) {
  const id = createId("bank");
  run(
    `insert into exam_question_banks (id, tenant_id, name, description, created_at, updated_at)
     values (?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.name, input.description ?? ""],
  );
  return get<ExamQuestionBankRow>(
    `select id, name, description,
       (select count(*) from exam_questions q where q.bank_id = b.id and q.deleted_at is null) as questionCount,
       created_at as createdAt
     from exam_question_banks b where id = ?`,
    [id],
  );
}

export function getExamQuestionBankWithQuestions(tenantId: string, bankId: string): ExamBankWithQuestions | undefined {
  const bank = get<ExamQuestionBankRow>(
    `select b.id, b.name, b.description,
       (select count(*) from exam_questions q where q.bank_id = b.id and q.deleted_at is null) as questionCount,
       b.created_at as createdAt
     from exam_question_banks b where b.tenant_id = ? and b.id = ? and b.deleted_at is null limit 1`,
    [tenantId, bankId],
  );
  if (!bank) return undefined;
  const questions = listExamQuestions(tenantId, bankId);
  return { ...bank, questions };
}

export function deleteExamBank(tenantId: string, id: string) {
  run(`update exam_question_banks set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?`, [tenantId, id]);
  run(`update exam_questions set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and bank_id = ?`, [tenantId, id]);
}

export function listExamQuestionBanks(tenantId: string) {
  return all<ExamQuestionBankRow>(
    `select b.id, b.name, b.description,
       (select count(*) from exam_questions q where q.bank_id = b.id and q.deleted_at is null) as questionCount,
       b.created_at as createdAt
     from exam_question_banks b
     where b.tenant_id = ? and b.deleted_at is null order by b.created_at desc`,
    [tenantId],
  );
}

export function addExamQuestion(tenantId: string, input: {
  bankId?: string | null;
  type: "single" | "multi" | "judge";
  stem: string;
  options: string[];
  answer: string;
  analysis?: string;
  score?: number;
}) {
  const id = createId("q");
  const score = input.score ?? 5;
  run(
    `insert into exam_questions (id, tenant_id, bank_id, type, stem, options, answer, analysis, score, sort_order, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id, tenantId, input.bankId ?? null, input.type, input.stem,
      JSON.stringify(input.options), input.answer, input.analysis ?? "", score, 0,
    ],
  );
  if (input.bankId) {
    run(
      `update exam_question_banks set question_count = (select count(*) from exam_questions q where q.bank_id = ? and q.deleted_at is null), updated_at = datetime('now')
       where id = ? and deleted_at is null`,
      [input.bankId, input.bankId],
    );
  }
  return getExamQuestion(tenantId, id);
}

export function listExamQuestions(tenantId: string, bankId?: string) {
  const rows = all<Omit<ExamQuestionRow, "options"> & { options: string | string[] }>(
    `select id, bank_id as bankId, type, stem, options, answer, analysis, score, sort_order as sortOrder, created_at as createdAt
     from exam_questions
     where tenant_id = ? and deleted_at is null ${bankId ? "and bank_id = ?" : ""}
     order by sort_order asc, created_at asc`,
    bankId ? [tenantId, bankId] : [tenantId],
  );
  return rows.map(normalizeExamQuestionRow);
}

function getExamQuestion(tenantId: string, id: string): ExamQuestionRow | undefined {
  const row = get<Omit<ExamQuestionRow, "options"> & { options: string | string[] }>(
    `select id, bank_id as bankId, type, stem, options, answer, analysis, score, sort_order as sortOrder, created_at as createdAt
     from exam_questions where tenant_id = ? and id = ? and deleted_at is null limit 1`,
    [tenantId, id],
  );
  return row ? normalizeExamQuestionRow(row) : undefined;
}

function normalizeExamQuestionRow(row: Omit<ExamQuestionRow, "options"> & { options: string | string[] }): ExamQuestionRow {
  if (Array.isArray(row.options)) return row as ExamQuestionRow;
  try {
    const parsed = JSON.parse(row.options || "[]");
    return { ...row, options: Array.isArray(parsed) ? parsed.map(String) : [] };
  } catch {
    return { ...row, options: [] };
  }
}

export function updateExamQuestion(tenantId: string, id: string, input: { stem?: string; options?: string[]; answer?: string; analysis?: string; score?: number }) {
  const existing = getExamQuestion(tenantId, id);
  if (!existing) return undefined;
  run(
    `update exam_questions set stem = ?, options = ?, answer = ?, analysis = ?, score = ?, updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [
      input.stem ?? existing.stem,
      JSON.stringify(input.options ?? existing.options),
      input.answer ?? existing.answer,
      input.analysis ?? existing.analysis,
      input.score ?? existing.score,
      tenantId, id,
    ],
  );
  return getExamQuestion(tenantId, id);
}

export function deleteExamQuestion(tenantId: string, id: string) {
  run(`update exam_questions set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?`, [tenantId, id]);
}

export function createExam(tenantId: string, input: {
  name: string;
  code?: string;
  bankId?: string | null;
  description?: string;
  durationMinutes?: number;
  passScore?: number;
}) {
  const id = createId("exam");
  const bankId = input.bankId ?? null;
  // 题目 = 所选题库的全部题目；未选择题库时使用全部题目（综合卷）。
  const questions = listExamQuestions(tenantId, bankId ?? undefined);
  const totalScore = questions.reduce((sum, q) => sum + q.score, 0) || 100;
  run(
    `insert into exams (id, tenant_id, name, code, bank_id, description, duration_minutes, pass_score, total_score, question_count, status, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`,
    [
      id, tenantId, input.name, input.code ?? `EX-${Date.now().toString(36).toUpperCase()}`,
      bankId, input.description ?? "", input.durationMinutes ?? 60,
      input.passScore ?? 60, totalScore, questions.length,
    ],
  );
  return getExam(tenantId, id);
}

export function listExams(tenantId: string, options: { status?: string } = {}) {
  const filters = ["tenant_id = ?", "deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("status = ?");
    params.push(options.status);
  }
  return all<ExamRow>(
    `select id, name, code, bank_id as bankId, description, duration_minutes as durationMinutes,
            pass_score as passScore, total_score as totalScore, question_count as questionCount, status,
            start_at as startAt, end_at as endAt, created_at as createdAt
     from exams where ${filters.join(" and ")} order by created_at desc`,
    params,
  );
}

function getExam(tenantId: string, id: string): ExamRow | undefined {
  return get<ExamRow>(
    `select id, name, code, bank_id as bankId, description, duration_minutes as durationMinutes,
            pass_score as passScore, total_score as totalScore, question_count as questionCount, status,
            start_at as startAt, end_at as endAt, created_at as createdAt
     from exams where tenant_id = ? and id = ? and deleted_at is null limit 1`,
    [tenantId, id],
  );
}

export function getExamDetail(tenantId: string, id: string): ExamDetail | undefined {
  const exam = getExam(tenantId, id);
  if (!exam) return undefined;
  // 题目 = 所选题库的全部题目；未选题库时使用全部题目（综合卷）。
  const questions = listExamQuestions(tenantId, exam.bankId ?? undefined);
  return { ...exam, questions };
}

export function updateExam(tenantId: string, id: string, input: { name?: string; description?: string; durationMinutes?: number; passScore?: number; status?: string }) {
  const existing = getExam(tenantId, id);
  if (!existing) return undefined;
  run(
    `update exams set name = ?, description = ?, duration_minutes = ?, pass_score = ?, status = ?, updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [
      input.name ?? existing.name,
      input.description ?? existing.description,
      input.durationMinutes ?? existing.durationMinutes,
      input.passScore ?? existing.passScore,
      input.status ?? existing.status,
      tenantId, id,
    ],
  );
  return getExam(tenantId, id);
}

export function publishExam(tenantId: string, id: string) {
  run(`update exams set status = 'published', updated_at = datetime('now') where tenant_id = ? and id = ? and deleted_at is null`, [tenantId, id]);
  return getExam(tenantId, id);
}

export function deleteExam(tenantId: string, id: string) {
  run(`update exams set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?`, [tenantId, id]);
}

export function createExamAttempt(
  tenantId: string,
  input: { examId: string; userId?: string | null; taskId?: string | null; sceneId?: string | null },
) {
  const exam = getExam(tenantId, input.examId);
  if (!exam || exam.status !== "published") return undefined;
  const id = createId("att");
  run(
    `insert into exam_attempts (id, tenant_id, exam_id, task_id, scene_id, user_id, total_score, status, started_at, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, 'in_progress', datetime('now'), datetime('now'), datetime('now'))`,
    [id, tenantId, input.examId, input.taskId ?? null, input.sceneId ?? null, input.userId ?? null, exam.totalScore],
  );
  return getExamAttemptDetail(tenantId, id);
}

export function submitExamAttempt(
  tenantId: string,
  attemptId: string,
  answers: Array<{ questionId: string; answer: string }>,
  options: { userId?: string } = {},
) {
  const filters = ["tenant_id = ?", "id = ?", "deleted_at is null"];
  const params: unknown[] = [tenantId, attemptId];
  if (options.userId) {
    filters.push("user_id = ?");
    params.push(options.userId);
  }
  const attempt = get<{ id: string; examId: string; status: string }>(
    `select id, exam_id as examId, status from exam_attempts where ${filters.join(" and ")} limit 1`,
    params,
  );
  if (!attempt || attempt.status !== "in_progress") return undefined;
  const exam = getExam(tenantId, attempt.examId);
  if (!exam) return undefined;
  const questions = listExamQuestions(tenantId, exam.bankId ?? undefined);
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  let earned = 0;
  const answerRows: ExamAnswerRow[] = [];
  for (const a of answers) {
    const q = questionMap.get(a.questionId);
    if (!q) continue;
    const isCorrect = normalizeAnswer(a.answer) === normalizeAnswer(q.answer);
    const qScore = isCorrect ? q.score : 0;
    earned += qScore;
    answerRows.push({ questionId: q.id, userAnswer: a.answer, isCorrect: isCorrect ? 1 : 0, score: qScore });
    run(
      `insert into exam_answers (id, tenant_id, attempt_id, question_id, user_answer, is_correct, score, created_at)
       values (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [createId("ans"), tenantId, attemptId, q.id, a.answer, isCorrect ? 1 : 0, qScore],
    );
  }
  const status = earned >= exam.passScore ? "passed" : "failed";
  run(
    `update exam_attempts set score = ?, status = ?, finished_at = datetime('now'), updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [earned, status, tenantId, attemptId],
  );
  return getExamAttemptDetail(tenantId, attemptId);
}

function normalizeAnswer(a: string) {
  return String(a || "").trim().toUpperCase();
}

export function listExamAttempts(
  tenantId: string,
  options: { examId?: string; taskId?: string; sceneId?: string; userId?: string } = {},
) {
  const { examId, taskId, sceneId, userId } = options;
  const filters = ["a.tenant_id = ?", "a.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (examId) {
    filters.push("a.exam_id = ?");
    params.push(examId);
  }
  if (taskId) {
    filters.push("a.task_id = ?");
    params.push(taskId);
  }
  if (sceneId) {
    filters.push("a.scene_id = ?");
    params.push(sceneId);
  }
  if (userId) {
    filters.push("a.user_id = ?");
    params.push(userId);
  }
  return all<ExamAttemptRow>(
    `select a.id, a.exam_id as examId, e.name as examName, a.task_id as taskId, a.scene_id as sceneId,
            a.user_id as userId, u.name as userName, a.score, a.total_score as totalScore, a.status,
            a.duration_seconds as durationSeconds, a.started_at as startedAt, a.finished_at as finishedAt, a.created_at as createdAt
     from exam_attempts a
     left join exams e on e.id = a.exam_id and e.tenant_id = a.tenant_id
     left join users u on u.id = a.user_id and u.tenant_id = a.tenant_id
     where ${filters.join(" and ")}
     order by a.created_at desc`,
    params,
  );
}

function getExamAttemptDetail(tenantId: string, attemptId: string): ExamAttemptDetail | undefined {
  const attempt = get<ExamAttemptRow>(
    `select a.id, a.exam_id as examId, e.name as examName, a.task_id as taskId, a.scene_id as sceneId,
            a.user_id as userId, u.name as userName, a.score, a.total_score as totalScore, a.status,
            a.duration_seconds as durationSeconds, a.started_at as startedAt, a.finished_at as finishedAt, a.created_at as createdAt
     from exam_attempts a
     left join exams e on e.id = a.exam_id and e.tenant_id = a.tenant_id
     left join users u on u.id = a.user_id and u.tenant_id = a.tenant_id
     where a.tenant_id = ? and a.id = ? and a.deleted_at is null limit 1`,
    [tenantId, attemptId],
  );
  if (!attempt) return undefined;
  const answers = all<ExamAnswerRow>(
    `select question_id as questionId, user_answer as userAnswer, is_correct as isCorrect, score
     from exam_answers where tenant_id = ? and attempt_id = ?`,
    [tenantId, attemptId],
  );
  return { ...attempt, answers };
}

// ===== 对练中心：场景用户进度 =====

export function getSceneUserProgress(tenantId: string, userId: string): Map<string, { attemptCount: number; bestScore: number }> {
  const rows = all<{ sceneId: string; attemptCount: number; bestScore: number }>(
    `select scene_id as sceneId, count(*) as attemptCount, max(score) as bestScore
     from training_records
     where tenant_id = ? and user_id = ? and deleted_at is null and status = 'completed'
     group by scene_id`,
    [tenantId, userId],
  );
  const map = new Map<string, { attemptCount: number; bestScore: number }>();
  rows.forEach((r) => map.set(r.sceneId, { attemptCount: r.attemptCount, bestScore: r.bestScore }));
  return map;
}

// ===== 角色管理 =====

export type RoleRow = {
  id: string;
  name: string;
  code: string;
  permissions: string[];
  status: string;
  sortOrder: number;
  createdAt: string;
};

function parsePermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function listRoles(tenantId: string, options: { page: number; pageSize: number; keyword?: string; status?: string }) {
  const filters = ["tenant_id = ?", "deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("status = ?");
    params.push(options.status);
  }
  if (options.keyword) {
    filters.push("(name like ? or code like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(`select count(*) as count from roles where ${where}`, params)?.count ?? 0;
  const items = all<RoleRow>(
    `select id, name, code, permissions, status, sort_order as sortOrder, created_at as createdAt
     from roles where ${where} order by sort_order asc, created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  ).map((row) => ({ ...row, permissions: parsePermissions(row.permissions) }));
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createRole(
  tenantId: string,
  input: { name: string; code: string; permissions?: string[]; status?: string; sortOrder?: number },
) {
  const id = createId("role");
  run(
    `insert into roles (id, tenant_id, name, code, permissions, status, sort_order, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.name, input.code, JSON.stringify(input.permissions ?? []), input.status ?? "enabled", input.sortOrder ?? 0],
  );
  const created = get<RoleRow>(
    `select id, name, code, permissions, status, sort_order as sortOrder, created_at as createdAt
     from roles where tenant_id = ? and id = ?`,
    [tenantId, id],
  );
  return created ? { ...created, permissions: parsePermissions(created.permissions) } : undefined;
}

export function updateRole(
  tenantId: string,
  id: string,
  input: { name?: string; code?: string; permissions?: string[]; status?: string; sortOrder?: number },
) {
  const existing = get<RoleRow>(
    `select id, name, code, permissions, status, sort_order as sortOrder from roles where tenant_id = ? and id = ? and deleted_at is null limit 1`,
    [tenantId, id],
  );
  if (!existing) return undefined;
  run(
    `update roles set name = ?, code = ?, permissions = ?, status = ?, sort_order = ?, updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [
      input.name ?? existing.name,
      input.code ?? existing.code,
      input.permissions ? JSON.stringify(input.permissions) : existing.permissions,
      input.status ?? existing.status,
      input.sortOrder ?? existing.sortOrder,
      tenantId, id,
    ],
  );
  const updated = get<RoleRow>(
    `select id, name, code, permissions, status, sort_order as sortOrder, created_at as createdAt
     from roles where tenant_id = ? and id = ?`,
    [tenantId, id],
  );
  return updated ? { ...updated, permissions: parsePermissions(updated.permissions) } : undefined;
}

export function deleteRole(tenantId: string, id: string) {
  run(`update roles set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?`, [tenantId, id]);
}

// ===== 菜单管理 =====

export type MenuRow = {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  icon: string;
  status: string;
  sortOrder: number;
  createdAt: string;
};

export function listMenus(tenantId: string, options: { page: number; pageSize: number; keyword?: string; status?: string }) {
  const filters = ["tenant_id = ?", "deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("status = ?");
    params.push(options.status);
  }
  if (options.keyword) {
    filters.push("(name like ? or code like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(`select count(*) as count from menus where ${where}`, params)?.count ?? 0;
  const items = all<MenuRow>(
    `select id, parent_id as parentId, name, code, icon, status, sort_order as sortOrder, created_at as createdAt
     from menus where ${where} order by sort_order asc, created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createMenu(
  tenantId: string,
  input: { parentId?: string | null; name: string; code: string; icon?: string; status?: string; sortOrder?: number },
) {
  const id = createId("menu");
  run(
    `insert into menus (id, tenant_id, parent_id, name, code, icon, status, sort_order, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.parentId ?? null, input.name, input.code, input.icon ?? "", input.status ?? "enabled", input.sortOrder ?? 0],
  );
  return get<MenuRow>(
    `select id, parent_id as parentId, name, code, icon, status, sort_order as sortOrder, created_at as createdAt
     from menus where tenant_id = ? and id = ?`,
    [tenantId, id],
  );
}

export function updateMenu(
  tenantId: string,
  id: string,
  input: { parentId?: string | null; name?: string; code?: string; icon?: string; status?: string; sortOrder?: number },
) {
  const existing = get<MenuRow>(
    `select id, parent_id as parentId, name, code, icon, status, sort_order as sortOrder from menus where tenant_id = ? and id = ? and deleted_at is null limit 1`,
    [tenantId, id],
  );
  if (!existing) return undefined;
  run(
    `update menus set parent_id = ?, name = ?, code = ?, icon = ?, status = ?, sort_order = ?, updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [
      input.parentId !== undefined ? input.parentId : existing.parentId,
      input.name ?? existing.name,
      input.code ?? existing.code,
      input.icon ?? existing.icon,
      input.status ?? existing.status,
      input.sortOrder ?? existing.sortOrder,
      tenantId, id,
    ],
  );
  return get<MenuRow>(
    `select id, parent_id as parentId, name, code, icon, status, sort_order as sortOrder, created_at as createdAt
     from menus where tenant_id = ? and id = ?`,
    [tenantId, id],
  );
}

export function deleteMenu(tenantId: string, id: string) {
  run(`update menus set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?`, [tenantId, id]);
}

// ===== 岗位管理 =====

export type PostRow = {
  id: string;
  orgId: string | null;
  orgName: string | null;
  name: string;
  headcount: number;
  status: string;
  roleCode: string | null;
  roleName: string | null;
  industryPackageId: string | null;
  industryPackageName: string | null;
  sortOrder: number;
  createdAt: string;
};

export function listPosts(tenantId: string, options: { page: number; pageSize: number; keyword?: string; status?: string }) {
  const filters = ["p.tenant_id = ?", "p.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("p.status = ?");
    params.push(options.status);
  }
  if (options.keyword) {
    filters.push("(p.name like ? or o.name like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(
    `select count(*) as count from posts p left join organizations o on o.id = p.org_id and o.tenant_id = p.tenant_id where ${where}`,
    params,
  )?.count ?? 0;
  const items = all<PostRow>(
    `select p.id, p.org_id as orgId, o.name as orgName, p.name, p.headcount, p.status,
            p.role_code as roleCode, r.name as roleName, p.industry_package_id as industryPackageId, ip.name as industryPackageName,
            p.sort_order as sortOrder, p.created_at as createdAt
     from posts p
     left join organizations o on o.id = p.org_id and o.tenant_id = p.tenant_id
     left join roles r on r.code = p.role_code and r.tenant_id = p.tenant_id
     left join industry_packages ip on ip.id = p.industry_package_id and ip.tenant_id = p.tenant_id
     where ${where} order by p.sort_order asc, p.created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createPost(
  tenantId: string,
  input: { orgId?: string | null; name: string; headcount?: number; status?: string; roleCode?: string | null; industryPackageId?: string | null; sortOrder?: number },
) {
  const id = createId("post");
  run(
    `insert into posts (id, tenant_id, org_id, name, headcount, status, role_code, industry_package_id, sort_order, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.orgId ?? null, input.name, input.headcount ?? 0, input.status ?? "enabled", input.roleCode ?? null, input.industryPackageId ?? null, input.sortOrder ?? 0],
  );
  return get<PostRow>(
    `select p.id, p.org_id as orgId, o.name as orgName, p.name, p.headcount, p.status,
            p.role_code as roleCode, r.name as roleName, p.industry_package_id as industryPackageId, ip.name as industryPackageName,
            p.sort_order as sortOrder, p.created_at as createdAt
     from posts p left join organizations o on o.id = p.org_id and o.tenant_id = p.tenant_id
     left join roles r on r.code = p.role_code and r.tenant_id = p.tenant_id
     left join industry_packages ip on ip.id = p.industry_package_id and ip.tenant_id = p.tenant_id
     where p.tenant_id = ? and p.id = ?`,
    [tenantId, id],
  );
}

export function updatePost(
  tenantId: string,
  id: string,
  input: { orgId?: string | null; name?: string; headcount?: number; status?: string; roleCode?: string | null; industryPackageId?: string | null; sortOrder?: number },
) {
  const existing = get<PostRow>(
    `select p.id, p.org_id as orgId, o.name as orgName, p.name, p.headcount, p.status,
            p.role_code as roleCode, p.industry_package_id as industryPackageId, p.sort_order as sortOrder
     from posts p left join organizations o on o.id = p.org_id and o.tenant_id = p.tenant_id
     where p.tenant_id = ? and p.id = ? and p.deleted_at is null limit 1`,
    [tenantId, id],
  );
  if (!existing) return undefined;
  run(
    `update posts set org_id = ?, name = ?, headcount = ?, status = ?, role_code = ?, industry_package_id = ?, sort_order = ?, updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [
      input.orgId !== undefined ? input.orgId : existing.orgId,
      input.name ?? existing.name,
      input.headcount ?? existing.headcount,
      input.status ?? existing.status,
      input.roleCode !== undefined ? input.roleCode : existing.roleCode,
      input.industryPackageId !== undefined ? input.industryPackageId : existing.industryPackageId,
      input.sortOrder ?? existing.sortOrder,
      tenantId, id,
    ],
  );
  return get<PostRow>(
    `select p.id, p.org_id as orgId, o.name as orgName, p.name, p.headcount, p.status,
            p.role_code as roleCode, r.name as roleName, p.industry_package_id as industryPackageId, ip.name as industryPackageName,
            p.sort_order as sortOrder, p.created_at as createdAt
     from posts p left join organizations o on o.id = p.org_id and o.tenant_id = p.tenant_id
     left join roles r on r.code = p.role_code and r.tenant_id = p.tenant_id
     left join industry_packages ip on ip.id = p.industry_package_id and ip.tenant_id = p.tenant_id
     where p.tenant_id = ? and p.id = ?`,
    [tenantId, id],
  );
}

export function deletePost(tenantId: string, id: string) {
  run(`update posts set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?`, [tenantId, id]);
}

// ===== 企业知识库 =====

export type KnowledgeFolderRow = {
  id: string;
  name: string;
  description: string;
  fileCount: number;
  totalSize: number;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export function listKnowledgeFolders(tenantId: string, options: { page: number; pageSize: number; keyword?: string }) {
  const filters = ["kf.tenant_id = ?", "kf.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.keyword) {
    filters.push("(kf.name like ? or kf.description like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(
    `select count(*) as count from knowledge_folders kf where ${where}`,
    params,
  )?.count ?? 0;
  const items = all<KnowledgeFolderRow>(
    `select kf.id, kf.name, kf.description, kf.file_count as fileCount, kf.total_size as totalSize,
            kf.created_by as createdBy, u.name as creatorName, kf.created_at as createdAt, kf.updated_at as updatedAt
     from knowledge_folders kf
     left join users u on u.id = kf.created_by and u.tenant_id = kf.tenant_id
     where ${where} order by kf.created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createKnowledgeFolder(
  tenantId: string,
  input: { name: string; description?: string; createdBy?: string | null },
) {
  const id = createId("kf");
  run(
    `insert into knowledge_folders (id, tenant_id, name, description, file_count, total_size, created_by, created_at, updated_at)
     values (?, ?, ?, ?, 0, 0, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.name, input.description ?? "", input.createdBy ?? null],
  );
  return get<KnowledgeFolderRow>(
    `select kf.id, kf.name, kf.description, kf.file_count as fileCount, kf.total_size as totalSize,
            kf.created_by as createdBy, u.name as creatorName, kf.created_at as createdAt, kf.updated_at as updatedAt
     from knowledge_folders kf
     left join users u on u.id = kf.created_by and u.tenant_id = kf.tenant_id
     where kf.tenant_id = ? and kf.id = ?`,
    [tenantId, id],
  );
}

export function updateKnowledgeFolder(
  tenantId: string,
  id: string,
  input: { name?: string; description?: string },
) {
  const existing = get<KnowledgeFolderRow>(
    `select id, name, description from knowledge_folders where tenant_id = ? and id = ? and deleted_at is null limit 1`,
    [tenantId, id],
  );
  if (!existing) return undefined;
  run(
    `update knowledge_folders set name = ?, description = ?, updated_at = datetime('now') where tenant_id = ? and id = ?`,
    [input.name ?? existing.name, input.description ?? existing.description, tenantId, id],
  );
  return get<KnowledgeFolderRow>(
    `select kf.id, kf.name, kf.description, kf.file_count as fileCount, kf.total_size as totalSize,
            kf.created_by as createdBy, u.name as creatorName, kf.created_at as createdAt, kf.updated_at as updatedAt
     from knowledge_folders kf
     left join users u on u.id = kf.created_by and u.tenant_id = kf.tenant_id
     where kf.tenant_id = ? and kf.id = ?`,
    [tenantId, id],
  );
}

export function deleteKnowledgeFolder(tenantId: string, id: string) {
  run(`update knowledge_folders set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?`, [tenantId, id]);
}

// ===== 知识库文件 =====

export type KnowledgeFileRow = {
  id: string;
  folderId: string;
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  content: string;
  summary: string;
  parseStatus: string;
  parseError: string;
  uploaderName: string | null;
  createdAt: string;
  updatedAt: string;
};

export function createKnowledgeFile(
  tenantId: string,
  input: {
    folderId: string;
    fileId: string;
    name: string;
    mimeType: string;
    size: number;
    content: string;
    summary: string;
    parseStatus: string;
    parseError?: string;
    createdBy?: string | null;
  },
) {
  const id = createId("kf");
  run(
    `insert into knowledge_files (id, tenant_id, folder_id, file_id, name, mime_type, size, content, summary, parse_status, parse_error, created_by, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.folderId, input.fileId, input.name, input.mimeType, input.size, input.content, input.summary, input.parseStatus, input.parseError ?? "", input.createdBy ?? null],
  );
  return get<KnowledgeFileRow>(
    `select kf.id, kf.folder_id as folderId, kf.file_id as fileId, kf.name, kf.mime_type as mimeType, kf.size,
            kf.content, kf.summary, kf.parse_status as parseStatus, kf.parse_error as parseError,
            u.name as uploaderName, kf.created_at as createdAt, kf.updated_at as updatedAt
     from knowledge_files kf
     left join users u on u.id = kf.created_by and u.tenant_id = kf.tenant_id
     where kf.tenant_id = ? and kf.id = ?`,
    [tenantId, id],
  );
}

export function listKnowledgeFiles(tenantId: string, folderId: string) {
  return all<KnowledgeFileRow>(
    `select kf.id, kf.folder_id as folderId, kf.file_id as fileId, kf.name, kf.mime_type as mimeType, kf.size,
            kf.content, kf.summary, kf.parse_status as parseStatus, kf.parse_error as parseError,
            u.name as uploaderName, kf.created_at as createdAt, kf.updated_at as updatedAt
     from knowledge_files kf
     left join users u on u.id = kf.created_by and u.tenant_id = kf.tenant_id
     where kf.tenant_id = ? and kf.folder_id = ? and kf.deleted_at is null
     order by kf.created_at desc`,
    [tenantId, folderId],
  );
}

export function getKnowledgeFile(tenantId: string, id: string) {
  return get<KnowledgeFileRow>(
    `select kf.id, kf.folder_id as folderId, kf.file_id as fileId, kf.name, kf.mime_type as mimeType, kf.size,
            kf.content, kf.summary, kf.parse_status as parseStatus, kf.parse_error as parseError,
            u.name as uploaderName, kf.created_at as createdAt, kf.updated_at as updatedAt
     from knowledge_files kf
     left join users u on u.id = kf.created_by and u.tenant_id = kf.tenant_id
     where kf.tenant_id = ? and kf.id = ? and kf.deleted_at is null`,
    [tenantId, id],
  );
}

export function deleteKnowledgeFile(tenantId: string, id: string) {
  run(`update knowledge_files set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?`, [tenantId, id]);
}

// 文件夹 file_count / total_size 联动
export function bumpKnowledgeFolderStats(tenantId: string, folderId: string, deltaCount: number, deltaSize: number) {
  run(
    `update knowledge_folders
     set file_count = max(0, file_count + ?), total_size = max(0, total_size + ?), updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [deltaCount, deltaSize, tenantId, folderId],
  );
}

// 出题联动：拉取已解析知识文件摘要（可选按文件 ID 过滤）
export function listKnowledgeSummaries(tenantId: string, limit = 20, fileIds?: string[]) {
  const filters = ["kf.tenant_id = ?", "kf.parse_status = 'done'", "kf.deleted_at is null", "kf.summary <> ''"];
  const params: unknown[] = [tenantId];
  if (fileIds && fileIds.length > 0) {
    filters.push(`kf.id in (${fileIds.map(() => "?").join(", ")})`);
    params.push(...fileIds);
  }
  return all<{ folderName: string; name: string; summary: string }>(
    `select kf.name, kf.summary, kfolder.name as folderName
     from knowledge_files kf
     left join knowledge_folders kfolder on kfolder.id = kf.folder_id and kfolder.tenant_id = kf.tenant_id and kfolder.deleted_at is null
     where ${filters.join(" and ")}
     order by kf.created_at desc limit ?`,
    [...params, limit],
  );
}
