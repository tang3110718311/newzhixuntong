// 岗位管理区块：调用真实后端 API 实现增删改查，统计卡与表格均用真实数据
"use client";

import { Plus, Pencil, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTable, Field, statusBadge, type Organization } from "./dashboard-shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

type Post = {
  id: string;
  orgId: string | null;
  orgName: string | null;
  name: string;
  headcount: number;
  status: string;
  sortOrder: number;
  createdAt: string;
};

function getStoredAuthToken() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("zxt-admin-auth");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token || "";
  } catch {
    return "";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json()) as { success: boolean; message?: string; code?: string; data: T };
  if (!payload.success) {
    throw new Error(payload.message || payload.code);
  }
  return payload.data;
}

const emptyForm = { name: "", orgId: "", headcount: 0, status: "enabled", sortOrder: 0 };

export function SysPostsSection({ organizations }: { organizations: Organization[] }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<Post | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function loadPosts() {
    setError("");
    try {
      const data = await apiFetch<{ items: Post[] }>("/posts?pageSize=100");
      setPosts(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载岗位失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPosts();
  }, []);

  const totalHeadcount = posts.reduce((sum, post) => sum + (post.headcount || 0), 0);
  const enabledCount = posts.filter((post) => post.status === "enabled").length;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(post: Post) {
    setEditing(post);
    setForm({
      name: post.name,
      orgId: post.orgId ?? "",
      headcount: post.headcount,
      status: post.status,
      sortOrder: post.sortOrder,
    });
    setShowModal(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const body = { ...form, orgId: form.orgId || null };
    try {
      if (editing) {
        await apiFetch<Post>(`/posts/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
        setMessage("岗位已更新。");
      } else {
        await apiFetch<Post>("/posts", { method: "POST", body: JSON.stringify(body) });
        setMessage("岗位已新增。");
      }
      setShowModal(false);
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function handleDelete(post: Post) {
        setError("");
    try {
      await apiFetch<{ id: string }>(`/posts/${post.id}`, { method: "DELETE" });
      setMessage("岗位已删除。");
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <h1 className="page-title">岗位管理</h1>
          <p className="page-desc">维护企业岗位体系，岗位可与角色、场景训练包关联。</p>
        </div>
        <div className="toolbar">
          <button className="btn primary" type="button" onClick={openCreate}><Plus size={16} /> 新增岗位</button>
        </div>
      </div>
      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}
      <div className="stats prototype-stats" style={{ marginBottom: 24 }}>
        <div className="metric card"><span>岗位总数</span><strong>{posts.length}</strong><small>已配置</small></div>
        <div className="metric card"><span>编制合计</span><strong>{totalHeadcount}</strong><small>人</small></div>
        <div className="metric card"><span>启用岗位</span><strong>{enabledCount}</strong><small>正常运行</small></div>
      </div>
      <div className="card section">
        {loading ? (
          <div className="empty">正在加载岗位数据…</div>
        ) : (
          <DataTable headers={["岗位名称", "所属部门", "编制人数", "状态", "操作"]}>
            {posts.map((post) => (
              <tr key={post.id}>
                <td><strong>{post.name}</strong></td>
                <td className="muted-text">{post.orgName || "—"}</td>
                <td>{post.headcount}</td>
                <td>{statusBadge(post.status)}</td>
                <td>
                  <button className="link-btn" type="button" onClick={() => openEdit(post)}><Pencil size={14} /> 编辑</button>
                  <button className="link-btn danger" type="button" onClick={() => setConfirmTarget(post)}><Trash2 size={14} /> 删除</button>
                </td>
              </tr>
            ))}
            {!posts.length && <tr><td colSpan={5}><div className="empty">暂无岗位，请点击「新增岗位」创建。</div></td></tr>}
          </DataTable>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <form className="modal-card" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div className="modal-head">
              <h2>{editing ? "编辑岗位" : "新增岗位"}</h2>
              <button className="link-btn" type="button" onClick={() => setShowModal(false)}>关闭</button>
            </div>
            <Field label="岗位名称"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="所属部门">
              <select value={form.orgId} onChange={(e) => setForm({ ...form, orgId: e.target.value })}>
                <option value="">不关联部门</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </Field>
            <Field label="编制人数"><input type="number" min={0} value={form.headcount} onChange={(e) => setForm({ ...form, headcount: Number(e.target.value) })} /></Field>
            <Field label="状态">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="enabled">启用</option>
                <option value="disabled">停用</option>
              </select>
            </Field>
            <Field label="排序"><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></Field>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn primary" type="submit">{editing ? "保存" : "创建"}</button>
            </div>
          </form>
        </div>
      )}
      <ConfirmDialog
        open={!!confirmTarget}
        title="删除确认"
        message={confirmTarget ? `确认删除岗位「${confirmTarget.name}」？删除后不可恢复。` : ""}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => { const t = confirmTarget; setConfirmTarget(null); if (t) void handleDelete(t); }}
      />
    </section>
  );
}