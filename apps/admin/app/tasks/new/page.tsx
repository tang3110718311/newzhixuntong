"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiResponse, AuthSession } from "@zxt/shared";
import AppShell, { type RightRailData } from "@/components/AppShell";
import { navigateBackOr, navigateTo } from "@/lib/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const AUTH_STORAGE_KEY = "zxt-admin-auth";

type SceneItem = {
  id: string;
  name: string;
  code: string;
  sceneType: string;
  mode: string;
  status: string;
  taskCount?: number | null;
  creatorOrgName?: string | null;
  industryPackageName?: string | null;
};

type OrgItem = { id: string; name: string };

type LearnerItem = {
  id: string;
  name: string;
  mobile: string;
  roleCode: string;
  orgId: string | null;
  orgName: string | null;
};

type PageResult<T> = { items: T[]; total: number };

function makeCode(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const raw = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_STORAGE_KEY) : null;
  const token = raw ? (JSON.parse(raw) as { token: string }).token : "";
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.success) throw new Error(payload.message || payload.code);
  return payload.data;
}

function getAuth(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const TASK_TYPES: Array<{ value: string; label: string }> = [
  { value: "free_practice", label: "自由对练" },
  { value: "fixed_practice", label: "固定对练" },
  { value: "free_exam", label: "自由考试" },
  { value: "fixed_exam", label: "固定考试" },
];

const PUBLISH_SCOPES = ["按参与学员发布", "按部门发布", "全员发布"];

function sceneVoiceLabel(mode?: string) {
  return mode === "文本模式" || mode === "text" ? "文本对练" : "语音对练";
}

export default function TaskCreatePage() {
  const auth = getAuth();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rightRail, setRightRail] = useState<RightRailData | undefined>(undefined);

  // 数据源
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 基础信息
  const [taskName, setTaskName] = useState("");
  const [owner, setOwner] = useState(auth?.user?.name || "");
  const [taskType, setTaskType] = useState("free_practice");
  const [deptId, setDeptId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [publishScope, setPublishScope] = useState("按参与学员发布");
  const [taskDesc, setTaskDesc] = useState("");

  // 业务场景
  const [selectedScenes, setSelectedScenes] = useState<SceneItem[]>([]);
  const [showScenePicker, setShowScenePicker] = useState(false);
  const [pickerChecked, setPickerChecked] = useState<Set<string>>(new Set());

  // 回答形式与参与学员
  const [answerForm, setAnswerForm] = useState<"voice" | "text">("voice");
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set());
  const [pKeyword, setPKeyword] = useState("");
  const [pDeptId, setPDeptId] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRightRailData().then(setRightRail);
    Promise.all([
      apiFetch<PageResult<SceneItem>>("/scenes?pageSize=100"),
      apiFetch<PageResult<OrgItem>>("/organizations?pageSize=100"),
      apiFetch<PageResult<LearnerItem>>("/users?pageSize=200"),
    ])
      .then(([sceneRes, orgRes, userRes]) => {
        setScenes(sceneRes.items || []);
        setOrgs(orgRes.items || []);
        setLearners((userRes.items || []).filter((u) => u.roleCode === "learner"));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载数据失败"))
      .finally(() => setLoaded(true));
  }, []);

  const scenePool = useMemo(() => scenes.filter((s) => !selectedScenes.some((p) => p.id === s.id)), [scenes, selectedScenes]);

  const filteredLearners = useMemo(() => {
    const k = pKeyword.trim().toLowerCase();
    return learners.filter(
      (u) =>
        (!k || u.name.toLowerCase().includes(k) || u.mobile.includes(k)) &&
        (!pDeptId || u.orgId === pDeptId),
    );
  }, [learners, pKeyword, pDeptId]);

  function toggleParticipant(id: string, checked: boolean) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectPage(checked: boolean) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      filteredLearners.forEach((u) => {
        if (checked) next.add(u.id);
        else next.delete(u.id);
      });
      return next;
    });
  }

  function selectAllLearners() {
    setParticipantIds(new Set(learners.map((u) => u.id)));
  }

  function clearSelected() {
    setParticipantIds(new Set());
  }

  function applyScope() {
    if (publishScope === "全员发布") {
      setParticipantIds(new Set(learners.map((u) => u.id)));
      return;
    }
    if (publishScope === "按部门发布") {
      setParticipantIds(new Set(learners.filter((u) => u.orgId === deptId).map((u) => u.id)));
      return;
    }
    setParticipantIds(new Set());
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const text = await files[0].text();
    const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const matched = learners.filter((u) =>
      rows.some((r) => {
        const cells = r.split(/[,，\t]/).map((c) => c.trim());
        return cells.some((c) => c === u.name || c === u.mobile || c === u.id);
      }),
    );
    setParticipantIds((prev) => {
      const next = new Set(prev);
      matched.forEach((u) => next.add(u.id));
      return next;
    });
    setMessage(`已从名单导入 ${matched.length} 名学员`);
    setTimeout(() => setMessage(""), 2500);
  }

  async function submitTask(publishAfter: boolean) {
    if (!taskName.trim()) { setError("请输入任务名称"); return; }
    if (!deptId) { setError("请选择所属部门"); return; }
    if (!periodStart || !periodEnd) { setError("请选择任务周期"); return; }
    if (new Date(periodEnd) <= new Date(periodStart)) { setError("结束时间需晚于开始时间"); return; }
    if (!selectedScenes.length) { setError("请至少添加一个业务场景"); return; }
    if (!participantIds.size) { setError("请至少选择一名参与学员"); return; }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const body = {
        name: taskName.trim(),
        code: makeCode("RW"),
        type: taskType,
        description: taskDesc,
        sceneIds: selectedScenes.map((s) => s.id),
        participantUserIds: Array.from(participantIds),
        participantOrgIds: deptId ? [deptId] : [],
        startAt: new Date(periodStart).toISOString(),
        endAt: new Date(periodEnd).toISOString(),
        answerForm,
      };
      const created = await apiFetch<{ id: string }>("/tasks", { method: "POST", body: JSON.stringify(body) });
      if (publishAfter) {
        await apiFetch(`/tasks/${created.id}/publish`, { method: "POST", body: JSON.stringify({}) });
      }
       navigateBackOr("/?section=tasks");
    } catch (err) {
      setError(err instanceof Error ? err.message : publishAfter ? "发布失败" : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  function openScenePicker() {
    setPickerChecked(new Set());
    setShowScenePicker(true);
  }

  function confirmScenePicker() {
    const added = scenePool.filter((s) => pickerChecked.has(s.id));
    if (added.length) setSelectedScenes((prev) => [...prev, ...added]);
    setShowScenePicker(false);
  }

  const selectedLearnerCount = participantIds.size;
  const pageAllChecked = filteredLearners.length > 0 && filteredLearners.every((u) => participantIds.has(u.id));

  return (
    <AppShell
      activeNavKey="tasks"
      onNavClick={(key: string) => { navigateTo("/?section=" + key); }}
      rightRail={rightRail}
      breadcrumb={{ label: "任务管理", childLabel: "创建任务" }}
    >
      <div className="page-section tm-mod">
        {error && <div className="notice">{error}</div>}
        {message && <div className="success">{message}</div>}

        <div className="task-create-page">
          {/* 顶部 */}
          <div className="task-create-top">
            <div>
              <h1>创建任务</h1>
              <p>创建新的企业培训任务，配置基础信息、业务场景、回答形式与参与学员</p>
            </div>
            <div className="task-create-actions">
               <button className="btn outline" type="button" onClick={() => navigateBackOr("/?section=tasks")} disabled={submitting}>取消</button>
              <button className="btn outline" type="button" disabled={submitting} onClick={() => submitTask(false)}>{submitting ? "保存中…" : "保存"}</button>
              <button className="btn" type="button" disabled={submitting} onClick={() => submitTask(true)}>{submitting ? "发布中…" : "发布"}</button>
            </div>
          </div>

          {/* 基础信息 */}
          <div className="task-create-card card">
            <h2>基础信息</h2>
            <p className="section-desc">先填写任务的基本信息，后续可继续配置场景和学习内容</p>
            <div className="task-base-grid">
              <div className="task-base-item">
                <label>任务名称<i>*</i></label>
                <input className="field" maxLength={60} value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="请输入任务名称" />
              </div>
              <div className="task-base-item">
                <label>负责人<i>*</i></label>
                <select className="field" value={owner} onChange={(e) => setOwner(e.target.value)}>
                  <option value="">请选择负责人</option>
                  <option value={auth?.user?.name || "智训通管理员"}>{auth?.user?.name || "智训通管理员"}</option>
                  {learners.slice(0, 5).map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </div>
              <div className="task-base-item">
                <label>任务类型</label>
                <select className="field" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                  {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="task-base-item">
                <label>所属部门<i>*</i></label>
                <select className="field" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                  <option value="">请选择所属部门</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="task-base-item">
                <label>任务周期<i>*</i></label>
                <input className="field" type="datetime-local" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} placeholder="开始时间" />
              </div>
              <div className="task-base-item">
                <label>&nbsp;</label>
                <input className="field" type="datetime-local" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} placeholder="结束时间" />
              </div>
              <div className="task-base-item">
                <label>发布范围</label>
                <select className="field" value={publishScope} onChange={(e) => { setPublishScope(e.target.value); setTimeout(applyScope, 0); }}>
                  {PUBLISH_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="task-base-item full">
                <label>任务说明</label>
                <textarea className="field" maxLength={300} value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="请输入任务目标与学习要求"></textarea>
              </div>
            </div>
          </div>

          {/* 配置业务场景 */}
          <div className="task-create-card card">
            <h2>配置业务场景</h2>
            <p className="section-desc">添加任务所需的业务场景，并为每个场景配置对应的 AI 对练</p>
            <div className="task-scene-config">
              <div className="task-scene-list" id="createSceneRows">
                {selectedScenes.length ? selectedScenes.map((x, i) => (
                  <div className="task-scene-row" key={x.id}>
                    <span className="task-scene-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="task-scene-name">
                      {x.name}
                      <small>{x.creatorOrgName || x.industryPackageName || "未分组"} · 已关联 {x.taskCount ?? 0} 个任务</small>
                    </span>
                    <span className={`task-scene-type${sceneVoiceLabel(x.mode) === "语音对练" ? " voice" : ""}`}>● {sceneVoiceLabel(x.mode)}</span>
                    <a className="task-scene-link" onClick={() => navigateTo(`/scenes/${x.id}`)}>查看资料 · 配置对练 <b>›</b></a>
                    <button className="task-scene-remove" type="button" onClick={() => setSelectedScenes((prev) => prev.filter((p) => p.id !== x.id))}>移除</button>
                  </div>
                )) : (
                  <div className="task-scene-empty">暂未添加业务场景<br /><small>点击右侧“添加业务场景”开始配置</small></div>
                )}
              </div>
              <div className="task-scene-add">
                <button id="createAddScene" type="button" onClick={openScenePicker}>＋ 添加业务场景</button>
                <small id="createSceneCount">已添加 {selectedScenes.length} 个场景</small>
              </div>
            </div>
          </div>

          {/* 回答形式 + 参与学员 */}
          <div className="task-create-card card">
            <div className="task-answer-grid">
              <div>
                <h2>回答形式</h2>
                <p className="section-desc">选择一种学员在 AI 对练中的回答方式</p>
                <div className="task-answer-options">
                  {(["语音输入", "文本输入"] as const).map((label) => {
                    const value = label === "语音输入" ? "voice" : "text";
                    return (
                      <label className="task-answer-option" key={value}>
                        <input name="createAnswer" type="radio" value={label} checked={answerForm === value} onChange={() => setAnswerForm(value)} />
                        <span>
                          <b>{label}</b>
                          <small>{value === "voice" ? "适合口语表达与情景演练" : "适合文字作答与内容沉淀"}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="task-answer-tip">单选，发布后学员按此方式完成对练</p>
              </div>

              <div className="task-participants">
                <div className="participant-title-row">
                  <h2>参与学员</h2>
                  <div className="participant-title-actions">
                    <button className="btn outline" type="button" onClick={selectAllLearners}>选全员</button>
                    <button className="btn outline" type="button" onClick={() => importInputRef.current?.click()}>导入名单</button>
                    <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv,.txt" style={{ display: "none" }} onChange={handleImportFile} />
                  </div>
                </div>
                <p className="section-desc">批量选择本次任务的参与学员，支持按部门筛选</p>
                <div className="participant-toolbar">
                  <input className="field" value={pKeyword} onChange={(e) => setPKeyword(e.target.value)} placeholder="⌕ 搜索姓名 / 工号" />
                  <select className="field" value={pDeptId} onChange={(e) => setPDeptId(e.target.value)}>
                    <option value="">全部部门⌄</option>
                    {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <span className="participant-count" id="participantCount">已选择 {selectedLearnerCount} / {learners.length} 人</span>
                </div>
                <div className="participant-panel">
                  <div className="participant-panel-head">
                    <label className="participant-select-all">
                      <input type="checkbox" checked={pageAllChecked} onChange={(e) => toggleSelectPage(e.target.checked)} />
                      全选当前页
                    </label>
                    <div className="participant-panel-actions">
                      <span>当前页 {filteredLearners.length} 人
                        <span className="clear-selected" onClick={clearSelected}>清空已选</span>
                      </span>
                    </div>
                  </div>
                  <div className="participant-rows" id="participantRows">
                    {filteredLearners.map((u) => {
                      const checked = participantIds.has(u.id);
                      return (
                        <label className="participant-row" key={u.id}>
                          <input type="checkbox" data-participant={u.id} checked={checked} onChange={(e) => toggleParticipant(u.id, e.target.checked)} />
                          <b>{u.name}</b>
                          <span>{u.orgName || "未分组"}<small style={{ display: "block", color: "#9aa8b9" }}>{u.mobile}</small></span>
                          <span className="selected-label">{checked ? "已选" : ""}</span>
                        </label>
                      );
                    })}
                    {!filteredLearners.length && <div style={{ padding: 25, textAlign: "center", color: "#98a6b8" }}>没有匹配的学员</div>}
                  </div>
                </div>
                <div className="participant-foot">可滚动查看并继续勾选，未选择学员时不可创建任务</div>
              </div>
            </div>
          </div>
        </div>

        {/* 添加业务场景弹窗 */}
        {showScenePicker && (
          <div className="modal-mask show" onClick={() => setShowScenePicker(false)}>
            <div className="modal task-scene-picker" onClick={(e) => e.stopPropagation()}>
              <h3>添加业务场景</h3>
              <p className="picker-desc muted">选择场景后加入当前任务，已加入的场景会自动隐藏。</p>
              <div className="picker-options" id="taskScenePickerOptions">
                {scenePool.length ? scenePool.map((x) => (
                  <label className="picker-option" key={x.id}>
                    <input type="checkbox" checked={pickerChecked.has(x.id)} onChange={(e) => {
                      setPickerChecked((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(x.id);
                        else next.delete(x.id);
                        return next;
                      });
                    }} />
                    <span><b>{x.name}</b><small>{x.creatorOrgName || "未分组"} · {x.mode === "文本模式" ? "文本对练" : "语音对练"} · 已关联 {x.taskCount ?? 0} 个任务</small></span>
                  </label>
                )) : (
                  <div style={{ padding: 25, textAlign: "center", color: "#8c9bad" }}>暂无可添加场景，请先在场景管理中创建场景</div>
                )}
              </div>
              <div className="form-actions">
                <button className="btn outline" type="button" onClick={() => setShowScenePicker(false)}>取消</button>
                <button className="btn" type="button" onClick={confirmScenePicker}>确认添加</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ---------- 右侧面板数据 ----------

async function loadRightRailData(): Promise<RightRailData> {
  try {
    const auth = getAuth();
    return {
      userName: auth?.user?.name || "管理员",
      completedRecordCount: 0,
      practiceRecordCount: 0,
      examCount: 0,
      passRate: "0%",
      pendingAppealCount: 0,
      tenantName: auth?.user?.tenantName || "智训通本地验证租户",
    };
  } catch {
    return {
      userName: "管理员", completedRecordCount: 0, practiceRecordCount: 0,
      examCount: 0, passRate: "0%", pendingAppealCount: 0, tenantName: "智训通本地验证租户",
    };
  }
}
