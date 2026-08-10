import { pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "../../..");
const dbPath = process.env.SQLITE_DB_PATH ? resolve(process.env.SQLITE_DB_PATH) : resolve(rootDir, "storage/dev.db");
mkdirSync(dirname(dbPath), { recursive: true });

const SQL = await initSqlJs();

let db;
if (existsSync(dbPath)) {
  const buffer = readFileSync(dbPath);
  db = new SQL.Database(buffer);
} else {
  db = new SQL.Database();
}
db.run("PRAGMA foreign_keys = ON;");

function saveDb() {
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
}

function exec(sql) {
  db.exec(sql);
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  stmt.step();
  stmt.free();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

exec(`
create table if not exists tenants (
  id text primary key,
  name text not null,
  code text not null unique,
  status text not null default 'active',
  password_hash text not null default '',
  password_must_change integer not null default 1,
  last_login_at text,
  plan_code text not null default 'trial',
  expire_at text,
  resource_quota_json text not null default '{}',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists organizations (
  id text primary key,
  tenant_id text not null,
  parent_id text,
  code text not null,
  name text not null,
  type text not null default 'department',
  sort_order integer not null default 0,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique(tenant_id, code)
);

create table if not exists users (
  id text primary key,
  tenant_id text not null,
  org_id text,
  name text not null,
  mobile text not null,
  email text,
  role_code text not null default 'tenant_admin',
  status text not null default 'active',
  password_hash text not null default '',
  password_must_change integer not null default 1,
  last_login_at text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique(tenant_id, mobile)
);


create table if not exists user_sessions (
  id text primary key,
  tenant_id text not null,
  user_id text not null,
  token_hash text not null unique,
  expires_at text not null,
  last_seen_at text not null default current_timestamp,
  user_agent text not null default '',
  ip text not null default '',
  revoked_at text,
  created_at text not null default current_timestamp
);

create index if not exists idx_user_sessions_tenant_user on user_sessions(tenant_id, user_id);
create index if not exists idx_user_sessions_expires_at on user_sessions(expires_at);
create table if not exists industry_packages (
  id text primary key,
  tenant_id text not null,
  name text not null,
  code text not null,
  industry_type text not null,
  target_roles text not null,
  version text not null default '1.0.0',
  status text not null default 'enabled',
  description text not null default '',
  is_system_template integer not null default 0,
  created_by text,
  updated_by text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique(tenant_id, code)
);

create table if not exists capability_models (
  id text primary key,
  tenant_id text not null,
  industry_package_id text not null,
  name text not null,
  description text not null default '',
  pass_score integer not null default 60,
  created_by text,
  updated_by text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists capability_items (
  id text primary key,
  tenant_id text not null,
  capability_model_id text not null,
  name text not null,
  weight integer not null,
  score_desc text not null default '',
  risk_tag text not null default '',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists scenes (
  id text primary key,
  tenant_id text not null,
  industry_package_id text,
  name text not null,
  code text not null,
  mode text not null default 'voice',
  status text not null default 'draft',
  version text not null default '1.0.0',
  is_template integer not null default 0,
  source_type text not null default 'manual',
  scene_type text not null default '',
  description text not null default '',
  created_by text,
  updated_by text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique(tenant_id, code)
);

create table if not exists scene_roles (
  id text primary key,
  tenant_id text not null,
  scene_id text not null,
  role_type text not null,
  identity text not null,
  background text not null default '',
  personality text not null default '',
  emotion text not null default 'calm',
  goal text not null default '',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists scene_rules (
  id text primary key,
  tenant_id text not null,
  scene_id text not null,
  initiator text not null default 'ai',
  end_condition text not null default '',
  interrupt_condition text not null default '',
  description text not null default '',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique(tenant_id, scene_id)
);

create table if not exists scoring_rules (
  id text primary key,
  tenant_id text not null,
  scene_id text not null,
  capability_item_id text,
  name text not null,
  score integer not null,
  criteria text not null,
  deduction_rule text not null default '',
  evidence_required text not null default '',
  sort_order integer not null default 0,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists tasks (
  id text primary key,
  tenant_id text not null,
  code text not null,
  name text not null,
  type text not null,
  description text not null default '',
  status text not null default 'draft',
  start_at text,
  end_at text,
  publish_at text,
  created_by text,
  updated_by text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique(tenant_id, code)
);

create table if not exists task_scenes (
  id text primary key,
  tenant_id text not null,
  task_id text not null,
  scene_id text not null,
  sort_order integer not null default 0,
  required_train_times integer not null default 1,
  pass_score integer not null default 60,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique(tenant_id, task_id, scene_id)
);

create table if not exists task_participants (
  id text primary key,
  tenant_id text not null,
  task_id text not null,
  user_id text,
  org_id text,
  status text not null default 'not_started',
  finished_at text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists training_records (
  id text primary key,
  tenant_id text not null,
  record_no text not null,
  task_id text,
  scene_id text not null,
  user_id text,
  mode text not null default 'voice',
  status text not null default 'completed',
  score integer not null default 0,
  session_id text,
  suggestions text not null default '[]',
  started_at text,
  finished_at text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique(tenant_id, record_no)
);

create table if not exists training_turns (
  id text primary key,
  tenant_id text not null,
  record_id text not null,
  speaker text not null,
  audio_file_id text,
  text text not null,
  started_at text,
  duration_ms integer not null default 0,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists score_details (
  id text primary key,
  tenant_id text not null,
  record_id text not null,
  scoring_rule_id text,
  score integer not null,
  deduction_reason text not null default '',
  evidence_text text not null default '',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists exam_records (
  id text primary key,
  tenant_id text not null,
  task_id text,
  user_id text,
  paper_id text,
  score integer not null default 0,
  status text not null default 'passed',
  submitted_at text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists appeals (
  id text primary key,
  tenant_id text not null,
  biz_type text not null,
  biz_id text not null,
  user_id text,
  reason text not null,
  status text not null default 'pending',
  handler_id text,
  handled_at text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists ai_provider_configs (
  id text primary key,
  tenant_id text not null,
  provider_type text not null,
  provider_name text not null,
  model_name text not null,
  base_url text not null default '',
  api_key_encrypted text not null default '',
  status text not null default 'disabled',
  is_default integer not null default 0,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists ai_call_logs (
  id text primary key,
  tenant_id text not null,
  provider_type text not null,
  model_name text not null default '',
  biz_type text not null,
  biz_id text,
  tokens integer not null default 0,
  audio_seconds integer not null default 0,
  duration_ms integer not null default 0,
  success integer not null default 0,
  error_message text not null default '',
  trace_id text not null,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists files (
  id text primary key,
  tenant_id text not null,
  name text not null,
  mime_type text not null default 'application/octet-stream',
  size integer not null default 0,
  storage_path text not null,
  hash text not null default '',
  created_by text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists materials (
  id text primary key,
  tenant_id text not null,
  name text not null,
  type text not null,
  file_id text,
  industry_package_id text,
  scene_id text,
  tags text not null default '[]',
  status text not null default 'active',
  password_hash text not null default '',
  password_must_change integer not null default 1,
  last_login_at text,
  content text not null default '',
  created_by text,
  updated_by text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists audit_logs (
  id text primary key,
  tenant_id text not null,
  user_id text,
  action text not null,
  biz_type text not null,
  biz_id text,
  before_json text not null default '{}',
  after_json text not null default '{}',
  ip text not null default '',
  trace_id text not null,
  created_at text not null default current_timestamp
);

create table if not exists roles (
  id text primary key,
  tenant_id text not null,
  name text not null,
  code text not null,
  permissions text not null default '[]',
  status text not null default 'enabled',
  sort_order integer not null default 0,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique(tenant_id, code)
);

create table if not exists menus (
  id text primary key,
  tenant_id text not null,
  parent_id text,
  name text not null,
  code text not null,
  icon text not null default '',
  sort_order integer not null default 0,
  status text not null default 'enabled',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique(tenant_id, code)
);

create table if not exists posts (
  id text primary key,
  tenant_id text not null,
  org_id text,
  name text not null,
  headcount integer not null default 0,
  status text not null default 'enabled',
  sort_order integer not null default 0,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists knowledge_folders (
  id text primary key,
  tenant_id text not null,
  name text not null,
  description text not null default '',
  file_count integer not null default 0,
  total_size integer not null default 0,
  created_by text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists knowledge_files (
  id text primary key,
  tenant_id text not null,
  folder_id text not null,
  file_id text not null,
  name text not null,
  mime_type text not null default 'application/octet-stream',
  size integer not null default 0,
  content text not null default '',
  summary text not null default '',
  parse_status text not null default 'parsing',
  parse_error text not null default '',
  created_by text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);
`);

function hasColumn(tableName, columnName) {
  const rows = all(`pragma table_info(${tableName})`, []);
  return rows.some((column) => column.name === columnName);
}

function ensureColumn(tableName, columnName, definition) {
  if (!hasColumn(tableName, columnName)) {
    exec(`alter table ${tableName} add column ${columnName} ${definition}`);
  }
}

ensureColumn("users", "password_hash", "text not null default ''");
ensureColumn("users", "password_must_change", "integer not null default 1");
ensureColumn("users", "last_login_at", "text");
ensureColumn("tasks", "description", "text not null default ''");
ensureColumn("scenes", "pass_score", "integer not null default 80");
ensureColumn("training_records", "session_id", "text");
ensureColumn("training_records", "suggestions", "text not null default '[]'");

// ---- 核心表索引（查询以 tenant_id + deleted_at 过滤，按 record/scene/user/task join）----
exec(`create index if not exists idx_tr_tenant_user_status on training_records(tenant_id, user_id, status)`);
exec(`create index if not exists idx_tr_tenant_scene on training_records(tenant_id, scene_id)`);
exec(`create index if not exists idx_tr_session on training_records(tenant_id, session_id)`);
exec(`create index if not exists idx_tr_tenant_created on training_records(tenant_id, created_at)`);
exec(`create index if not exists idx_tt_record on training_turns(record_id)`);
exec(`create index if not exists idx_sd_record on score_details(record_id)`);
exec(`create index if not exists idx_tp_tenant_task on task_participants(tenant_id, task_id)`);
exec(`create index if not exists idx_tp_tenant_user on task_participants(tenant_id, user_id)`);
exec(`create index if not exists idx_sr_tenant_scene on scoring_rules(tenant_id, scene_id)`);
exec(`create index if not exists idx_sceneroles_tenant_scene on scene_roles(tenant_id, scene_id)`);
exec(`create index if not exists idx_kf_folder on knowledge_files(folder_id)`);
exec(`create index if not exists idx_aicall_tenant_created on ai_call_logs(tenant_id, created_at)`);
exec(`create index if not exists idx_tasks_tenant on tasks(tenant_id, deleted_at)`);
exec(`create index if not exists idx_users_tenant on users(tenant_id, deleted_at)`);
exec(`create index if not exists idx_scenes_tenant on scenes(tenant_id, deleted_at)`);
function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const iterations = 210000;
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha512").toString("base64url");
  return `pbkdf2_sha512$${iterations}$${salt}$${hash}`;
}

const defaultAdminPassword = process.env.ZXT_SEED_ADMIN_PASSWORD || "Zxt@2026";

const tenantId = "tenant_demo";
const orgId = "org_customer_service";
const adminId = "user_admin";
const learnerId = "user_zhou_xiaowen";
const industryId = "industry_customer_service";
const capabilityModelId = "capability_customer_service";
const taskId = "task_customer_service_20260805";
const recordId = "record_customer_complaint_001";

const scenes = [
  ["scene_complaint", "CJ-KF-TS-001", "客户投诉处理对练", "投诉处理", "客户因服务等待时间长、问题未闭环产生不满，训练客服识别诉求、安抚情绪并推进处理。"],
  ["scene_tariff", "CJ-KF-ZF-002", "套餐资费咨询对练", "套餐资费咨询", "客户咨询套餐价格、流量、宽带和合约限制，训练客服解释资费并推荐合适方案。"],
  ["scene_fault", "CJ-KF-GZ-003", "网络故障报修受理对练", "网络故障报修", "客户反馈宽带无法上网，训练客服快速定位问题、登记报修并说明处理安排。"],
];

run(`insert or replace into tenants (id, name, code, status, plan_code, resource_quota_json, created_at, updated_at)
     values (?, '智训通本地验证租户', 'zxt-demo', 'active', 'trial', ?, datetime('now'), datetime('now'))`, [tenantId, JSON.stringify({ sceneLimit: 50, aiTokenLimit: 100000, sttSeconds: 3600 })]);
run(`insert or replace into organizations (id, tenant_id, code, name, type, created_at, updated_at)
     values (?, ?, 'CS-DEPT', '客户服务部', 'department', datetime('now'), datetime('now'))`, [orgId, tenantId]);
run(`insert or replace into users (id, tenant_id, org_id, name, mobile, email, role_code, status, password_hash, password_must_change, created_at, updated_at)
     values (?, ?, ?, '智训通管理员', '13800000000', 'admin@example.com', 'tenant_admin', 'active', ?, 0, datetime('now'), datetime('now'))`, [adminId, tenantId, orgId, hashPassword(defaultAdminPassword)]);
run(`insert or replace into users (id, tenant_id, org_id, name, mobile, role_code, status, password_hash, password_must_change, created_at, updated_at)
     values (?, ?, ?, '周晓雯', '13900000001', 'learner', 'active', ?, 1, datetime('now'), datetime('now'))`, [learnerId, tenantId, orgId, hashPassword(defaultAdminPassword)]);
run(`insert or replace into industry_packages (id, tenant_id, name, code, industry_type, target_roles, version, status, description, is_system_template, created_by, updated_by, created_at, updated_at)
     values (?, ?, '客服训练包', 'IND-CS', 'customer_service', '客服坐席、营业厅客户经理、投诉处理人员、质检主管', '1.0.0', 'enabled', '面向投诉处理、套餐资费咨询、网络故障报修等高频客服场景。', 1, ?, ?, datetime('now'), datetime('now'))`, [industryId, tenantId, adminId, adminId]);
run(`insert or replace into capability_models (id, tenant_id, industry_package_id, name, description, pass_score, created_by, updated_by, created_at, updated_at)
     values (?, ?, ?, '客服岗位能力模型', '客服场景通用能力维度', 80, ?, ?, datetime('now'), datetime('now'))`, [capabilityModelId, tenantId, industryId, adminId, adminId]);
run("delete from capability_items where tenant_id = ? and capability_model_id = ?", [tenantId, capabilityModelId]);
[
  ["cap_need", "需求识别", 25, "快速识别客户核心诉求。"],
  ["cap_compliance", "合规表达", 25, "按业务规范说明边界。"],
  ["cap_emotion", "情绪安抚", 20, "处理客户情绪并保持专业。"],
  ["cap_close", "闭环推进", 30, "明确下一步动作和反馈时限。"],
].forEach(([id, name, weight, desc]) => run(`insert into capability_items (id, tenant_id, capability_model_id, name, weight, score_desc, created_at, updated_at) values (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`, [id, tenantId, capabilityModelId, name, weight, desc]));

for (const [id, code, name, sceneType, description] of scenes) {
  run(`insert or replace into scenes (id, tenant_id, industry_package_id, name, code, mode, status, version, is_template, source_type, scene_type, description, pass_score, created_by, updated_by, created_at, updated_at)
       values (?, ?, ?, ?, ?, 'voice', 'published', '1.0.0', 1, 'template', ?, ?, 80, ?, ?, datetime('now'), datetime('now'))`, [id, tenantId, industryId, name, code, sceneType, description, adminId, adminId]);
  run("delete from scene_roles where tenant_id = ? and scene_id = ?", [tenantId, id]);
  run(`insert into scene_roles (id, tenant_id, scene_id, role_type, identity, background, personality, emotion, goal, created_at, updated_at)
       values (?, ?, ?, 'ai', '业务客户', '客户带着真实业务问题进入咨询或投诉流程。', '关注结果，可能追问细节。', 'calm', '获得明确答复和处理安排。', datetime('now'), datetime('now'))`, [`${id}_role_ai`, tenantId, id]);
  run(`insert into scene_roles (id, tenant_id, scene_id, role_type, identity, goal, created_at, updated_at)
       values (?, ?, ?, 'learner', '客服人员', '识别客户诉求，按规范回应并推进闭环。', datetime('now'), datetime('now'))`, [`${id}_role_learner`, tenantId, id]);
  run(`insert or replace into scene_rules (id, tenant_id, scene_id, initiator, end_condition, interrupt_condition, description, created_at, updated_at)
       values (?, ?, ?, 'ai', '学员完成关键回应并明确后续闭环动作。', '出现违规承诺、辱骂客户、泄露敏感信息时中断。', ?, datetime('now'), datetime('now'))`, [`${id}_rule`, tenantId, id, description]);
  run("delete from scoring_rules where tenant_id = ? and scene_id = ?", [tenantId, id]);
  [
    ["诉求识别", 25, "能准确复述客户核心问题和情绪点。"],
    ["情绪安抚", 20, "表达有同理心，不推诿，不争辩。"],
    ["流程合规", 25, "按业务流程核实信息、登记工单、说明时限。"],
    ["解决推进", 20, "给出明确下一步、责任环节和反馈方式。"],
    ["表达规范", 10, "用语清晰、礼貌、无敏感承诺。"],
  ].forEach(([ruleName, score, criteria], index) => {
    run(`insert into scoring_rules (id, tenant_id, scene_id, name, score, criteria, deduction_rule, evidence_required, sort_order, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, '未覆盖关键动作按比例扣分。', '需从对话文本中找到对应表达证据。', ?, datetime('now'), datetime('now'))`, [`${id}_score_${index + 1}`, tenantId, id, ruleName, score, criteria, index + 1]);
  });
}

run(`insert or replace into tasks (id, tenant_id, code, name, type, description, status, start_at, end_at, publish_at, created_by, updated_by, created_at, updated_at)
     values (?, ?, 'RW-CS-20260805-001', '客服高频场景训练任务', 'scenario_training', '完成客户服务沟通场景的学习、AI对练与考试，覆盖投诉处理、套餐资费咨询、网络故障报修等高频场景。', 'published', '2026-08-05T09:00:00+08:00', '2026-08-12T23:59:59+08:00', datetime('now'), ?, ?, datetime('now'), datetime('now'))`, [taskId, tenantId, adminId, adminId]);
run("delete from task_scenes where tenant_id = ? and task_id = ?", [tenantId, taskId]);
scenes.forEach(([sceneId], index) => run(`insert into task_scenes (id, tenant_id, task_id, scene_id, sort_order, required_train_times, pass_score, created_at, updated_at) values (?, ?, ?, ?, ?, 1, 80, datetime('now'), datetime('now'))`, [`task_scene_${index + 1}`, tenantId, taskId, sceneId, index + 1]));
run("delete from task_participants where tenant_id = ? and task_id = ?", [tenantId, taskId]);
run(`insert into task_participants (id, tenant_id, task_id, user_id, org_id, status, created_at, updated_at) values ('tp_001', ?, ?, ?, ?, 'in_progress', datetime('now'), datetime('now'))`, [tenantId, taskId, learnerId, orgId]);

run(`insert or replace into training_records (id, tenant_id, record_no, task_id, scene_id, user_id, mode, status, score, started_at, finished_at, created_at, updated_at)
     values (?, ?, 'TR-CS-001', ?, 'scene_complaint', ?, 'voice', 'completed', 86, '2026-08-05T10:00:00+08:00', '2026-08-05T10:08:00+08:00', datetime('now'), datetime('now'))`, [recordId, tenantId, taskId, learnerId]);
run("delete from training_turns where tenant_id = ? and record_id = ?", [tenantId, recordId]);
run(`insert into training_turns (id, tenant_id, record_id, speaker, text, duration_ms, emotion, created_at, updated_at) values ('turn_001', ?, ?, 'ai', '我前两天已经反映过宽带问题，现在还是没解决，你们到底什么时候处理？', 8000, 'angry', datetime('now'), datetime('now'))`, [tenantId, recordId]);
    run(`insert into training_turns (id, tenant_id, record_id, speaker, text, duration_ms, emotion, created_at, updated_at) values ('turn_002', ?, ?, 'learner', '非常抱歉给您带来不便，我先帮您核实前一次工单记录，并为您确认这次处理时限。', 9000, '', datetime('now'), datetime('now'))`, [tenantId, recordId]);
run("delete from score_details where tenant_id = ? and record_id = ?", [tenantId, recordId]);
[
  ["sd_001", 22, "诉求识别较完整，但未复述客户等待时间。", "核实前一次工单记录"],
  ["sd_002", 18, "有安抚表达。", "非常抱歉给您带来不便"],
  ["sd_003", 24, "流程基本合规。", "核实前一次工单记录"],
  ["sd_004", 14, "处理时限表达不够明确。", "确认这次处理时限"],
  ["sd_005", 8, "表达规范。", "帮您核实"],
].forEach(([id, score, reason, evidence]) => run(`insert into score_details (id, tenant_id, record_id, score, deduction_reason, evidence_text, created_at, updated_at) values (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`, [id, tenantId, recordId, score, reason, evidence]));

run("delete from ai_provider_configs where tenant_id = ?", [tenantId]);
run(`insert into ai_provider_configs (id, tenant_id, provider_type, provider_name, model_name, base_url, api_key_encrypted, status, is_default, created_at, updated_at)
     values ('ai_config_default', ?, 'llm', '待配置模型供应商', '待配置模型', '', '', 'disabled', 1, datetime('now'), datetime('now'))`, [tenantId]);
run("delete from appeals where tenant_id = ?", [tenantId]);
run(`insert into appeals (id, tenant_id, biz_type, biz_id, user_id, reason, status, created_at, updated_at)
     values ('appeal_001', ?, 'training_record', ?, ?, '学员认为评分对情绪安抚扣分偏高，请复核。', 'pending', datetime('now'), datetime('now'))`, [tenantId, recordId, learnerId]);

// ---- 角色管理 seed ----
run("delete from roles where tenant_id = ?", [tenantId]);
[
  ["role_tenant_admin", "租户管理员", "tenant_admin", ["dashboard:view","scenes:manage","tasks:manage","users:manage","roles:manage","menus:manage","posts:manage","knowledge:manage","statistics:view","settings:manage","appeals:handle","materials:manage","exams:manage"], 1],
  ["role_trainer", "内训师", "trainer", ["dashboard:view","scenes:manage","tasks:manage","materials:manage","exams:manage","knowledge:view","statistics:view","appeals:view"], 2],
  ["role_learner", "学员", "learner", ["my-tasks:view","my-exams:view","knowledge:view","practice:use"], 3],
].forEach(([id, name, code, permissions, sortOrder]) =>
  run(`insert or replace into roles (id, tenant_id, name, code, permissions, status, sort_order, created_at, updated_at)
       values (?, ?, ?, ?, ?, 'enabled', ?, datetime('now'), datetime('now'))`,
    [id, tenantId, name, code, JSON.stringify(permissions), sortOrder])
);

// ---- 菜单管理 seed（与前端 navItems 一致）----
run("delete from menus where tenant_id = ?", [tenantId]);
[
  ["menu_home", null, "首页", "overview", "BarChart3", 1],
  ["menu_student_home", null, "学员首页", "student-home", "Users", 2],
  ["menu_my_tasks", null, "我的任务", "my-tasks", "ClipboardList", 3],
  ["menu_my_exams", null, "我的考试", "my-exams", "FileText", 4],
  ["menu_scenes", null, "场景管理", "scenes", "Bot", 5],
  ["menu_knowledge", null, "企业知识库", "knowledge", "Database", 6],
  ["menu_tasks", null, "任务管理", "tasks", "ClipboardList", 7],
  ["menu_appeals", null, "申诉管理", "appeals", "AlertCircle", 8],
  ["menu_statistics", null, "数据统计", "statistics", "BarChart3", 9],
  ["menu_materials", null, "素材管理", "materials", "FileText", 10],
  ["menu_settings", null, "全局配置", "settings", "Settings", 11],
  ["menu_sys", null, "系统管理", "sys", "ShieldCheck", 12],
  ["menu_statistics_dept", "menu_statistics", "部门数据", "statistics-dept", "Building2", 1],
  ["menu_statistics_learner", "menu_statistics", "学员统计", "statistics-learner", "Users", 2],
  ["menu_sys_users", "menu_sys", "用户管理", "sys-users", "Users", 1],
  ["menu_sys_roles", "menu_sys", "角色管理", "sys-roles", "KeyRound", 2],
  ["menu_sys_menus", "menu_sys", "菜单管理", "sys-menus", "Menu", 3],
  ["menu_sys_departments", "menu_sys", "部门管理", "sys-departments", "Building2", 4],
  ["menu_sys_posts", "menu_sys", "岗位管理", "sys-posts", "Briefcase", 5],
  ["menu_sys_tenants", "menu_sys", "租户管理", "sys-tenants", "Landmark", 6],
].forEach(([id, parentId, name, code, icon, sortOrder]) =>
  run(`insert or replace into menus (id, tenant_id, parent_id, name, code, icon, status, sort_order, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, 'enabled', ?, datetime('now'), datetime('now'))`,
    [id, tenantId, parentId, name, code, icon, sortOrder])
);

// ---- 岗位管理 seed ----
run("delete from posts where tenant_id = ?", [tenantId]);
[
  ["post_agent", "客服坐席", 30, 1],
  ["post_trainer", "内训师", 5, 2],
  ["post_supervisor", "客服主管", 3, 3],
].forEach(([id, name, headcount, sortOrder]) =>
  run(`insert or replace into posts (id, tenant_id, org_id, name, headcount, status, sort_order, created_at, updated_at)
       values (?, ?, ?, ?, ?, 'enabled', ?, datetime('now'), datetime('now'))`,
    [id, tenantId, orgId, name, headcount, sortOrder])
);

// ---- 企业知识库 seed ----
run("delete from knowledge_folders where tenant_id = ?", [tenantId]);
[
  ["kf_safety", "安全生产培训资料", "安全生产制度、视频和应急处置相关资料", 2, 188.6 * 1024 * 1024],
  ["kf_customer_service", "客户服务能力提升", "客户沟通与服务规范培训资料", 2, 5.3 * 1024 * 1024],
  ["kf_business_2026", "2026年业务培训资料", "年度业务流程、产品知识和案例资料", 3, 18.4 * 1024 * 1024],
  ["kf_install_service", "装维服务规范", "装维服务流程和网络故障处理资料", 2, 13.3 * 1024 * 1024],
  ["kf_onboarding", "新员工入职培训", "新员工入职须知、培训视频和考核说明", 3, 32.8 * 1024 * 1024],
].forEach(([id, name, description, fileCount, totalSize]) =>
  run(`insert or replace into knowledge_folders (id, tenant_id, name, description, file_count, total_size, created_by, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, name, description, fileCount, Math.round(totalSize), adminId])
);

saveDb();

console.log(`SQLite initialized: ${dbPath}`);
console.log("Seed complete: tenant=zxt-demo, industry=客服训练包, scenes=3, task=RW-CS-20260805-001");
