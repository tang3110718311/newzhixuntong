import { randomBytes } from "node:crypto";
import { all, createId, get, run } from "./sqlite";
import { hashPassword, hashSessionToken, verifyPassword } from "./password";

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
  sceneType: string;
  mode: string;
  status: string;
  isTemplate: number;
  sourceType: string;
  description?: string;
  passScore: number;
};


export type SceneRoleRow = {
  id: string;
  roleType: string;
  identity: string;
  background: string;
  personality: string;
  emotion: string;
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
};

export type TrainingRecordDetail = {
  record: TrainingRecordRow;
  turns: TrainingTurnRow[];
  scores: ScoreDetailRow[];
  suggestions: string[];
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
  startedAt?: string | null;
  finishedAt?: string | null;
  turns: Array<{ speaker: "ai" | "learner"; text: string; durationMs?: number; startedAt?: string | null; emotion?: string }>;
  scores: Array<{ scoringRuleId?: string | null; score: number; deductionReason?: string; evidenceText?: string }>;
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
  sceneType: string;
  description: string;
  sourceType: string;
  aiRole: {
    identity: string;
    background: string;
    personality: string;
    emotion: string;
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

function selectAuthUserWhere(whereSql: string, params: unknown[]) {
  return get<AuthUserWithPassword>(
    `select u.id, u.tenant_id as tenantId, t.code as tenantCode, t.name as tenantName,
            u.name, u.mobile, u.email, u.role_code as roleCode, u.status, u.org_id as orgId, o.name as orgName,
            u.password_hash as passwordHash, u.password_must_change as passwordMustChange
     from users u
     inner join tenants t on t.id = u.tenant_id and t.deleted_at is null and t.status = 'active'
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where ${whereSql} and u.deleted_at is null limit 1`,
    params,
  );
}

function stripPassword(row: AuthUserWithPassword): AuthUserRow {
  const { passwordHash: _passwordHash, ...user } = row;
  return user;
}

export function loginWithPassword(input: { tenantCode: string; mobile: string; password: string; userAgent?: string; ip?: string }): AuthSessionRow | undefined {
  const user = selectAuthUserWhere("t.code = ? and u.mobile = ?", [input.tenantCode, input.mobile]);
  if (!user || user.status !== "active" || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) return undefined;

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
  const fallback = { sceneLimit: 50, aiTokenLimit: 100000, sttSeconds: 3600, ttsCharacters: 100000 };
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
    resourceQuota: { sceneLimit: number; aiTokenLimit: number; sttSeconds: number; ttsCharacters: number };
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
export function listUsers(tenantId: string, options: { page: number; pageSize: number; keyword?: string; status?: string }) {
  const filters = ["u.tenant_id = ?", "u.deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("u.status = ?");
    params.push(options.status);
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
export function listScenes(tenantId: string, options: { page: number; pageSize: number; keyword?: string; status?: string }) {
  const filters = ["tenant_id = ?", "deleted_at is null"];
  const params: unknown[] = [tenantId];
  if (options.status) {
    filters.push("status = ?");
    params.push(options.status);
  }
  if (options.keyword) {
    filters.push("(name like ? or code like ? or scene_type like ?)");
    params.push(`%${options.keyword}%`, `%${options.keyword}%`, `%${options.keyword}%`);
  }
  const where = filters.join(" and ");
  const total = get<{ count: number }>(`select count(*) as count from scenes where ${where}`, params)?.count ?? 0;
  const items = all<SceneRow>(
    `select id, name, code, industry_package_id as industryPackageId, scene_type as sceneType, mode, status, is_template as isTemplate, source_type as sourceType, description,
            coalesce(pass_score, 80) as passScore
     from scenes where ${where} order by is_template desc, created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createScene(tenantId: string, input: { industryPackageId?: string | null; name: string; code: string; mode: string; sceneType: string; description: string }) {
  const id = createId("scene");
  run(
    `insert into scenes (id, tenant_id, industry_package_id, name, code, mode, scene_type, description, status, source_type, is_template, version, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'manual', 0, '1.0.0', datetime('now'), datetime('now'))`,
    [id, tenantId, input.industryPackageId ?? null, input.name, input.code, input.mode, input.sceneType, input.description],
  );
  return get<SceneRow>(
    "select id, name, code, industry_package_id as industryPackageId, scene_type as sceneType, mode, status, is_template as isTemplate, source_type as sourceType, description, coalesce(pass_score, 80) as passScore from scenes where id = ?",
    [id],
  );
}

export function createGeneratedScene(tenantId: string, input: GeneratedSceneInput) {
  const id = createId("scene");
  const safeCode = input.code || `AI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  run(
    `insert into scenes (id, tenant_id, industry_package_id, name, code, mode, scene_type, description, status, source_type, is_template, version, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, 0, '1.0.0', datetime('now'), datetime('now'))`,
    [id, tenantId, input.industryPackageId ?? null, input.name, safeCode, input.mode, input.sceneType, input.description, input.sourceType],
  );
  run(
    `insert into scene_roles (id, tenant_id, scene_id, role_type, identity, background, personality, emotion, goal, created_at, updated_at)
     values (?, ?, ?, 'ai', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [createId("role"), tenantId, id, input.aiRole.identity, input.aiRole.background, input.aiRole.personality, input.aiRole.emotion, input.aiRole.goal],
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
    "select id, name, code, industry_package_id as industryPackageId, scene_type as sceneType, mode, status, is_template as isTemplate, source_type as sourceType, description, coalesce(pass_score, 80) as passScore from scenes where id = ?",
    [id],
  );
}

export function getSceneDetail(tenantId: string, sceneId: string): SceneDetail | undefined {
  const scene = get<SceneRow & { industryPackageName: string | null }>(
    `select s.id, s.name, s.code, s.industry_package_id as industryPackageId, ip.name as industryPackageName,
            s.scene_type as sceneType, s.mode, s.status, s.is_template as isTemplate, s.source_type as sourceType, s.description,
            coalesce(s.pass_score, 80) as passScore
     from scenes s
     left join industry_packages ip on ip.id = s.industry_package_id and ip.tenant_id = s.tenant_id
     where s.tenant_id = ? and s.id = ? and s.deleted_at is null limit 1`,
    [tenantId, sceneId],
  );
  if (!scene) return undefined;
  const roles = all<SceneRoleRow>(
    `select id, role_type as roleType, identity, background, personality, emotion, goal
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
    "select id, name, code, industry_package_id as industryPackageId, scene_type as sceneType, mode, status, is_template as isTemplate, source_type as sourceType, description, coalesce(pass_score, 80) as passScore from scenes where tenant_id = ? and id = ?",
    [tenantId, sceneId],
  );
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

export function listTasks(tenantId: string, options: { page: number; pageSize: number; keyword?: string; status?: string }) {
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
  const where = filters.join(" and ");
  const total = get<{ count: number }>(`select count(*) as count from tasks t where ${where}`, params)?.count ?? 0;
  const items = all<Omit<TaskRow, "progressPercent">>(
    `select t.id, t.name, t.code, t.type, coalesce(t.description, '') as description, t.status,
            t.start_at as startAt, t.end_at as endAt, t.publish_at as publishAt, t.created_by as createdBy,
            (select max(tr.finished_at) from training_records tr where tr.tenant_id = t.tenant_id and tr.task_id = t.id and tr.status = 'completed' and tr.deleted_at is null) as completedAt,
            u.name as creatorName, o.name as creatorOrgName,
            (select count(*) from task_participants tp where tp.tenant_id = t.tenant_id and tp.task_id = t.id and tp.deleted_at is null) as participantCount,
            (select count(*) from task_scenes ts where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null) as sceneCount,
            (select count(distinct tr.scene_id) from training_records tr where tr.tenant_id = t.tenant_id and tr.task_id = t.id and tr.status = 'completed' and tr.deleted_at is null) as completedSceneCount,
            (select s.scene_type from task_scenes ts left join scenes s on s.id = ts.scene_id and s.tenant_id = ts.tenant_id where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null order by ts.sort_order asc limit 1) as primarySceneType,
            (select s.mode from task_scenes ts left join scenes s on s.id = ts.scene_id and s.tenant_id = ts.tenant_id where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null order by ts.sort_order asc limit 1) as primaryMode
     from tasks t
     left join users u on u.id = t.created_by and u.tenant_id = t.tenant_id
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where ${where} order by t.created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
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

export function getTaskDetail(tenantId: string, taskId: string): TaskDetail | undefined {
  const rawTask = get<Omit<TaskRow, "progressPercent">>(
    `select t.id, t.name, t.code, t.type, coalesce(t.description, '') as description, t.status,
            t.start_at as startAt, t.end_at as endAt, t.publish_at as publishAt, t.created_by as createdBy,
            (select max(tr.finished_at) from training_records tr where tr.tenant_id = t.tenant_id and tr.task_id = t.id and tr.status = 'completed' and tr.deleted_at is null) as completedAt,
            u.name as creatorName, o.name as creatorOrgName,
            (select count(*) from task_participants tp where tp.tenant_id = t.tenant_id and tp.task_id = t.id and tp.deleted_at is null) as participantCount,
            (select count(*) from task_scenes ts where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null) as sceneCount,
            (select count(distinct tr.scene_id) from training_records tr where tr.tenant_id = t.tenant_id and tr.task_id = t.id and tr.status = 'completed' and tr.deleted_at is null) as completedSceneCount,
            (select s.scene_type from task_scenes ts left join scenes s on s.id = ts.scene_id and s.tenant_id = ts.tenant_id where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null order by ts.sort_order asc limit 1) as primarySceneType,
            (select s.mode from task_scenes ts left join scenes s on s.id = ts.scene_id and s.tenant_id = ts.tenant_id where ts.tenant_id = t.tenant_id and ts.task_id = t.id and ts.deleted_at is null order by ts.sort_order asc limit 1) as primaryMode
     from tasks t
     left join users u on u.id = t.created_by and u.tenant_id = t.tenant_id
     left join organizations o on o.id = u.org_id and o.tenant_id = u.tenant_id
     where t.tenant_id = ? and t.id = ? and t.deleted_at is null limit 1`,
    [tenantId, taskId],
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
            (select count(*) from training_records tr where tr.tenant_id = ts.tenant_id and tr.task_id = ts.task_id and tr.scene_id = ts.scene_id and tr.status = 'completed' and tr.deleted_at is null) as completedTrainCount
     from task_scenes ts
     left join scenes s on s.id = ts.scene_id and s.tenant_id = ts.tenant_id
     where ts.tenant_id = ? and ts.task_id = ? and ts.deleted_at is null
     order by ts.sort_order asc, ts.created_at asc`,
    [tenantId, taskId],
  );
  const participants = all<TaskParticipantRow>(
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
export function createTask(tenantId: string, input: { name: string; code: string; type: string; sceneIds: string[]; participantUserIds?: string[]; participantOrgIds?: string[]; startAt?: string; endAt?: string }) {
  const id = createId("task");
  run(
    `insert into tasks (id, tenant_id, name, code, type, status, start_at, end_at, created_at, updated_at)
     values (?, ?, ?, ?, ?, 'draft', ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.name, input.code, input.type, input.startAt ?? null, input.endAt ?? null],
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
  return get<TaskRow>("select id, name, code, type, status, end_at as endAt from tasks where tenant_id = ? and id = ?", [tenantId, taskId]);
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
    const existing = get<{ id: string }>(
      "select id from training_records where tenant_id = ? and session_id = ? and deleted_at is null limit 1",
      [tenantId, input.sessionId],
    );
    if (existing) {
      return getTrainingRecordDetail(tenantId, existing.id);
    }
  }
  const scene = get<{ id: string }>("select id from scenes where tenant_id = ? and id = ? and deleted_at is null limit 1", [tenantId, input.sceneId]);
  if (!scene) return undefined;
  if (input.taskId) {
    const task = get<{ id: string }>("select id from tasks where tenant_id = ? and id = ? and deleted_at is null limit 1", [tenantId, input.taskId]);
    if (!task) return undefined;
  }
  if (input.userId) {
    const user = get<{ id: string }>("select id from users where tenant_id = ? and id = ? and deleted_at is null limit 1", [tenantId, input.userId]);
    if (!user) return undefined;
  }
  const id = createId("record");
  const recordNo = `TR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const startedAt = input.startedAt ?? new Date().toISOString();
  const finishedAt = input.finishedAt ?? (input.status === "completed" ? new Date().toISOString() : null);
  const suggestionsJson = JSON.stringify(input.suggestions ?? []);
  run(
    `insert into training_records (id, tenant_id, record_no, task_id, scene_id, user_id, mode, status, score, session_id, suggestions, started_at, finished_at, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, recordNo, input.taskId ?? null, input.sceneId, input.userId ?? null, input.mode, input.status, input.score, input.sessionId ?? null, suggestionsJson, startedAt, finishedAt],
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
      `insert into score_details (id, tenant_id, record_id, scoring_rule_id, score, deduction_reason, evidence_text, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [createId("sd"), tenantId, id, score.scoringRuleId ?? null, score.score, score.deductionReason ?? "", score.evidenceText ?? ""],
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
export function getTrainingRecordDetail(tenantId: string, recordId: string): TrainingRecordDetail | undefined {
  const record = get<TrainingRecordRow>(
    `select tr.id, tr.record_no as recordNo, tr.task_id as taskId, t.name as taskName, tr.scene_id as sceneId, s.name as sceneName,
            tr.user_id as userId, u.name as userName, tr.mode, tr.status, tr.score, tr.session_id as sessionId,
            tr.started_at as startedAt, tr.finished_at as finishedAt
     from training_records tr
     left join tasks t on t.id = tr.task_id and t.tenant_id = tr.tenant_id
     left join scenes s on s.id = tr.scene_id and s.tenant_id = tr.tenant_id
     left join users u on u.id = tr.user_id and u.tenant_id = tr.tenant_id
     where tr.tenant_id = ? and tr.id = ? and tr.deleted_at is null limit 1`,
    [tenantId, recordId],
  );
  if (!record) return undefined;
  const turns = all<TrainingTurnRow>(
    `select id, speaker, text, duration_ms as durationMs, started_at as startedAt, emotion
     from training_turns where tenant_id = ? and record_id = ? and deleted_at is null order by created_at asc`,
    [tenantId, recordId],
  );
  const scores = all<ScoreDetailRow>(
    `select sd.id, sr.name as ruleName, sd.score, sd.deduction_reason as deductionReason, sd.evidence_text as evidenceText
     from score_details sd
     left join scoring_rules sr on sr.id = sd.scoring_rule_id and sr.tenant_id = sd.tenant_id
     where sd.tenant_id = ? and sd.record_id = ? and sd.deleted_at is null order by sd.created_at asc`,
    [tenantId, recordId],
  );
  const suggestionsRow = get<{ suggestions: string }>(
    "select suggestions from training_records where tenant_id = ? and id = ? and deleted_at is null limit 1",
    [tenantId, recordId],
  );
  let suggestions: string[] = [];
  if (suggestionsRow?.suggestions) {
    try {
      const parsed = JSON.parse(suggestionsRow.suggestions);
      if (Array.isArray(parsed)) suggestions = parsed.filter((s) => typeof s === "string");
    } catch { /* ignore invalid json */ }
  }
  return { record, turns, scores, suggestions };
}

/** 按对练会话查询训练记录（评分异步完成后前端轮询用） */
export function getTrainingRecordBySessionId(tenantId: string, sessionId: string): TrainingRecordDetail | undefined {
  const found = get<{ id: string }>(
    "select id from training_records where tenant_id = ? and session_id = ? and deleted_at is null limit 1",
    [tenantId, sessionId],
  );
  if (!found) return undefined;
  return getTrainingRecordDetail(tenantId, found.id);
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
  return get<AiProviderRow & { apiKeyEncrypted: string }>(
    `select id, provider_type as providerType, provider_name as providerName, model_name as modelName, base_url as baseUrl,
            api_key_encrypted as apiKeyEncrypted, status, is_default as isDefault
     from ai_provider_configs where tenant_id = ? and provider_type = ? and is_default = 1 and deleted_at is null limit 1`,
    [tenantId, providerType],
  );
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
  const apiKey = input.apiKey || existing?.apiKeyEncrypted || "";
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
  options: string;
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
  return all<ExamQuestionRow>(
    `select id, bank_id as bankId, type, stem, options, answer, analysis, score, sort_order as sortOrder, created_at as createdAt
     from exam_questions
     where tenant_id = ? and deleted_at is null ${bankId ? "and bank_id = ?" : ""}
     order by sort_order asc, created_at asc`,
    bankId ? [tenantId, bankId] : [tenantId],
  );
}

function getExamQuestion(tenantId: string, id: string): ExamQuestionRow | undefined {
  return get<ExamQuestionRow>(
    `select id, bank_id as bankId, type, stem, options, answer, analysis, score, sort_order as sortOrder, created_at as createdAt
     from exam_questions where tenant_id = ? and id = ? and deleted_at is null limit 1`,
    [tenantId, id],
  );
}

export function updateExamQuestion(tenantId: string, id: string, input: { stem?: string; options?: string[]; answer?: string; analysis?: string; score?: number }) {
  const existing = getExamQuestion(tenantId, id);
  if (!existing) return undefined;
  run(
    `update exam_questions set stem = ?, options = ?, answer = ?, analysis = ?, score = ?, updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [
      input.stem ?? existing.stem,
      input.options ? JSON.stringify(input.options) : existing.options,
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

export function listExams(tenantId: string) {
  return all<ExamRow>(
    `select id, name, code, bank_id as bankId, description, duration_minutes as durationMinutes,
            pass_score as passScore, total_score as totalScore, question_count as questionCount, status,
            start_at as startAt, end_at as endAt, created_at as createdAt
     from exams where tenant_id = ? and deleted_at is null order by created_at desc`,
    [tenantId],
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

export function createExamAttempt(tenantId: string, input: { examId: string; userId?: string | null }) {
  const exam = getExam(tenantId, input.examId);
  if (!exam) return undefined;
  const id = createId("att");
  run(
    `insert into exam_attempts (id, tenant_id, exam_id, user_id, total_score, status, started_at, created_at, updated_at)
     values (?, ?, ?, ?, ?, 'in_progress', datetime('now'), datetime('now'), datetime('now'))`,
    [id, tenantId, input.examId, input.userId ?? null, exam.totalScore],
  );
  return getExamAttemptDetail(tenantId, id);
}

export function submitExamAttempt(tenantId: string, attemptId: string, answers: Array<{ questionId: string; answer: string }>) {
  const attempt = get<{ id: string; examId: string; status: string }>(
    `select id, exam_id as examId, status from exam_attempts where tenant_id = ? and id = ? and deleted_at is null limit 1`,
    [tenantId, attemptId],
  );
  if (!attempt || attempt.status === "completed") return undefined;
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

export function listExamAttempts(tenantId: string, examId?: string) {
  return all<ExamAttemptRow>(
    `select a.id, a.exam_id as examId, e.name as examName, a.user_id as userId, u.name as userName,
            a.score, a.total_score as totalScore, a.status, a.duration_seconds as durationSeconds,
            a.started_at as startedAt, a.finished_at as finishedAt, a.created_at as createdAt
     from exam_attempts a
     left join exams e on e.id = a.exam_id
     left join users u on u.id = a.user_id
     where a.tenant_id = ? and a.deleted_at is null ${examId ? "and a.exam_id = ?" : ""}
     order by a.created_at desc`,
    examId ? [tenantId, examId] : [tenantId],
  );
}

function getExamAttemptDetail(tenantId: string, attemptId: string): ExamAttemptDetail | undefined {
  const attempt = get<ExamAttemptRow>(
    `select a.id, a.exam_id as examId, e.name as examName, a.user_id as userId, u.name as userName,
            a.score, a.total_score as totalScore, a.status, a.duration_seconds as durationSeconds,
            a.started_at as startedAt, a.finished_at as finishedAt, a.created_at as createdAt
     from exam_attempts a
     left join exams e on e.id = a.exam_id
     left join users u on u.id = a.user_id
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
    `select p.id, p.org_id as orgId, o.name as orgName, p.name, p.headcount, p.status, p.sort_order as sortOrder, p.created_at as createdAt
     from posts p
     left join organizations o on o.id = p.org_id and o.tenant_id = p.tenant_id
     where ${where} order by p.sort_order asc, p.created_at desc limit ? offset ?`,
    [...params, options.pageSize, (options.page - 1) * options.pageSize],
  );
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function createPost(
  tenantId: string,
  input: { orgId?: string | null; name: string; headcount?: number; status?: string; sortOrder?: number },
) {
  const id = createId("post");
  run(
    `insert into posts (id, tenant_id, org_id, name, headcount, status, sort_order, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.orgId ?? null, input.name, input.headcount ?? 0, input.status ?? "enabled", input.sortOrder ?? 0],
  );
  return get<PostRow>(
    `select p.id, p.org_id as orgId, o.name as orgName, p.name, p.headcount, p.status, p.sort_order as sortOrder, p.created_at as createdAt
     from posts p left join organizations o on o.id = p.org_id and o.tenant_id = p.tenant_id
     where p.tenant_id = ? and p.id = ?`,
    [tenantId, id],
  );
}

export function updatePost(
  tenantId: string,
  id: string,
  input: { orgId?: string | null; name?: string; headcount?: number; status?: string; sortOrder?: number },
) {
  const existing = get<PostRow>(
    `select p.id, p.org_id as orgId, o.name as orgName, p.name, p.headcount, p.status, p.sort_order as sortOrder
     from posts p left join organizations o on o.id = p.org_id and o.tenant_id = p.tenant_id
     where p.tenant_id = ? and p.id = ? and p.deleted_at is null limit 1`,
    [tenantId, id],
  );
  if (!existing) return undefined;
  run(
    `update posts set org_id = ?, name = ?, headcount = ?, status = ?, sort_order = ?, updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [
      input.orgId !== undefined ? input.orgId : existing.orgId,
      input.name ?? existing.name,
      input.headcount ?? existing.headcount,
      input.status ?? existing.status,
      input.sortOrder ?? existing.sortOrder,
      tenantId, id,
    ],
  );
  return get<PostRow>(
    `select p.id, p.org_id as orgId, o.name as orgName, p.name, p.headcount, p.status, p.sort_order as sortOrder, p.created_at as createdAt
     from posts p left join organizations o on o.id = p.org_id and o.tenant_id = p.tenant_id
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

// 出题联动：拉取已解析知识文件摘要
export function listKnowledgeSummaries(tenantId: string, limit = 20) {
  return all<{ folderName: string; name: string; summary: string }>(
    `select kf.name, kf.summary, kfolder.name as folderName
     from knowledge_files kf
     left join knowledge_folders kfolder on kfolder.id = kf.folder_id and kfolder.tenant_id = kf.tenant_id and kfolder.deleted_at is null
     where kf.tenant_id = ? and kf.parse_status = 'done' and kf.deleted_at is null and kf.summary <> ''
     order by kf.created_at desc limit ?`,
    [tenantId, limit],
  );
}



