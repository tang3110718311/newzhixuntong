// 菜单管理区块：调用真实后端 API 实现增删改查，渲染一级/二级层级
"use client";

import { Plus, Pencil, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTable, Field, statusBadge } from "./dashboard-shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

type Menu = {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  icon: string;
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

const emptyForm = { name: "", code: "", parentId: "", icon: "", status: "enabled", sortOrder: 0 };

// 可选图标清单（lucide 常用图标名，与导航 seed 保持一致）
const ICON_OPTIONS = [
  "BarChart3", "Users", "ClipboardList", "FileText", "Bot", "Database",
  "AlertCircle", "Settings", "ShieldCheck", "Building2", "Briefcase",
  "Landmark", "Menu", "KeyRound", "Home", "BookOpen", "MessageSquare",
  "ScrollText", "FolderOpen", "GraduationCap", "Award", "Layers", "Star",
];

export function SysMenusSection() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<Menu | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Menu | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function loadMenus() {
    setError("");
    try {
      const data = await apiFetch<{ items: Menu[] }>("/menus?pageSize=100");
      setMenus(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载菜单失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMenus();
  }, []);

  const topMenus = menus.filter((menu) => !menu.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenOf = (parentId: string) =>
    menus.filter((menu) => menu.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(menu: Menu) {
    setEditing(menu);
    setForm({
      name: menu.name,
      code: menu.code,
      parentId: menu.parentId ?? "",
      icon: menu.icon,
      status: menu.status,
      sortOrder: menu.sortOrder,
    });
    setShowModal(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const body = { ...form, parentId: form.parentId || null };
    try {
      if (editing) {
        await apiFetch<Menu>(`/menus/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
        setMessage("菜单已更新。");
      } else {
        await apiFetch<Menu>("/menus", { method: "POST", body: JSON.stringify(body) });
        setMessage("菜单已新增。");
      }
      setShowModal(false);
      await loadMenus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function handleDelete(menu: Menu) {
        setError("");
    try {
      await apiFetch<{ id: string }>(`/menus/${menu.id}`, { method: "DELETE" });
      setMessage("菜单已删除。");
      await loadMenus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <h1 className="page-title">菜单管理</h1>
          <p className="page-desc">维护系统侧边栏菜单与层级关系，支持一级与二级菜单配置。</p>
        </div>
        <div className="toolbar">
          <button className="btn primary" type="button" onClick={openCreate}>新增菜单</button>
        </div>
      </div>
      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}
      <div className="card section">
        {loading ? (
          <div className="empty">正在加载菜单数据…</div>
        ) : (
          <DataTable headers={["菜单名称", "层级", "图标", "排序", "状态", "操作"]}>
            {topMenus.map((menu) => (
              <tr key={menu.id}>
                <td><strong>{menu.name}</strong></td>
                <td>一级菜单</td>
                <td className="muted-text">{menu.icon || "—"}</td>
                <td>{menu.sortOrder}</td>
                <td>{statusBadge(menu.status)}</td>
                <td>
                  <button className="link-btn" type="button" onClick={() => openEdit(menu)}><Pencil size={14} /> 编辑</button>
                  <button className="link-btn danger" type="button" onClick={() => setConfirmTarget(menu)}><Trash2 size={14} /> 删除</button>
                </td>
              </tr>
            ))}
            {topMenus.flatMap((menu) =>
              childrenOf(menu.id).map((child) => (
                <tr key={child.id}>
                  <td><strong>{child.name}</strong></td>
                  <td>二级菜单</td>
                  <td className="muted-text">{child.icon || "—"}</td>
                  <td>{child.sortOrder}</td>
                  <td>{statusBadge(child.status)}</td>
                  <td>
                    <button className="link-btn" type="button" onClick={() => openEdit(child)}><Pencil size={14} /> 编辑</button>
                    <button className="link-btn danger" type="button" onClick={() => setConfirmTarget(child)}><Trash2 size={14} /> 删除</button>
                  </td>
                </tr>
              )),
            )}
            {!menus.length && <tr><td colSpan={6}><div className="empty">暂无菜单，请点击「新增菜单」创建。</div></td></tr>}
          </DataTable>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <form className="modal-card" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div className="modal-head">
              <h2>{editing ? "编辑菜单" : "新增菜单"}</h2>
              <button className="link-btn" type="button" onClick={() => setShowModal(false)}>关闭</button>
            </div>
            <Field label="菜单名称"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="菜单编码（key）"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!editing} /></Field>
            <Field label="上级菜单">
              <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                <option value="">作为一级菜单</option>
                {topMenus.filter((menu) => menu.id !== editing?.id).map((menu) => (
                  <option key={menu.id} value={menu.id}>{menu.name}</option>
                ))}
              </select>
            </Field>
            <Field label="图标">
              <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
                <option value="">无图标</option>
                {ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </Field>
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
        message={confirmTarget ? `确认删除菜单「${confirmTarget.name}」？删除后不可恢复。` : ""}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => { const t = confirmTarget; setConfirmTarget(null); if (t) void handleDelete(t); }}
      />
    </section>
  );
}