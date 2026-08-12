// 共享类型与 UI 组件，供 admin-dashboard 拆分出的各区块组件复用。
// 拆分自 admin-dashboard.tsx，保持渲染行为与原文件完全一致。
import type { AuthSession } from "@zxt/shared";

// ============ 类型定义（原 admin-dashboard.tsx 顶部） ============

export type NavChild = { id: string; key: string; label: string; icon: React.ReactNode };
export type NavItem = {
  id: string;
  key: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  group?: string;
  children?: NavChild[];
};

export type Organization = {
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

export type TrainingRecord = {
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

export type Appeal = {
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

export type ActiveSection =
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

// ---------- 共享 UI 组件 ----------

export function statusBadge(status: string) {
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

export function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
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

export function Field({ label, children, required, count, max, hint }: { label: string; children: React.ReactNode; required?: boolean; count?: number; max?: number; hint?: string }) {
  return (
    <label className="zfield">
      <span className="zfield-label">{label}{required ? <span className="zreq">*</span> : null}</span>
      {children}
      {hint ? <span className="zfield-hint">{hint}</span> : null}
      {typeof count === "number" ? <span className="zfield-count">{count}{typeof max === "number" ? `/${max}` : ""}</span> : null}
    </label>
  );
}

// 标签: 模式/状态（对齐原型）
export function Tag({ tone, children }: { tone: "blue" | "cyan" | "green" | "amber" | "red" | "gray"; children: React.ReactNode }) {
  return <span className={`ztag ztag-${tone}`}>{children}</span>;
}

// 模式标签（语音/文本）
export function modeTag(mode: string) {
  if (mode === "text") return <Tag tone="cyan">文本模式</Tag>;
  return <Tag tone="blue">语音模式</Tag>;
}

// 状态标签（启用/停用等）
export function statusTag(status: string) {
  const map: Record<string, { tone: "green" | "red" | "amber" | "gray"; label: string }> = {
    enabled: { tone: "green", label: "启用" },
    disabled: { tone: "red", label: "停用" },
    published: { tone: "green", label: "已发布" },
    draft: { tone: "amber", label: "草稿" },
    completed: { tone: "green", label: "已完成" },
    in_progress: { tone: "amber", label: "进行中" },
    pending: { tone: "amber", label: "待处理" },
    active: { tone: "green", label: "有效" },
  };
  const item = map[status];
  return item ? <Tag tone={item.tone}>{item.label}</Tag> : <Tag tone="gray">{status || "-"}</Tag>;
}

// 供区块组件统一读取用户信息
export type { AuthSession };