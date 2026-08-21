"use client";

import { useEffect, useState } from "react";
import type { ApiResponse, AuthSession } from "@zxt/shared";
import AppShell, { type RightRailData } from "@/components/AppShell";
import { getPathId, navigateTo } from "@/lib/navigation";

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
    createMode?: string;
    status: string;
    isTemplate: number;
    sourceType: string;
    description?: string;
    passScore: number;
    taskCount?: number;
    creatorName?: string | null;
    creatorOrgName?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  roles: Array<{
    id: string;
    roleType: string;
    identity: string;
    background: string;
    personality: string;
    emotion: string;
    languageStyle?: string;
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
  attachments: Array<{ id: string; name: string; mimeType: string; size: number; parseStatus: string; parseError?: string }>;
};

function statusLabel(status: string) {
  const map: Record<string, string> = {
    published: "已发布", enabled: "启用", draft: "草稿",
    disabled: "停用", stopped: "已停用",
  };
  return map[status] || status;
}

function statusOn(status: string) {
  return status === "published" || status === "enabled";
}

function createModeLabel(createMode?: string) {
  const map: Record<string, string> = {
    ai_practice: "AI对练模式",
    ai_exam: "AI对练+考试模式",
    fixed_practice: "固定对练模式",
    fixed_exam: "固定对练+考试模式",
  };
  return (createMode && map[createMode]) || createMode || "—";
}

function emotionLabel(emotion: string) {
  const map: Record<string, string> = {
    calm: "平静", kind: "亲切", anxious: "焦急", angry: "生气",
    furious: "愤怒", depressed: "沮丧", professional: "专业",
  };
  return map[emotion] || emotion || "未配置";
}

function initiatorLabel(initiator: string) {
  const map: Record<string, string> = { ai: "AI 发起", learner: "学员发起", random: "随机" };
  return map[initiator] || initiator || "未配置";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

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

// 解析对话实例文本为气泡列表
function parseDialogue(text: string): Array<{ role: "ai" | "student"; text: string }> {
  return text
    .split(/\n+/)
    .map((line) => {
      const m = line.match(/^(AI|学员|用户|助手)\s*[：:]\s*(.*)$/);
      return { role: m && /学员|用户/.test(m[1]) ? ("student" as const) : ("ai" as const), text: m ? m[2] : line };
    })
    .filter((item) => item.text.trim());
}

// ---------- 主组件 ----------

export default function SceneDetailPage() {
  const [detail, setDetail] = useState<SceneDetail | null>(null);
  const [error, setError] = useState("");
  const [rightRail, setRightRail] = useState<RightRailData | undefined>(undefined);

  const sceneId = typeof window !== "undefined"
    ? getPathId("scenes")
    : "";

  useEffect(() => {
    if (!sceneId) return;
    setError("");
    apiFetch<SceneDetail>(`/scenes/${sceneId}`)
      .then((d) => setDetail(d))
      .catch((err) => setError(err instanceof Error ? err.message : "加载场景详情失败"));

    loadRightRailData().then(setRightRail);
  }, [sceneId]);

  if (!detail || !detail.scene) {
    return (
      <AppShell
        activeNavKey="scenes"
        onNavClick={(key: string) => { navigateTo("/?section=" + key); }}
        rightRail={rightRail}
        breadcrumb={{ label: "场景管理", childLabel: "场景详情" }}
      >
        {error && <div className="notice">{error}</div>}
        <div className="empty" style={{ padding: 40 }}>加载中...</div>
      </AppShell>
    );
  }

  const scene = detail.scene;
  const aiRole = detail.roles.find((r) => r.roleType === "ai");
  const learnerRole = detail.roles.find((r) => r.roleType !== "ai");
  const rule = detail.rule;
  const scoreTotal = detail.scoringRules.reduce((s, r) => s + Number(r.score || 0), 0) || 100;
  const dialogues = parseDialogue(rule?.description || "");
  const statusClass = statusOn(scene.status) ? "on" : "off";

  return (
    <AppShell
      activeNavKey="scenes"
      onNavClick={(key: string) => { navigateTo("/?section=" + key); }}
      rightRail={rightRail}
      breadcrumb={{ label: "场景管理", childLabel: "场景详情" }}
    >
      {error && <div className="notice">{error}</div>}
      <div className="page-section sc-mod">
        <div className="scene-preview-page">
          {/* Hero */}
          <div className="preview-hero card">
            <div className="preview-hero-copy">
              <div className="preview-kicker">智训通 · 场景配置预览</div>
              <div className="preview-title-row">
                <h1>{scene.name || "场景详情"}</h1>
                <span className={`status ${statusClass}`}>{statusLabel(scene.status)}</span>
                <span className="preview-mode">{createModeLabel(scene.createMode)}</span>
              </div>
              <p className="preview-hero-desc">{scene.description || "查看当前场景的角色设定、训练目标和对话规则。"}</p>
              <div className="preview-meta">
                <span>编号 <b>{scene.code || "—"}</b></span>
                <span>创建部门 <b>{scene.creatorOrgName || "—"}</b></span>
                <span>创建人 <b>{scene.creatorName || "—"}</b></span>
                <span>更新时间 <b>{formatDate(scene.updatedAt || scene.createdAt)}</b></span>
              </div>
            </div>
            <div className="scene-actions">
                <button className="btn outline" type="button" onClick={() => navigateTo('/?section=scenes')}>返回列表</button>
              <button className="btn" type="button" onClick={() => { navigateTo('/scenes/' + scene.id + '/edit'); }}>编辑</button>
            </div>
          </div>

          {/* 统计 */}
          <div className="preview-stats">
            <div className="preview-stat card">
              <div className="preview-stat-icon blue-icon">▣</div>
              <div>
                <label>关联培训任务</label>
                <strong>{scene.taskCount ?? 0}</strong>
                <small>个任务正在使用</small>
              </div>
            </div>
            <div className="preview-stat card">
              <div className="preview-stat-icon purple-icon">✦</div>
              <div>
                <label>场景模式</label>
                <strong>{createModeLabel(scene.createMode)}</strong>
              </div>
            </div>
            <div className="preview-stat card">
              <div className="preview-stat-icon green-icon">✓</div>
              <div>
                <label>评分维度</label>
                <strong>{detail.scoringRules.length}</strong>
                <small>总分 <b>{scoreTotal}</b> 分</small>
              </div>
            </div>
            <div className="preview-stat card">
              <div className="preview-stat-icon amber-icon">◎</div>
              <div>
                <label>合格分数</label>
                <strong>{scene.passScore ?? 60} 分</strong>
                <small>满分 {scoreTotal} 分</small>
              </div>
            </div>
          </div>

          <div className="preview-content-grid">
            <div className="preview-main-column">
              {/* 01 角色配置 */}
              <section className="preview-section card">
                <div className="preview-section-head">
                  <div>
                    <span className="preview-section-index">01</span>
                    <div>
                      <h2>角色配置</h2>
                      <p>定义 AI 与学员在场景中的身份、背景和沟通状态</p>
                    </div>
                  </div>
                </div>
                <div className="role-preview-grid">
                  <article className="role-preview ai-role">
                    <div className="role-preview-top">
                      <span className="role-avatar">AI</span>
                      <div>
                        <span className="role-label">AI 扮演角色</span>
                        <h3>{aiRole?.identity || "未配置"}</h3>
                      </div>
                    </div>
                    <div className="role-fields">
                      <div>
                        <label>身份地位</label>
                        <p>{aiRole?.goal || "未配置"}</p>
                      </div>
                      <div>
                        <label>角色性格</label>
                        <p>{aiRole?.personality || "未配置"}</p>
                      </div>
                      <div>
                        <label>情绪设置</label>
                        <p>{emotionLabel(aiRole?.emotion || "")}</p>
                      </div>
                      <div>
                        <label>背景简介</label>
                        <p>{aiRole?.background || "未配置"}</p>
                      </div>
                    </div>
                  </article>
                  <article className="role-preview student-role">
                    <div className="role-preview-top">
                      <span className="role-avatar">学</span>
                      <div>
                        <span className="role-label">学员扮演角色</span>
                        <h3>{learnerRole?.identity || "未配置"}</h3>
                      </div>
                    </div>
                    <div className="role-student-note">学员将以此角色进入训练，通过对话完成当前场景目标。</div>
                  </article>
                </div>
              </section>

              {/* 02 训练内容 */}
              <section className="preview-section card">
                <div className="preview-section-head">
                  <div>
                    <span className="preview-section-index">02</span>
                    <div>
                      <h2>训练内容</h2>
                      <p>根据已填写的内容生成本场景的训练说明与对话流程</p>
                    </div>
                  </div>
                </div>
                <div className="preview-goal">
                  <div className="goal-mark">◎</div>
                  <div>
                    <label>对话目标</label>
                    <p>{learnerRole?.goal || "未配置"}</p>
                  </div>
                </div>
                <div className="preview-description">
                  <label>场景说明</label>
                  <p>{scene.description || "未填写"}</p>
                </div>
                <div className="dialogue-preview">
                  <div className="dialogue-preview-head">
                    <label>对话实例</label>
                    <span>{dialogues.length} 轮</span>
                  </div>
                  <div className="dialogue-preview-body">
                    {dialogues.length === 0 ? (
                      <div className="preview-empty">暂未配置对话实例</div>
                    ) : (
                      dialogues.map((item, i) => (
                        <div key={i} className={`dialogue-bubble${item.role === "student" ? " student" : ""}`}>
                          <span className="bubble-role">{item.role === "student" ? "学" : "AI"}</span>
                          <span className="bubble-text">{item.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>

              {/* 03 训练规则 */}
              <section className="preview-section card">
                <div className="preview-section-head">
                  <div>
                    <span className="preview-section-index">03</span>
                    <div>
                      <h2>训练规则</h2>
                      <p>对练过程中的起始方式、完成条件和中断条件</p>
                    </div>
                  </div>
                </div>
                <div className="rule-preview-grid">
                  <div className="rule-preview-item">
                    <label>对话发起人</label>
                    <p>{initiatorLabel(rule?.initiator || "")}</p>
                  </div>
                  <div className="rule-preview-item">
                    <label>结束条件</label>
                    <p>{rule?.endCondition || "未配置"}</p>
                  </div>
                  <div className="rule-preview-item full">
                    <label>中断条件</label>
                    <p>{rule?.interruptCondition || "未配置"}</p>
                  </div>
                </div>
              </section>
            </div>

            {/* 右侧栏 */}
            <aside className="preview-side-column">
              <section className="preview-side-card card">
                <div className="row">
                  <h3>场景信息</h3>
                  <span className="muted">基础资料</span>
                </div>
                <div className="preview-info-list">
                  <div>
                    <span>创建时间</span>
                    <b>{formatDate(scene.createdAt)}</b>
                  </div>
                  <div>
                    <span>关联任务</span>
                    <b>{scene.taskCount ?? 0} 个</b>
                  </div>
                  <div>
                    <span>当前状态</span>
                    <b>{statusLabel(scene.status)}</b>
                  </div>
                </div>
              </section>
              <section className="preview-side-card card">
                <div className="row">
                  <h3>评分规则</h3>
                  <span className="muted">合格 {scene.passScore ?? 60} 分</span>
                </div>
                <div className="preview-scoring-list">
                  {detail.scoringRules.length === 0 ? (
                    <div className="preview-empty">暂未配置评分规则</div>
                  ) : (
                    detail.scoringRules.map((r, i) => (
                      <div key={r.id || i} className="preview-score-item">
                        <div className="preview-score-line">
                          <span>{r.name}</span>
                          <b>{r.score} 分</b>
                        </div>
                        <div className="preview-score-track">
                          <i style={{ width: `${Math.min(100, scoreTotal ? (Number(r.score) || 0) / scoreTotal * 100 : 0)}%` }} />
                        </div>
                        <p className="preview-score-criteria">{r.criteria || "未填写规则说明"}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
              <section className="preview-side-card card">
                <div className="row">
                  <h3>场景文件</h3>
                  <span className="muted">创建场景时上传</span>
                </div>
                <div className="preview-attachment-list">
                  {(detail.attachments || []).length === 0 ? (
                    <div className="preview-empty">暂无附件</div>
                  ) : (
                    (detail.attachments || []).map((item) => (
                      <div key={item.id} className="preview-attachment" title={item.parseError || item.name}>
                        <span className="preview-attachment-icon">📎</span>
                        <span>{item.name}</span>
                        {item.parseStatus === "parsing" && <small>解析中</small>}
                        {item.parseStatus === "failed" && <small>解析失败</small>}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </aside>
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
