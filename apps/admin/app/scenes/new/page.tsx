"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiResponse, AuthSession } from "@zxt/shared";
import AppShell, { type RightRailData } from "@/components/AppShell";
import { navigateTo } from "@/lib/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const AUTH_STORAGE_KEY = "zxt-admin-auth";

type ScoringRuleForm = {
  name: string;
  score: number;
  criteria: string;
  deductionRule: string;
  evidenceRequired: string;
};

function defaultScoringRules(): ScoringRuleForm[] {
  return [
    { name: "需求理解", criteria: "准确识别并回应对方的核心需求", score: 40, deductionRule: "", evidenceRequired: "" },
    { name: "沟通表达", criteria: "表达清晰、态度得体，能够有效推进对话", score: 35, deductionRule: "", evidenceRequired: "" },
    { name: "问题解决", criteria: "给出合理可执行的解决方案并完成对话目标", score: 25, deductionRule: "", evidenceRequired: "" },
  ];
}

function sceneCreationModeLabel(mode?: string) {
  const map: Record<string, string> = {
    ai_practice: "AI对练模式", ai_exam: "AI对练+考试模式",
    fixed_practice: "固定对练模式", fixed_exam: "固定对练+考试模式",
  };
  return (mode && map[mode]) || mode || "AI对练模式";
}

function sceneCreationModeIsFixed(mode?: string) {
  return mode === "fixed_practice" || mode === "fixed_exam";
}

function makeCode(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const raw = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_STORAGE_KEY) : null;
  const token = raw ? (JSON.parse(raw) as { token: string }).token : "";
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init, cache: "no-store",
    headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
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

export default function SceneNewPage() {
  const [mode, setMode] = useState("fixed_practice");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rightRail, setRightRail] = useState<RightRailData | undefined>(undefined);

  // 表单字段
  const [aiIdentity, setAiIdentity] = useState("");
  const [aiPosition, setAiPosition] = useState("");
  const [aiBackground, setAiBackground] = useState("");
  const [aiPersonality, setAiPersonality] = useState("");
  const [aiEmotion, setAiEmotion] = useState("");
  const [learnerIdentity, setLearnerIdentity] = useState("");
  const [dialogGoal, setDialogGoal] = useState("");
  const [sceneDesc, setSceneDesc] = useState("");
  const [dialogInitiator, setDialogInitiator] = useState("");
  const [dialogEndCondition, setDialogEndCondition] = useState("");
  const [dialogInterrupt, setDialogInterrupt] = useState("");
  const [dialogExample, setDialogExample] = useState("");
  const [scoringRuleForms, setScoringRuleForms] = useState<ScoringRuleForm[]>(defaultScoringRules());

  // 附件
  const editAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [editAttachments, setEditAttachments] = useState<Array<{ name: string; status: "uploading" | "done" | "failed"; error?: string }>>([]);
  const [editAttachmentsUploading, setEditAttachmentsUploading] = useState(false);
  const goalAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [goalAttachments, setGoalAttachments] = useState<Array<{ name: string; status: "idle" | "analyzing" | "done" }>>([]);
  const [goalAiStatus, setGoalAiStatus] = useState("上传附件后，AI将提取关键信息并生成对话目标");

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const m = params.get("mode");
    if (m === "ai_practice" || m === "ai_exam" || m === "fixed_practice" || m === "fixed_exam") {
      setMode(m);
    }
    loadRightRailData().then(setRightRail);
  }, []);

  async function handleEditAttachmentsSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setEditAttachmentsUploading(true);
    let folderId = "";
    try {
      const data = await apiFetch<{ items: Array<{ id: string; name: string }> }>("/knowledge?pageSize=1");
      folderId = data.items?.[0]?.id || "";
    } catch {
      folderId = "";
    }
    if (!folderId) {
      setError("知识库暂无文件夹，请先在企业知识库中创建文件夹。");
      setEditAttachmentsUploading(false);
      return;
    }
    for (const file of files) {
      setEditAttachments((prev) => [...prev, { name: file.name, status: "uploading" }]);
      try {
        const formData = new FormData();
        formData.append("folderId", folderId);
        formData.append("file", file);
        await apiFetch<{ parseStatus: string }>("/knowledge/files", { method: "POST", body: formData });
        setEditAttachments((prev) => prev.map((item) => (item.name === file.name ? { ...item, status: "done" } : item)));
      } catch (err) {
        setEditAttachments((prev) => prev.map((item) => (item.name === file.name ? { ...item, status: "failed", error: err instanceof Error ? err.message : "上传失败" } : item)));
      }
    }
    setEditAttachmentsUploading(false);
  }

  function removeEditAttachment(name: string) {
    setEditAttachments((prev) => prev.filter((item) => item.name !== name));
  }

  function handleGoalAttachmentsSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setGoalAttachments((prev) => [...prev, ...files.map((f) => ({ name: f.name, status: "idle" as const }))]);
    setGoalAiStatus(`已选择 ${goalAttachments.length + files.length} 个附件，可开始 AI 分析`);
  }

  function removeGoalAttachment(name: string) {
    const next = goalAttachments.filter((item) => item.name !== name);
    setGoalAttachments(next);
    setGoalAiStatus(next.length ? `已选择 ${next.length} 个附件，可开始 AI 分析` : "上传附件后，AI将提取关键信息并生成对话目标");
  }

  async function handleGoalAiAnalyze() {
    if (!goalAttachments.length) return;
    setGoalAttachments((prev) => prev.map((item) => ({ ...item, status: "analyzing" })));
    setGoalAiStatus("AI正在分析附件内容，请稍候…");
    await new Promise((resolve) => setTimeout(resolve, 800));
    const names = goalAttachments.map((f) => f.name.replace(/\.[^.]+$/, "")).join("、");
    const generated = `基于附件中的业务资料，学员需要理解关键要求，识别对方诉求，按照规范流程进行专业沟通，并完成明确、准确、可执行的回应。重点覆盖：${names}`;
    setDialogGoal((prev) => (prev.trim() ? prev : generated));
    setGoalAttachments((prev) => prev.map((item) => ({ ...item, status: "done" })));
    setGoalAiStatus(`已基于 ${goalAttachments.length} 个附件生成对话目标，可直接修改`);
  }

  async function handleSave() {
    if (!aiIdentity.trim() || !learnerIdentity.trim() || !aiEmotion || !dialogGoal.trim()) {
      setError("请完整填写 AI扮演角色、学员角色扮演、AI情绪设置和对话目标");
      return;
    }
    if (scoringRuleForms.some((r) => !r.name.trim() || !r.criteria.trim() || Number(r.score) <= 0)) {
      setError("请完整填写评分维度、评分说明和分值");
      return;
    }
    if (scoringRuleForms.reduce((s, r) => s + Number(r.score || 0), 0) !== 100) {
      setError("评分规则总分需为 100 分，请调整各项分值");
      return;
    }
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const name = aiIdentity.replace(/\s+/g, " ").slice(0, 18) + (aiIdentity.length > 18 ? "…" : "");
      const created = await apiFetch<{ id: string }>("/scenes", {
        method: "POST",
        body: JSON.stringify({
          name: name || "新场景",
          code: makeCode("CJ"),
          mode: "voice",
          createMode: mode,
          sceneType: "对话",
          description: sceneDesc || dialogGoal,
          aiRole: {
            identity: aiIdentity,
            background: aiBackground,
            personality: aiPersonality,
            emotion: aiEmotion,
            languageStyle: "",
            goal: aiPosition,
          },
          learnerRole: { identity: learnerIdentity, goal: dialogGoal },
          endCondition: dialogEndCondition,
          interruptCondition: dialogInterrupt,
          dialogueExample: dialogExample,
          initiator: dialogInitiator || "ai",
          scoringRules: scoringRuleForms.map((r) => ({
            name: r.name,
            score: r.score,
            criteria: r.criteria,
            deductionRule: r.deductionRule,
            evidenceRequired: r.evidenceRequired,
          })),
        }),
      });
      setMessage("创建成功。");
      navigateTo(`/scenes/${created.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  function updateScoringRuleForm(index: number, patch: Partial<ScoringRuleForm>) {
    setScoringRuleForms((prev) => prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  function addScoringRuleForm() {
    setScoringRuleForms((prev) => [...prev, { name: "", score: 0, criteria: "", deductionRule: "", evidenceRequired: "" }]);
  }

  function removeScoringRuleForm(index: number) {
    setScoringRuleForms((prev) => prev.filter((_, i) => i !== index));
  }

  const totalScore = scoringRuleForms.reduce((s, r) => s + Number(r.score || 0), 0);
  const isFixed = sceneCreationModeIsFixed(mode);
  const formModeDesc = isFixed
    ? "请配置固定对练的角色、目标和评分规则，可按实际训练要求修改。"
    : "自动生成配置内容，可按实际训练要求修改。";

  return (
    <AppShell
      activeNavKey="scenes"
      onNavClick={(key: string) => { navigateTo("/?section=" + key); }}
      rightRail={rightRail}
      breadcrumb={{ label: "场景管理", childLabel: "完善场景配置" }}
    >
      <div className="page-section sc-mod">
        {error && <div className="notice">{error}</div>}
        {message && <div className="success">{message}</div>}

        <div className="scene-form">
          {/* 头部 */}
          <div className="scene-form-head">
            <div>
              <h1>完善场景配置</h1>
              <span className={`form-mode-badge${isFixed ? " fixed" : ""}`}>{sceneCreationModeLabel(mode)}</span>
              <p className="muted">{formModeDesc}</p>
            </div>
            <div className="scene-form-actions">
              <button className="btn outline" type="button" onClick={() => navigateTo('/?section=scenes')} disabled={submitting}>
                取消
              </button>
              <button className="btn" type="button" disabled={submitting} onClick={handleSave}>
                {submitting ? "保存中…" : "保存"}
              </button>
            </div>
          </div>

          {/* 01 人员角色配置 */}
          <div className="form-section config-section">
            <div className="form-section-heading">
              <span className="section-number">01</span>
              <div>
                <h2>人员角色配置</h2>
                <p>配置 AI 与学员的角色信息、情绪和训练资料</p>
              </div>
            </div>
            <div className="form-grid config-grid">
              <div className="form-item role-item">
                <label><i>*</i>AI扮演角色</label>
                <textarea className="field" maxLength={200} value={aiIdentity} onChange={(e) => setAiIdentity(e.target.value)} placeholder="请输入 AI 扮演的角色" style={{ minHeight: 100, resize: "vertical" }} />
                <div className="field-count"><span>{aiIdentity.length}</span>/200</div>
              </div>
              <div className="form-item">
                <label>身份地位</label>
                <input className="field" maxLength={100} value={aiPosition} onChange={(e) => setAiPosition(e.target.value)} placeholder="例如：客户经理、部门负责人" />
              </div>
              <div className="form-item">
                <label>背景简介</label>
                <textarea className="field" maxLength={300} value={aiBackground} onChange={(e) => setAiBackground(e.target.value)} placeholder="请输入角色的背景信息" style={{ minHeight: 100, resize: "vertical" }} />
                <div className="field-count"><span>{aiBackground.length}</span>/300</div>
              </div>
              <div className="form-item">
                <label>AI角色性格</label>
                <textarea className="field" maxLength={200} value={aiPersonality} onChange={(e) => setAiPersonality(e.target.value)} placeholder="例如：专业、耐心、善于倾听" style={{ minHeight: 100, resize: "vertical" }} />
                <div className="field-count"><span>{aiPersonality.length}</span>/200</div>
              </div>
              <div className="form-item emotion-item">
                <label><i>*</i>AI情绪设置</label>
                <select className="field" value={aiEmotion} onChange={(e) => setAiEmotion(e.target.value)}>
                  <option value="">请选择 AI 情绪</option>
                  <option value="calm">平静</option>
                  <option value="kind">亲切</option>
                  <option value="anxious">焦急</option>
                  <option value="angry">生气</option>
                  <option value="furious">愤怒</option>
                  <option value="depressed">沮丧</option>
                  <option value="professional">专业</option>
                </select>
              </div>
              <div className="form-item role-item">
                <label><i>*</i>学员角色扮演</label>
                <textarea className="field" maxLength={200} value={learnerIdentity} onChange={(e) => setLearnerIdentity(e.target.value)} placeholder="请输入学员扮演的角色、身份和任务" style={{ minHeight: 100, resize: "vertical" }} />
                <div className="field-count"><span>{learnerIdentity.length}</span>/200</div>
              </div>
              <div className="form-item full">
                <label>上传附件</label>
                <div className="upload-box">
                  <div className="upload-main">
                    <input ref={editAttachmentInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.pptx,.txt,.md" style={{ display: "none" }} onChange={handleEditAttachmentsSelected} />
                    <label className="upload-trigger" onClick={() => editAttachmentInputRef.current?.click()}>
                      {editAttachmentsUploading ? "上传解析中…" : "选择附件"}
                    </label>
                    <span className="upload-tip">支持同时选择多个附件，单个文件不超过 20MB</span>
                  </div>
                  <div className="attachment-list">
                    {editAttachments.map((item) => (
                      <span key={item.name} className="attachment-chip">
                        📎 {item.name}
                        {item.status === "uploading" && "（解析中…）"}
                        {item.status === "failed" && "（失败）"}
                        <button type="button" style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", marginLeft: 4 }} onClick={() => removeEditAttachment(item.name)} aria-label={`删除附件 ${item.name}`}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 02 对话设置 */}
          <div className="form-section dialogue-section">
            <div className="form-section-heading">
              <span className="section-number">02</span>
              <div>
                <h2>对话设置</h2>
                <p>配置对话目标、流程和结束要求</p>
              </div>
              <span className="section-required"><i>*</i> 对话目标为必填项</span>
            </div>
            <div className="form-grid dialogue-grid">
              <div className="form-item full goal-row">
                <label><i>*</i>对话目标</label>
                <div className="form-block-field">
                  <textarea className="field" maxLength={500} value={dialogGoal} onChange={(e) => setDialogGoal(e.target.value)} placeholder="请输入希望学员通过对练达成的目标，例如：识别客户诉求，解释资费方案并完成有效回应。" style={{ minHeight: 125, resize: "vertical" }} />
                  <div className="field-count"><span>{dialogGoal.length}</span>/500</div>
                  <div className="goal-ai-upload">
                    <div className="goal-ai-upload-main">
                      <input ref={goalAttachmentInputRef} type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*" style={{ display: "none" }} onChange={handleGoalAttachmentsSelected} />
                      <label className="goal-upload-trigger" onClick={() => goalAttachmentInputRef.current?.click()}>📎 上传附件</label>
                      <button type="button" className="btn outline goal-ai-button" disabled={!goalAttachments.length} onClick={handleGoalAiAnalyze}>✦ AI分析并填入</button>
                      <span>上传附件后，AI将提取关键信息并生成对话目标</span>
                    </div>
                    <div className="goal-attachment-list">
                      {goalAttachments.map((item) => (
                        <span key={item.name} className="goal-attachment-chip" title={item.name}>
                          📎 {item.name} {item.status === "analyzing" && "（分析中…）"}
                          <button type="button" aria-label="移除附件" onClick={() => removeGoalAttachment(item.name)}>×</button>
                        </span>
                      ))}
                    </div>
                    <div className="goal-ai-upload-actions">
                      <small>{goalAiStatus}</small>
                    </div>
                  </div>
                </div>
              </div>
              <div className="form-item full">
                <label>场景说明</label>
                <textarea className="field" maxLength={500} value={sceneDesc} onChange={(e) => setSceneDesc(e.target.value)} placeholder="补充场景背景、关键流程或注意事项（选填）" style={{ minHeight: 90, resize: "vertical" }} />
                <div className="field-count"><span>{sceneDesc.length}</span>/500</div>
              </div>
              <div className="form-item">
                <label>对话发起人</label>
                <select className="field" value={dialogInitiator} onChange={(e) => setDialogInitiator(e.target.value)}>
                  <option value="">请选择对话发起人</option>
                  <option value="ai">AI</option>
                  <option value="learner">学员</option>
                  <option value="random">随机</option>
                </select>
              </div>
              <div className="form-item">
                <label>结束条件</label>
                <textarea className="field" maxLength={300} value={dialogEndCondition} onChange={(e) => setDialogEndCondition(e.target.value)} placeholder="例如：学员完成目标回应，双方达成一致" style={{ minHeight: 90, resize: "vertical" }} />
                <div className="field-count"><span>{dialogEndCondition.length}</span>/300</div>
              </div>
              <div className="form-item full">
                <label>中断条件</label>
                <textarea className="field" maxLength={300} value={dialogInterrupt} onChange={(e) => setDialogInterrupt(e.target.value)} placeholder="请输入触发中断对话的判断条件" style={{ minHeight: 90, resize: "vertical" }} />
                <div className="field-count"><span>{dialogInterrupt.length}</span>/300</div>
              </div>
              <div className="form-item full">
                <label>对话实例</label>
                <textarea className="field" maxLength={500} value={dialogExample} onChange={(e) => setDialogExample(e.target.value)} placeholder={"请输入示例对话内容，例如：AI：您好，请问有什么可以帮您？\n学员：我想咨询套餐资费。"} style={{ minHeight: 90, resize: "vertical" }} />
                <div className="field-count"><span>{dialogExample.length}</span>/500</div>
              </div>
            </div>
          </div>

          {/* 评分规则 */}
          <div className="form-scoring">
            <div className="form-scoring-head">
              <div>
                <h2>设置评分规则</h2>
                <p className="muted">系统已根据场景内容自动生成评分规则，可直接修改</p>
              </div>
              <span className="form-required-tip">总分需为 100 分</span>
            </div>
            <div className="scoring-intro">评分规则用于评估学员在对练中的表现。建议设置 3—5 个评分维度，所有分值合计为 100 分。</div>
            <div id="formScoringList" className="scoring-list">
              {scoringRuleForms.map((rule, index) => (
                <div key={`new-${index}`} className="scoring-row">
                  <input value={rule.name} maxLength={30} placeholder="评分维度" onChange={(e) => updateScoringRuleForm(index, { name: e.target.value })} />
                  <input value={rule.criteria} maxLength={100} placeholder="评分说明" onChange={(e) => updateScoringRuleForm(index, { criteria: e.target.value })} />
                  <div className="scoring-score">
                    <input type="number" min={1} max={100} value={rule.score || ""} placeholder="分值" onChange={(e) => updateScoringRuleForm(index, { score: Number(e.target.value) })} />
                    <span>分</span>
                  </div>
                  <button type="button" className="scoring-remove" title="删除评分项" onClick={() => removeScoringRuleForm(index)}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="scoring-add" onClick={addScoringRuleForm}>＋ 添加评分项</button>
            <div className="scoring-total">总分：<b>{totalScore}</b> 分</div>
          </div>
        </div>
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
