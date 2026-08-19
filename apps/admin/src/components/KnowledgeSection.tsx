"use client";

import { Folder, MoreHorizontal, Plus, Search, Upload, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { type AuthSession, type TrainingRecord } from "./dashboard-shared";
import { ConfirmDialog } from "./ConfirmDialog";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const PAGE_SIZE = 10;

type KnowledgeProps = { auth: AuthSession; records: TrainingRecord[]; completedRecordCount: number; pendingAppealCount: number };
type FolderData = { id: string; name: string; description: string; fileCount: number; totalSize: number; creatorName: string | null; createdAt: string; updatedAt: string };
type KnowledgeFile = { id: string; folderId: string; name: string; mimeType: string; size: number; content: string; summary: string; parseStatus: "parsing" | "done" | "failed"; parseError: string; uploaderName: string | null; createdAt: string };
type DialogMode = "create" | "upload" | "rename" | null;

function getToken() {
  try { return JSON.parse(window.localStorage.getItem("zxt-admin-auth") || "{}").token || ""; } catch { return ""; }
}
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, { ...init, cache: "no-store", headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...init?.headers } });
  const payload = await response.json() as { success: boolean; data: T; message?: string; code?: string };
  if (!payload.success) throw new Error(payload.message || payload.code || "请求失败");
  return payload.data;
}
function formatSize(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"]; let value = bytes; let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
function formatTime(value: string) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function typeLabel(mimeType: string) {
  if (mimeType.startsWith("video/")) return "视频";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("word")) return "Word";
  if (mimeType.includes("spreadsheet")) return "Excel";
  if (mimeType.includes("presentation")) return "PPT";
  if (mimeType.includes("text")) return "TXT";
  return "文件";
}
function typeIcon(mimeType: string) { return mimeType.startsWith("video/") ? "▶" : typeLabel(mimeType) === "Word" ? "DOC" : typeLabel(mimeType) === "Excel" ? "XLS" : typeLabel(mimeType); }

export function KnowledgeSection({ auth, records, completedRecordCount, pendingAppealCount }: KnowledgeProps) {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [activeFolder, setActiveFolder] = useState<FolderData | null>(null);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [folderKeyword, setFolderKeyword] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [fileKeyword, setFileKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [folderMenu, setFolderMenu] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<KnowledgeFile | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ type: "folder" | "file"; id: string; name: string } | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);

  async function loadFolders() {
    try { setError(""); setLoading(true); const data = await apiFetch<{ items: FolderData[] }>("/knowledge?pageSize=100"); setFolders(data.items); }
    catch (e) { setError(e instanceof Error ? e.message : "加载知识库失败"); }
    finally { setLoading(false); }
  }
  async function loadFiles(folderId: string) {
    try { setFilesLoading(true); const data = await apiFetch<KnowledgeFile[]>(`/knowledge/files?folderId=${encodeURIComponent(folderId)}`); setFiles(data); }
    catch (e) { setError(e instanceof Error ? e.message : "加载文件失败"); setFiles([]); }
    finally { setFilesLoading(false); }
  }
  useEffect(() => { void loadFolders(); }, []);
  useEffect(() => { setPage(1); }, [folderKeyword, folderFilter]);

  const filteredFolders = folders.filter((folder) => (folderFilter === "all" || folder.id === folderFilter) && (!folderKeyword || `${folder.name}${folder.description}`.toLowerCase().includes(folderKeyword.toLowerCase())));
  const totalPages = Math.max(1, Math.ceil(filteredFolders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleFolders = filteredFolders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleFiles = files.filter((file) => !fileKeyword || file.name.toLowerCase().includes(fileKeyword.toLowerCase()));
  const totalFiles = folders.reduce((total, folder) => total + folder.fileCount, 0);
  const totalSize = folders.reduce((total, folder) => total + folder.totalSize, 0);

  function chooseFolder(folder: FolderData) { setActiveFolder(folder); setFileKeyword(""); setFolderMenu(null); void loadFiles(folder.id); }
  function resetFilters() { setFolderKeyword(""); setFolderFilter("all"); }
  function openCreate() { setForm({ name: "", description: "" }); setSelectedFiles([]); setDialog("create"); }
  function openRename(folder: FolderData) { setActiveFolder(folder); setForm({ name: folder.name, description: folder.description || "" }); setFolderMenu(null); setDialog("rename"); }
  function chooseFiles(event: ChangeEvent<HTMLInputElement>) { setSelectedFiles(Array.from(event.target.files || [])); }
  async function uploadFiles(folderId: string, uploadFilesList: File[]) {
    const results = await Promise.allSettled(uploadFilesList.map(async (file) => { const data = new FormData(); data.append("file", file); data.append("folderId", folderId); return apiFetch<KnowledgeFile>("/knowledge/files", { method: "POST", body: data }); }));
    const failed = results.filter((result) => result.status === "rejected");
    return { successCount: results.length - failed.length, failed };
  }
  async function submitFolder(event: FormEvent) {
    event.preventDefault(); if (!form.name.trim()) return; setSubmitting(true); setError("");
    try {
      let target: FolderData;
      if (dialog === "rename" && activeFolder) target = await apiFetch<FolderData>(`/knowledge/${activeFolder.id}`, { method: "PUT", body: JSON.stringify(form) });
      else target = await apiFetch<FolderData>("/knowledge", { method: "POST", body: JSON.stringify(form) });
      let createMessage = dialog === "rename" ? "文件夹已重命名。" : "文件夹已创建。";
      if (dialog === "create" && selectedFiles.length) {
        const uploadResult = await uploadFiles(target.id, selectedFiles);
        if (uploadResult.failed.length) createMessage = `文件夹已创建，${uploadResult.successCount} 个文件已添加，${uploadResult.failed.length} 个文件添加失败。`;
      }
      setMessage(createMessage); setDialog(null); await loadFolders();
      if (activeFolder?.id === target.id || dialog === "create") { setActiveFolder(target); await loadFiles(target.id); }
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败"); }
    finally { setSubmitting(false); }
  }
  async function submitUpload(event: FormEvent) {
    event.preventDefault(); if (!activeFolder || !selectedFiles.length) return; setSubmitting(true); setError("");
    try { const uploadResult = await uploadFiles(activeFolder.id, selectedFiles); setMessage(uploadResult.failed.length ? `${uploadResult.successCount} 个文件已添加，${uploadResult.failed.length} 个文件添加失败。` : `已添加 ${selectedFiles.length} 个文件。`); setDialog(null); await loadFiles(activeFolder.id); await loadFolders(); }
    catch (e) { setError(e instanceof Error ? e.message : "添加文件失败"); }
    finally { setSubmitting(false); }
  }
  async function deleteTarget() {
    const target = confirmTarget; if (!target) return; setConfirmTarget(null); setError("");
    try {
      if (target.type === "folder") {
        const folder = folders.find((item) => item.id === target.id);
        if (folder && folder.fileCount > 0) { setError("文件夹内仍有文件，请先删除或转移全部文件后再删除文件夹。"); return; }
      }
      await apiFetch<{ id: string }>(target.type === "folder" ? `/knowledge/${target.id}` : `/knowledge/files/${target.id}`, { method: "DELETE" });
      setMessage(`${target.type === "folder" ? "文件夹" : "文件"}已删除。`);
      if (target.type === "folder") { if (activeFolder?.id === target.id) { setActiveFolder(null); setFiles([]); } await loadFolders(); }
      else if (activeFolder) { await loadFiles(activeFolder.id); await loadFolders(); }
    } catch (e) { setError(e instanceof Error ? e.message : "删除失败"); }
  }

  return <section className="page-section knowledge-page">
    <div className="home-grid"><div className="home-main">
      <div className="knowledge-head card"><h1>企业知识库</h1><p>按文件夹管理企业培训资料；点击左侧文件夹查看其中的全部子文件。</p></div>
      {message && <div className="notice">{message}</div>}{error && <div className="notice error">{error}</div>}
      <div className="knowledge-filter card"><div className="knowledge-filter-title"><b>筛选文件夹</b><span>按名称或位置查找</span></div><div className="knowledge-top-tools">
        <div className="knowledge-search"><Search size={16}/><input placeholder="搜索文件夹名称" value={folderKeyword} onChange={(e) => setFolderKeyword(e.target.value)} /></div>
        <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)}><option value="all">所在文件夹：全部</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
        <div className="knowledge-filter-actions"><button className="btn" type="button" onClick={() => setPage(1)}>查询</button><button className="btn outline" type="button" onClick={resetFilters}>重置</button></div>
      </div></div>
      <div className="knowledge-layout">
        <aside className="knowledge-folder-panel card"><div className="knowledge-panel-heading"><div><span className="knowledge-panel-kicker">文件夹目录</span><h2>文件夹列表 <em>{folders.length}</em></h2></div></div><button className="btn knowledge-folder-add" type="button" onClick={openCreate}><Plus size={16}/> 新建文件夹</button><p className="knowledge-panel-note">选择文件夹，查看其中的全部子文件</p>
          <div className="knowledge-folder-list">{loading ? <div className="knowledge-empty">正在加载…</div> : visibleFolders.map((folder) => <div className={`knowledge-folder-item ${activeFolder?.id === folder.id ? "active" : ""}`} key={folder.id} onClick={() => chooseFolder(folder)}><span className="knowledge-icon folder"><Folder size={17}/></span><span className="knowledge-folder-item-body"><b>{folder.name}</b><small>{folder.fileCount} 个子文件 · {formatSize(folder.totalSize)}</small></span><button className="knowledge-folder-more" type="button" onClick={(e) => { e.stopPropagation(); setFolderMenu(folderMenu === folder.id ? null : folder.id); }}><MoreHorizontal size={19}/></button>{folderMenu === folder.id && <div className="knowledge-folder-context-menu" onClick={(e) => e.stopPropagation()}><button onClick={() => openRename(folder)}>重命名</button><button className="danger" onClick={() => { setFolderMenu(null); setConfirmTarget({ type: "folder", id: folder.id, name: folder.name }); }}>删除</button></div>}</div>)}</div>
          {filteredFolders.length > 0 && <div className="knowledge-folder-pagebar"><span>共 {filteredFolders.length} 个文件夹</span><div><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button><b>{currentPage}</b><button disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>›</button></div></div>}
        </aside>
        <main className="knowledge-files-panel card"><div className="knowledge-summary knowledge-summary-inline"><div><span>文件总数</span><strong>{totalFiles}</strong><small>已归档文件</small></div><div><span>视频资料</span><strong>—</strong><small>暂未支持上传视频</small></div><div><span>存储空间</span><strong>{formatSize(totalSize)}</strong><small>当前已上传资料</small></div></div>
          {activeFolder ? <><div className="knowledge-detail-head"><div><span className="knowledge-panel-kicker">子文件列表</span><h2>{activeFolder.name} · 子文件</h2><p>{activeFolder.description || "当前文件夹全部子文件"}</p></div><div className="knowledge-detail-actions"><button className="btn outline" type="button" onClick={() => { setActiveFolder(null); setFiles([]); }}>返回文件夹列表</button><button className="btn" type="button" onClick={() => { setSelectedFiles([]); setDialog("upload"); }}><Plus size={16}/> 添加文件</button></div></div>
            <div className="knowledge-detail-toolbar"><div className="knowledge-search"><Search size={16}/><input placeholder="搜索当前文件夹中的文件" value={fileKeyword} onChange={(e) => setFileKeyword(e.target.value)} /></div><button className="btn" type="button">查询</button><button className="btn outline" type="button" onClick={() => setFileKeyword("")}>重置</button></div>
            <div className="knowledge-files-count"><b>共 {visibleFiles.length} 个文件（全部 {files.length} 个）</b><span>当前文件夹全部子文件</span></div><div className="table-wrap knowledge-files-table-wrap"><table className="knowledge-files-table"><thead><tr><th>文件名称</th><th>文件类型</th><th>文件大小</th><th>上传人</th><th>上传时间</th><th>操作</th></tr></thead><tbody>{filesLoading ? <tr><td colSpan={6} className="knowledge-empty">正在加载文件…</td></tr> : visibleFiles.map((file) => <tr key={file.id}><td><div className="knowledge-name"><span className={`knowledge-file-icon ${typeLabel(file.mimeType).toLowerCase()}`}>{typeIcon(file.mimeType)}</span><div><b>{file.name}</b><small>文件夹：{activeFolder.name}</small></div></div></td><td>{typeLabel(file.mimeType)}</td><td>{formatSize(file.size)}</td><td>{file.uploaderName || "—"}</td><td>{formatTime(file.createdAt)}</td><td><div className="knowledge-file-ops"><button onClick={() => setPreview(file)}>查看</button><button className="danger" onClick={() => setConfirmTarget({ type: "file", id: file.id, name: file.name })}>删除</button></div></td></tr>)}{!filesLoading && !visibleFiles.length && <tr><td colSpan={6} className="knowledge-empty">暂无文件</td></tr>}</tbody></table></div></> : <div className="knowledge-detail-placeholder"><Folder size={34}/><b>请选择左侧文件夹</b><span>选择文件夹后可查看子文件、添加文件或进行删除操作。</span></div>}
        </main>
      </div>
    </div><aside className="right-rail"><div className="profile card"><span className="avatar large"/><div><h2>{auth.user.name}</h2><p>企业管理员</p><p>培训负责人</p></div></div><div className="sidecard card"><div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div><strong>{completedRecordCount}</strong><p>已完成培训任务</p><div className="mini-stats"><span>对练<b>{records.length}</b></span><span>考试<b>0</b></span><span>合格率<b>{records.length ? `${Math.round(records.filter((item) => item.score >= 80).length / records.length * 100)}%` : "0%"}</b></span></div></div><div className="sidecard card"><h2>通知消息</h2><p>{pendingAppealCount ? `当前有 ${pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息。系统将及时推送任务派发、培训安排及学习进度提醒。"}</p></div></aside></div>
    {dialog && <div className="modal-overlay" onClick={() => setDialog(null)}><form className="knowledge-modal-card" onClick={(e) => e.stopPropagation()} onSubmit={dialog === "upload" ? submitUpload : submitFolder}><div className="knowledge-modal-title"><h2>{dialog === "create" ? "新建知识库文件夹" : dialog === "rename" ? "重命名文件夹" : "添加文件到当前文件夹"}</h2><button type="button" onClick={() => setDialog(null)}><X size={19}/></button></div>{dialog !== "upload" && <><label>文件夹名称<i>*</i><input value={form.name} maxLength={120} placeholder="例如：2026年安全生产培训资料" onChange={(e) => setForm({ ...form, name: e.target.value })}/></label><label>文件夹说明<textarea value={form.description} maxLength={1000} placeholder="请输入文件夹说明（选填）" onChange={(e) => setForm({ ...form, description: e.target.value })}/></label></>}{dialog === "upload" && <label>目标文件夹<div className="knowledge-target-field">{activeFolder?.name}</div></label>}<label>{dialog === "create" ? "初始文件（可选）" : "选择文件"}{dialog === "upload" && <i>*</i>}<div className="knowledge-upload-box"><button type="button" onClick={() => uploadInput.current?.click()}><Upload size={16}/> 选择多个文件</button><input ref={uploadInput} hidden type="file" multiple accept=".pdf,.docx,.xlsx,.pptx,.txt,.md" onChange={chooseFiles}/><span>{selectedFiles.length ? selectedFiles.map((file) => file.name).join("、") : dialog === "create" ? "可先创建空文件夹，之后继续添加文件" : "尚未选择文件"}</span></div></label><div className="knowledge-modal-actions"><button className="btn outline" type="button" onClick={() => setDialog(null)}>取消</button><button className="btn" disabled={submitting || (dialog === "upload" && !selectedFiles.length)}>{submitting ? "处理中…" : dialog === "create" ? "创建文件夹" : dialog === "rename" ? "保存" : "添加文件"}</button></div></form></div>}
    {preview && <div className="modal-overlay" onClick={() => setPreview(null)}><div className="knowledge-preview-card" onClick={(e) => e.stopPropagation()}><div className="knowledge-modal-title"><div><h2>{preview.name}</h2><p>{typeLabel(preview.mimeType)} · {formatSize(preview.size)} · 上传人 {preview.uploaderName || "—"}</p></div><button type="button" onClick={() => setPreview(null)}><X size={19}/></button></div><div className="knowledge-preview-content">{preview.parseStatus === "failed" ? "该文件解析失败，无法预览内容。" : preview.content || "暂无可预览的内容（该文件可能仅作为附件存储）。"}</div>{preview.summary && <div className="knowledge-preview-summary"><b>AI 摘要：</b>{preview.summary}</div>}</div></div>}
    <ConfirmDialog open={!!confirmTarget} title="删除确认" message={confirmTarget ? `确认删除${confirmTarget.type === "folder" ? "文件夹" : "文件"}「${confirmTarget.name}」？删除后不可恢复。` : ""} onCancel={() => setConfirmTarget(null)} onConfirm={() => void deleteTarget()}/>
  </section>;
}
