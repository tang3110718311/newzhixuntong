"use client";

import { useEffect, useState } from "react";
import type { ApiResponse, AuthSession } from "@zxt/shared";
import { ArrowLeft, Save, Plus, X } from "lucide-react";
import AppShell, { type RightRailData } from "@/components/AppShell";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const AUTH_STORAGE_KEY = "zxt-admin-auth";

type SceneDetail = {
  scene: {
    id: string;
    name: string;
    code: string;
    industryPackageId?: string | null;
    industryPackageName?: string | null;
    sceneType: string;
    mode: string;
    status: string;
    isTemplate: number;
    sourceType: string;
    description?: string;
    passScore: number;
  };
  roles: Array<{
    id: string;
    roleType: string;
    identity: string;
    background: string;
    personality: string;
    emotion: string;
    goal: string;
  }>;
  rule: {
    id: string;
    initiator: string;
    endCondition: string;
    interruptCondition: string;
    description: string;
  } | null;
  scoringRules: Array<{
    id?: string;
    name: string;
    score: number;
    criteria: string;
    deductionRule: string;
    evidenceRequired: string;
    sortOrder?: number;
  }>;
  materials: Array<{ id: string; name: string; type: string; status: string }>;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const raw = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_STORAGE_KEY) : null;
  const token = raw ? (JSON.parse(raw) as { token: string }).token : "";
  const response = await fetch(`${API_BASE}${path}`, {
    ...init, cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
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

// ---------- 主组件 ----------

export default function SceneEditPage() {
  const [detail, setDetail] = useState<SceneDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rightRail, setRightRail] = useState<RightRailData | undefined>(undefined);

  // 编辑态表单
  const [aiRoleGoal, setAiRoleGoal] = useState("");
  const [aiRoleBackground, setAiRoleBackground] = useState("");
  const [aiRolePersonality, setAiRolePersonality] = useState("");
  const [aiRoleEmotion, setAiRoleEmotion] = useState("");
  const [learnerRoleGoal, setLearnerRoleGoal] = useState("");
  const [dialogGoal, setDialogGoal] = useState("");
  const [dialogDesc, setDialogDesc] = useState("");
  const [dialogInitiator, setDialogInitiator] = useState("");
  const [dialogEndCondition, setDialogEndCondition] = useState("");
  const [dialogInterrupt, setDialogInterrupt] = useState("");
  const [scoringRuleForms, setScoringRuleForms] = useState<SceneDetail["scoringRules"]>([]);

  const sceneId = typeof window !== "undefined"
    ? new URL(window.location.href).pathname.split("/")[2] || ""
    : "";

  useEffect(() => {
    if (!sceneId) return;
    setError("");
    apiFetch<SceneDetail>(`/scenes/${sceneId}`)
      .then((d) => {
        setDetail(d);
        initFormFromDetail(d);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载场景详情失败"));

    loadRightRailData().then(setRightRail);
  }, [sceneId]);

  function initFormFromDetail(d: SceneDetail) {
    const ai = d.roles.find((r) => r.roleType === "ai");
    const learner = d.roles.find((r) => r.roleType !== "ai");
    setAiRoleGoal(ai?.goal || "");
    setAiRoleBackground(ai?.background || "");
    setAiRolePersonality(ai?.personality || "");
    setAiRoleEmotion(ai?.emotion || "");
    setLearnerRoleGoal(learner?.goal || "");
    setDialogGoal(d.rule?.endCondition || "");
    setDialogDesc(d.rule?.description || "");
    setDialogInitiator(d.rule?.initiator || "");
    setDialogEndCondition(d.rule?.endCondition || "");
    setDialogInterrupt(d.rule?.interruptCondition || "");
    setScoringRuleForms(d.scoringRules.map((r) => ({ ...r })));
  }

  async function handleSave() {
    if (!detail) return;
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const updated = await apiFetch<SceneDetail>(`/scenes/${detail.scene.id}/scoring-rules`, {
        method: "PUT",
        body: JSON.stringify({ rules: scoringRuleForms }),
      });
      setDetail(updated);
      setScoringRuleForms(updated.scoringRules.map((r) => ({ ...r })));
      setMessage("保存成功。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  function updateScoringRuleForm(index: number, patch: Partial<SceneDetail["scoringRules"][0]>) {
    setScoringRuleForms((prev) => prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  function addScoringRuleForm() {
    setScoringRuleForms((prev) => [...prev, { name: "", score: 0, criteria: "", deductionRule: "", evidenceRequired: "" }]);
  }

  function removeScoringRuleForm(index: number) {
    setScoringRuleForms((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <AppShell
      activeNavKey="scenes"
      onNavClick={(key: string) => { window.location.href = "/?section=" + key; }}
      rightRail={rightRail}
      breadcrumb={{ label: "场景管理", childLabel: "编辑场景" }}
    >
      {error && <div className="notice">{error}</div>}
      {message && <div className="success">{message}</div>}

      {!detail ? (
        <div className="empty" style={{ padding: 40 }}>加载中...</div>
      ) : (
        <div className="page-section">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>

            {/* 标题栏 */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 28px", borderBottom: "1px solid rgba(115,131,154,0.1)",
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: "#0f3168" }}>完善场景配置</h2>
                <p style={{ margin: "4px 0 0", color: "#73839a", fontSize: 14 }}>自动生成配置内容，可按实际训练要求修改</p>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "#73839a", fontSize: 13 }}>*为必填项</span>
                <button className="btn" type="button" onClick={() => window.location.href = '/scenes/' + sceneId}>
                  <ArrowLeft size={16} /> 取消
                </button>
                <button className="btn primary" type="button" disabled={submitting} onClick={handleSave}>
                  <Save size={16} /> 保存
                </button>
              </div>
            </div>

            {/* 01 人员角色配置 */}
            <div style={{ padding: "24px 28px 8px" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "#0f3168", fontWeight: 700 }}>01 人员角色配置</h3>
              <p style={{ margin: "0 0 16px", color: "#73839a", fontSize: 13 }}>配置 AI 与学员的角色信息，增强训练沉浸感</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 48px" }}>
                {/* 左列 */}
                <div style={{ display: "grid", gap: 14 }}>
                  <div className="field">
                    <span className="field-label">*AI扮演角色</span>
                    <input value={aiRoleGoal} onChange={(e) => setAiRoleGoal(e.target.value)} placeholder="如：业务客户" />
                  </div>
                  <div className="field">
                    <span className="field-label">背景简介</span>
                    <textarea value={aiRoleBackground} onChange={(e) => setAiRoleBackground(e.target.value)} placeholder="描述 AI 角色的背景信息" style={{ minHeight: 72 }} />
                  </div>
                  <div className="field">
                    <span className="field-label">*AI语速设置</span>
                    <select value={aiRoleEmotion} onChange={(e) => setAiRoleEmotion(e.target.value)}>
                      <option value="calm">正常语速</option>
                      <option value="slow">慢速</option>
                      <option value="fast">快速</option>
                    </select>
                  </div>
                  <div className="field">
                    <span className="field-label">上传附件</span>
                    <button className="btn" type="button" style={{ width: "auto" }}>选择附件</button>
                    <span style={{ marginLeft: 8, color: "#8b98aa", fontSize: 12 }}>支持多文件，单文件≤20MB</span>
                  </div>
                </div>
                {/* 右列 */}
                <div style={{ display: "grid", gap: 14 }}>
                  <div className="field">
                    <span className="field-label">身份地位</span>
                    <input value={aiRolePersonality} onChange={(e) => setAiRolePersonality(e.target.value)} placeholder="描述 AI 角色的身份地位" />
                  </div>
                  <div className="field">
                    <span className="field-label">AI角色性格</span>
                    <input value={aiRoleEmotion} onChange={(e) => setAiRoleEmotion(e.target.value)} placeholder="描述 AI 角色性格特征" />
                  </div>
                  <div className="field">
                    <span className="field-label">*学员角色扮演</span>
                    <textarea value={learnerRoleGoal} onChange={(e) => setLearnerRoleGoal(e.target.value)} placeholder="描述学员扮演的角色" style={{ minHeight: 72 }} />
                  </div>
                </div>
              </div>
            </div>

            <Divider />

            {/* 02 对话设置 */}
            <div style={{ padding: "24px 28px 8px" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "#0f3168", fontWeight: 700 }}>02 对话设置</h3>
              <p style={{ margin: "0 0 16px", color: "#73839a", fontSize: 13 }}>配置对话目标、流程和结束要求</p>
              <div style={{ display: "grid", gap: 14 }}>
                <div className="field">
                  <span className="field-label">*对话目标</span>
                  <textarea value={dialogGoal} onChange={(e) => setDialogGoal(e.target.value)} placeholder="描述本次训练的对话目标" style={{ minHeight: 72 }} />
                </div>
                <div className="field">
                  <span className="field-label">场景说明</span>
                  <textarea value={dialogDesc} onChange={(e) => setDialogDesc(e.target.value)} placeholder="描述场景背景和训练重点" style={{ minHeight: 72 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 48px" }}>
                  <div className="field">
                    <span className="field-label">对话发起人</span>
                    <select value={dialogInitiator} onChange={(e) => setDialogInitiator(e.target.value)}>
                      <option value="ai">AI 发起</option>
                      <option value="learner">学员发起</option>
                    </select>
                  </div>
                  <div className="field">
                    <span className="field-label">结束条件</span>
                    <input value={dialogEndCondition} onChange={(e) => setDialogEndCondition(e.target.value)} placeholder="对话结束的触发条件" />
                  </div>
                </div>
                <div className="field">
                  <span className="field-label">中断条件</span>
                  <input value={dialogInterrupt} onChange={(e) => setDialogInterrupt(e.target.value)} placeholder="对话中断的触发条件" />
                </div>
              </div>
            </div>

            <Divider />

            {/* 03 设置评分规则 */}
            <div style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#0f3168", fontWeight: 700 }}>03 设置评分规则</h3>
                <span style={{ color: "#73839a", fontSize: 13 }}>
                  总分满为 <strong className={scoringRuleForms.reduce((s, r) => s + Number(r.score || 0), 0) === 100 ? "text-green" : "text-red"}>
                    {scoringRuleForms.reduce((s, r) => s + Number(r.score || 0), 0)}
                  </strong> 分
                </span>
              </div>
              <p style={{ margin: "0 0 16px", color: "#73839a", fontSize: 13 }}>
                系统已根据场景内容自动生成评分规则，可直接修改。评分规则用于评估学员在对话中的表现，建议设置 3-5 个评分维度，所有分值合计为 100 分。
              </p>

              <div style={{ display: "grid", gap: 12 }}>
                {scoringRuleForms.map((rule, index) => (
                  <div key={`${rule.id || "new"}-${index}`} style={{
                    display: "grid", gridTemplateColumns: "1fr 2fr 100px 32px",
                    gap: "12px 16px", alignItems: "center",
                    padding: "14px 18px", borderRadius: 10,
                    border: "1px solid rgba(115,131,154,0.12)", background: "#fff",
                  }}>
                    <div className="field" style={{ gap: 4 }}>
                      <span className="field-label" style={{ fontSize: 12 }}>评分项名称</span>
                      <input value={rule.name} onChange={(e) => updateScoringRuleForm(index, { name: e.target.value })} />
                    </div>
                    <div className="field" style={{ gap: 4 }}>
                      <span className="field-label" style={{ fontSize: 12 }}>评分项说明</span>
                      <input value={rule.criteria} onChange={(e) => updateScoringRuleForm(index, { criteria: e.target.value })} />
                    </div>
                    <div className="field" style={{ gap: 4 }}>
                      <span className="field-label" style={{ fontSize: 12 }}>分值</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button className="btn" type="button" style={{ padding: "0 8px", minHeight: 32 }} onClick={() => updateScoringRuleForm(index, { score: Math.max(0, rule.score - 5) })}>−</button>
                        <input type="number" min="0" max="100" value={rule.score} onChange={(e) => updateScoringRuleForm(index, { score: Number(e.target.value) })} style={{ width: 48, textAlign: "center" }} />
                        <button className="btn" type="button" style={{ padding: "0 8px", minHeight: 32 }} onClick={() => updateScoringRuleForm(index, { score: Math.min(100, rule.score + 5) })}>+</button>
                      </div>
                    </div>
                    <button className="link-btn danger" type="button" onClick={() => removeScoringRuleForm(index)} style={{ textAlign: "center" }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button className="btn" type="button" onClick={addScoringRuleForm} style={{ marginTop: 14 }}>
                <Plus size={16} /> 添加评分项
              </button>
            </div>

            {/* 底部操作栏 */}
            <div style={{
              display: "flex", justifyContent: "flex-end", gap: 10,
              padding: "16px 28px", borderTop: "1px solid rgba(115,131,154,0.1)",
            }}>
              <button className="btn" type="button" onClick={() => window.location.href = '/scenes/' + sceneId} disabled={submitting}>
                取消
              </button>
              <button className="btn primary" type="button" disabled={submitting} onClick={handleSave}>
                <Save size={16} /> 保存
              </button>
            </div>

          </div>
        </div>
      )}
    </AppShell>
  );
}

// ---------- 分隔线 ----------

function Divider() {
  return <div style={{ height: 1, background: "rgba(115,131,154,0.1)", margin: "0 28px" }} />;
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
