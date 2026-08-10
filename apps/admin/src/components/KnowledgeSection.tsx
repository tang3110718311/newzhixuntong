// 企业知识库区块：调用真实后端 API 加载文件夹列表，统计卡用真实数据，支持新建/查看/删除文件夹
// 点击"查看"在文件夹列表下方展开文件详情面板（原型设计）
"use client";

import { Plus, Folder, Eye, Trash2, ChevronUp } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { DataTable, Field, type AuthSession, type TrainingRecord } from "./dashboard-shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

const PAGE_SIZE = 10;

type KnowledgeProps = {
  auth: AuthSession;
  records: TrainingRecord[];
  completedRecordCount: number;
  pendingAppealCount: number;
};

type Folder = {
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

// 知识库文件（对接后端 knowledge_files 表）
type KnowledgeFile = {
  id: string;
  folderId: string;
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  content: string;
  summary: string;
  parseStatus: "parsing" | "done" | "failed"; // parsing / done / failed
  parseError: string;
  uploaderName: string | null;
  createdAt: string;
  updatedAt: string;
};

// MIME -> 展示用文件类型标签
function fileTypeLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "text/plain" || mimeType === "text/markdown") return "TXT";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "Word";
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "Excel";
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "PPT";
  return "文件";
}

// MIME -> 文件类型图标缩写（用于文件行左侧色块）
function fileIconLabel(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf": return "PDF";
    case "text/plain":
    case "text/markdown": return "TXT";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return "DOC";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": return "XLS";
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation": return "PPT";
    default: return "FILE";
  }
}

// 解析状态徽标（parsing 黄 / failed 红+title 提示 / done 绿）
function renderParseStatusBadge(file: KnowledgeFile) {
  if (file.parseStatus === "parsing") {
    return (
      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: "#fff7e6", color: "#fa8c16", fontSize: 12 }}>解析中</span>
    );
  }
  if (file.parseStatus === "failed") {
    return (
      <span title={file.parseError || "解析失败"} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: "#ffeceb", color: "#ed2633", fontSize: 12 }}>解析失败</span>
    );
  }
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: "#e8f8ee", color: "#2fb95d", fontSize: 12 }}>已解析</span>
  );
}

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
  // multipart 请求（FormData body）不设置 Content-Type，由浏览器自动生成 boundary
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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

function formatSize(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function formatTime(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const emptyForm = { name: "", description: "" };

export function KnowledgeSection({ auth, records, completedRecordCount, pendingAppealCount }: KnowledgeProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [expandedFolder, setExpandedFolder] = useState<Folder | null>(null);
  const [fileSearchText, setFileSearchText] = useState("");
  const [form, setForm] = useState(emptyForm);

  // 文件列表（真实 API 数据）
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search & filter state
  const [searchText, setSearchText] = useState("");
  const [filterFolder, setFilterFolder] = useState("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  async function loadFolders() {
    setError("");
    try {
      const data = await apiFetch<{ items: Folder[] }>("/knowledge?pageSize=100");
      setFolders(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载知识库失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFolders();
  }, []);

  const totalFiles = folders.reduce((sum, folder) => sum + (folder.fileCount || 0), 0);
  const totalSize = folders.reduce((sum, folder) => sum + (folder.totalSize || 0), 0);

  // Filtered & paged data
  const filtered = folders.filter((f) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!f.name.toLowerCase().includes(q) && !f.description.toLowerCase().includes(q)) return false;
    }
    if (filterFolder !== "all" && f.id !== filterFolder) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [searchText, filterFolder]);

  function openCreate() {
    setForm(emptyForm);
    setShowModal(true);
  }

  function handleView(folder: Folder) {
    if (expandedFolder?.id === folder.id) {
      setExpandedFolder(null); // 收起
      setFiles([]);
    } else {
      setExpandedFolder(folder);
      setFileSearchText("");
      void loadFiles(folder.id);
    }
  }

  async function loadFiles(folderId: string) {
    setFilesLoading(true);
    setError("");
    try {
      const data = await apiFetch<KnowledgeFile[]>(`/knowledge/files?folderId=${encodeURIComponent(folderId)}`);
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载文件列表失败");
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }

  async function handleDeleteFile(file: KnowledgeFile) {
    if (!window.confirm(`确认删除文件「${file.name}」？`)) return;
    setError("");
    try {
      await apiFetch<{ id: string }>(`/knowledge/files/${file.id}`, { method: "DELETE" });
      setMessage("文件已删除。");
      await loadFiles(file.folderId);
      await loadFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function handleUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !expandedFolder) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folderId", expandedFolder.id);
      const created = await apiFetch<KnowledgeFile>("/knowledge/files", {
        method: "POST",
        body: formData,
      });
      setMessage(
        `文件「${file.name}」${created.parseStatus === "done" ? "已上传并解析。" : "已上传，解析中或解析失败。"}`,
      );
      await loadFiles(expandedFolder.id);
      await loadFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch<Folder>("/knowledge", { method: "POST", body: JSON.stringify(form) });
      setMessage("文件夹已新建。");
      setShowModal(false);
      await loadFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function handleDelete(folder: Folder) {
    if (!window.confirm(`确认删除文件夹「${folder.name}」？`)) return;
    setError("");
    try {
      await apiFetch<{ id: string }>(`/knowledge/${folder.id}`, { method: "DELETE" });
      setMessage("文件夹已删除。");
      if (expandedFolder?.id === folder.id) setExpandedFolder(null);
      await loadFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  function handleResetFilter() {
    setSearchText("");
    setFilterFolder("all");
  }

  // 文件详情面板的文件列表（真实 API 数据 + 搜索过滤）
  const filteredFiles = fileSearchText
    ? files.filter((f) => f.name.toLowerCase().includes(fileSearchText.toLowerCase()))
    : files;

  return (
    <section className="page-section">
      <div className="home-grid">
        <div className="home-main">
          <div className="page-header">
            <div>
              <h1 className="page-title">企业知识库</h1>
              <p className="page-desc">按文件夹管理企业培训资料；每个文件夹可包含多个视频、PDF、Word、Excel、PPT 文件。</p>
            </div>
            <div className="toolbar">
              <button className="btn primary" type="button" onClick={openCreate}><Plus size={16} /> 新建文件夹</button>
            </div>
          </div>
          {message ? <div className="notice">{message}</div> : null}
          {error ? <div className="notice error">{error}</div> : null}

          {/* ── 统计卡（原型彩色数值） ── */}
          <div className="stats prototype-stats stats-4" style={{ marginBottom: 24 }}>
            <div className="metric card"><span>文件夹数量</span><strong>{folders.length}</strong><small>全部知识资料分类</small></div>
            <div className="metric card"><span>文件总数</span><strong style={{ color: "#0f3168" }}>{totalFiles}</strong><small>已归档文件</small></div>
            <div className="metric card"><span>视频资料</span><strong style={{ color: "#8045DD" }}>—</strong><small>可用于课程学习</small></div>
            <div className="metric card"><span>存储空间</span><strong style={{ color: "#32C766" }}>{formatSize(totalSize)}</strong><small>当前已上传资料</small></div>
          </div>

          {/* ── 搜索筛选栏 ── */}
          <div className="card filter-bar" style={{ marginBottom: 16 }}>
            <div className="filter-row">
              <div className="filter-item">
                <input
                  className="filter-input"
                  style={{ width: 260 }}
                  placeholder="搜索文件夹名称/文件名称"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <div className="filter-item">
                <label className="filter-label">所在文件夹</label>
                <select
                  className="filter-select"
                  value={filterFolder}
                  onChange={(e) => setFilterFolder(e.target.value)}
                >
                  <option value="all">全部</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <button className="btn primary" type="button" onClick={() => setCurrentPage(1)}>查询</button>
              <button className="btn" type="button" onClick={handleResetFilter}>重置</button>
            </div>
          </div>

          {/* ── 文件夹列表 ── */}
          <div className="card section">
            <div className="section-head compact">
              <div>
                <h2 className="section-title">文件夹列表</h2>
              </div>
            </div>
            {loading ? (
              <div className="empty">正在加载文件夹数据…</div>
            ) : (
              <DataTable headers={["文件夹名称", "文件夹说明", "文件数量", "占用空间", "创建人", "更新时间", "操作"]}>
                {paged.map((folder) => (
                  <tr key={folder.id}>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Folder size={18} style={{ color: "#F5A623", flexShrink: 0 }} />
                        <strong>{folder.name}</strong>
                      </span>
                    </td>
                    <td className="muted-text">{folder.description || "—"}</td>
                    <td>{folder.fileCount}个文件</td>
                    <td>{formatSize(folder.totalSize)}</td>
                    <td className="muted-text">{folder.creatorName || "—"}</td>
                    <td className="muted-text">{formatTime(folder.updatedAt)}</td>
                    <td>
                      <button className="link-btn" type="button" onClick={() => handleView(folder)}><Eye size={14} /> 查看</button>
                      <button className="link-btn danger" type="button" onClick={() => handleDelete(folder)}><Trash2 size={14} /> 删除</button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={7}><div className="empty">暂无文件夹，请点击「新建文件夹」创建。</div></td></tr>}
              </DataTable>
            )}

            {/* ── 分页器 ── */}
            {filtered.length > 0 && (
              <div className="pagination">
                <span className="pagination-info">共 {filtered.length} 个文件夹，第 {safePage}/{totalPages} 页</span>
                <div className="pagination-controls">
                  <button
                    className="page-btn"
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      className={`page-btn${p === safePage ? " active" : ""}`}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                    >{p}</button>
                  ))}
                  <button
                    className="page-btn"
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >›</button>
                </div>
              </div>
            )}
          </div>

          {/* ── 文件详情面板（展开在文件夹列表下方） ── */}
          {expandedFolder && (
            <div className="card section" style={{ marginTop: 16 }}>
              {/* 标题区 */}
              <div className="section-head compact" style={{ marginBottom: 16 }}>
                <div>
                  <h2 className="section-title" style={{ fontSize: 18 }}>
                    {expandedFolder.name}·文件详情
                  </h2>
                  <p className="section-note">{expandedFolder.description || "暂无说明"}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" type="button" onClick={() => setExpandedFolder(null)}>
                    <ChevronUp size={14} /> 收起详情
                  </button>
                  <button className="btn primary" type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                    <Plus size={14} /> {uploading ? "解析中…" : "新建文件"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept=".pdf,.docx,.xlsx,.pptx,.txt,.md"
                    onChange={handleUploadFile}
                  />
                </div>
              </div>

              {/* 搜索区 */}
              <div className="filter-bar" style={{ padding: "12px 0", marginBottom: 12 }}>
                <div className="filter-row">
                  <div className="filter-item">
                    <input
                      className="filter-input"
                      style={{ width: 300 }}
                      placeholder="搜索当前文件夹中的文件"
                      value={fileSearchText}
                      onChange={(e) => setFileSearchText(e.target.value)}
                    />
                  </div>
                  <button className="btn primary" type="button">查询</button>
                  <button className="btn" type="button" onClick={() => setFileSearchText("")}>重置</button>
                </div>
              </div>

              {/* 文件列表 */}
              <DataTable headers={["文件名称", "文件类型", "文件大小", "解析状态", "上传人", "上传时间", "操作"]}>
                {filesLoading ? (
                  <tr><td colSpan={7}><div className="empty">正在加载文件数据…</div></td></tr>
                ) : (
                  filteredFiles.map((file) => {
                    const isVideo = file.mimeType.startsWith("video/");
                    // 原型：视频=淡紫底#f0edff+深紫#7b61ff三角，其余=淡红底#ffeceb+红色#ed2633
                    const iconBg = isVideo ? "#f0edff" : "#ffeceb";
                    const iconColor = isVideo ? "#7b61ff" : "#ed2633";
                    const iconLabel = isVideo ? "▶" : fileIconLabel(file.mimeType);
                    return (
                      <tr key={file.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 20,
                              height: 20,
                              borderRadius: 3,
                              background: iconBg,
                              color: iconColor,
                              fontSize: isVideo ? 10 : 7,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}>{iconLabel}</span>
                            <div>
                              <div style={{ fontWeight: 600 }}>{file.name}</div>
                              <div style={{ color: "#86909c", fontSize: 12, marginTop: 2 }}>文件夹: {expandedFolder.name}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: "#eaf2ff",
                            color: "#4080ff",
                            fontSize: 12,
                          }}>{fileTypeLabel(file.mimeType)}</span>
                        </td>
                        <td>{formatSize(file.size)}</td>
                        <td>{renderParseStatusBadge(file)}</td>
                        <td className="muted-text">{file.uploaderName || "—"}</td>
                        <td className="muted-text">{formatTime(file.createdAt)}</td>
                        <td>
                          <button className="link-btn" type="button" style={{ color: "#4080ff" }}>查看</button>
                          <button className="link-btn danger" type="button" style={{ color: "#ed2633" }} onClick={() => handleDeleteFile(file)}>删除</button>
                        </td>
                      </tr>
                    );
                  })
                )}
                {!filesLoading && !filteredFiles.length && <tr><td colSpan={7}><div className="empty">暂无文件</div></td></tr>}
              </DataTable>
              <div style={{ padding: "10px 0 4px", color: "#8b98aa", fontSize: 14 }}>
                共 {filteredFiles.length} 个文件
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

      {/* ── 新建文件夹弹窗 ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <form className="modal-card" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div className="modal-head">
              <h2>新建文件夹</h2>
              <button className="link-btn" type="button" onClick={() => setShowModal(false)}>关闭</button>
            </div>
            <Field label="文件夹名称"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="文件夹说明"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="文件夹用途说明" /></Field>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn primary" type="submit">创建</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
