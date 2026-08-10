// 角色管理区块：调用真实后端 API 实现增删改查
"use client";

import { Plus, Pencil, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { DataTable, Field, statusBadge } from "./dashboard-shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

type Role = {
  id: string;
  name: string;
  code: string;
  permissions: string;
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

const emptyForm = { name: "", code: "", permissions: "", status: "enabled", sortOrder: 0 };

export function SysRolesSection() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function loadRoles() {
    setError("");
    try {
      const data = await apiFetch<{ items: Role[] }>("/roles?pageSize=100");
      setRoles(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载角色失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoles();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setForm({
      name: role.name,
      code: role.code,
      permissions: parsePermissions(role.permissions).join("，"),
      status: role.status,
      sortOrder: role.sortOrder,
    });
    setShowModal(true);
  }

  function parsePermissions(raw: string | string[]): string[] {
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const permissions = form.permissions.split(/[，,\s]+/).map((item) => item.trim()).filter(Boolean);
    try {
      if (editing) {
        await apiFetch<Role>(`/roles/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...form, permissions }),
        });
        setMessage("角色已更新。");
      } else {
        await apiFetch<Role>("/roles", {
          method: "POST",
          body: JSON.stringify({ ...form, permissions }),
        });
        setMessage("角色已新增。");
      }
      setShowModal(false);
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function handleDelete(role: Role) {
    if (!window.confirm(`确认删除角色「${role.name}」？`)) return;
    setError("");
    try {
      await apiFetch<{ id: string }>(`/roles/${role.id}`, { method: "DELETE" });
      setMessage("角色已删除。");
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <h1 className="page-title">角色管理</h1>
          <p className="page-desc">定义系统角色及其权限范围，将角色分配给用户以控制可访问的能力。</p>
        </div>
        <div className="toolbar">
          <button className="btn primary" type="button" onClick={openCreate}>新增角色</button>
        </div>
      </div>
      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}
      <div className="card section">
        {loading ? (
          <div className="empty">正在加载角色数据…</div>
        ) : (
          <DataTable headers={["角色名称", "角色编码", "权限范围", "状态", "操作"]}>
            {roles.map((role) => (
              <tr key={role.id}>
                <td><strong>{role.name}</strong></td>
                <td className="muted-text">{role.code}</td>
                <td>{parsePermissions(role.permissions).slice(0, 3).join("、") || "—"}</td>
                <td>{statusBadge(role.status)}</td>
                <td>
                  <button className="link-btn" type="button" onClick={() => openEdit(role)}><Pencil size={14} /> 编辑</button>
                  <button className="link-btn danger" type="button" onClick={() => handleDelete(role)}><Trash2 size={14} /> 删除</button>
                </td>
              </tr>
            ))}
            {!roles.length && <tr><td colSpan={5}><div className="empty">暂无角色，请点击「新增角色」创建。</div></td></tr>}
          </DataTable>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <form className="modal-card" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div className="modal-head">
              <h2>{editing ? "编辑角色" : "新增角色"}</h2>
              <button className="link-btn" type="button" onClick={() => setShowModal(false)}>关闭</button>
            </div>
            <Field label="角色名称"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="角色编码"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!editing} /></Field>
            <Field label="权限范围（逗号分隔）"><textarea value={form.permissions} onChange={(e) => setForm({ ...form, permissions: e.target.value })} placeholder="如：dashboard:view, scenes:manage" /></Field>
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
    </section>
  );
}