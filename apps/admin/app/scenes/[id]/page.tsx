"use client";

import { useEffect, useState } from "react";
import type { ApiResponse, AuthSession } from "@zxt/shared";
import { ArrowLeft, Edit, Bot, FileText, GraduationCap, MessageSquare, Target, ListChecks } from "lucide-react";
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
};

function statusLabel(status: string) {
  const map: Record<string, string> = {
    published: "已发布", enabled: "启用", draft: "草稿",
    disabled: "停用", stopped: "已停用",
  };
  return map[status] || status;
}

function statusBadge(status: string) {
  const color = status === "published" || status === "enabled" ? "#22c55e" : status === "disabled" || status === "stopped" ? "#ef4444" : "#b45309";
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color, background: `${color}1a` }}>
      {statusLabel(status)}
    </span>
  );
}

function modeLabel(mode: string) {
  return mode === "voice" ? "语音模式" : "文本模式";
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

  const aiRole = detail?.roles.find((r) => r.roleType === "ai");
  const learnerRole = detail?.roles.find((r) => r.roleType !== "ai");
  const rule = detail?.rule;
  const scene = detail?.scene;

  return (
    <AppShell
      activeNavKey="scenes"
      onNavClick={(key: string) => { navigateTo("/?section=" + key); }}
      rightRail={rightRail}
      breadcrumb={{ label: "场景管理", childLabel: "场景详情" }}
    >
      {error && <div className="notice">{error}</div>}

      {!detail || !scene ? (
        <div className="empty" style={{ padding: 40 }}>加载中...</div>
      ) : (
        <div className="page-section">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* 顶部信息区 */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 28px", borderBottom: "1px solid rgba(115,131,154,0.1)",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: 20, color: "#3949c9" }}>{scene.name}</h2>
                  {statusBadge(scene.status)}
                  <span style={{ color: "#4e63f0", fontSize: 12, background: "#eef1fc", padding: "2px 10px", borderRadius: 999 }}>{createModeLabel(scene.createMode)}</span>
                </div>
                <p style={{ margin: "6px 0 0", color: "#73839a", fontSize: 13 }}>
                  场景编号 {scene.code} · 创建部门 {scene.creatorOrgName || "—"} · 创建人 {scene.creatorName || "—"} · 更新时间 {formatDate(scene.updatedAt || scene.createdAt)}
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                <button className="btn" type="button" onClick={() => navigateTo('/?section=scenes')}>
                  <ArrowLeft size={16} /> 返回列表
                </button>
                <button className="btn primary" type="button" onClick={() => { navigateTo('/scenes/' + scene.id + '/edit'); }}>
                  <Edit size={16} /> 编辑
                </button>
              </div>
            </div>

            {/* 统计卡片 */}
            <div style={{ padding: "20px 28px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, borderBottom: "1px solid rgba(115,131,154,0.08)" }}>
              <StatCard icon={<ListChecks size={18} />} label="关联培训任务" value={`${scene.taskCount ?? 0} 个`} />
              <StatCard icon={<MessageSquare size={18} />} label="对话训练模式" value={`${createModeLabel(scene.createMode)} · ${modeLabel(scene.mode)}`} />
              <StatCard icon={<GraduationCap size={18} />} label="评分维度" value={`${detail.scoringRules.length} 项`} />
            </div>

            {/* 主内容：三段式 + 右侧栏 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 0 }}>
              <div style={{ padding: "24px 28px", borderRight: "1px solid rgba(115,131,154,0.08)" }}>
                {/* 01 角色配置 */}
                <SectionBlock index="01" title="角色配置" desc="AI 与学员的角色设定" icon={<Bot size={16} />}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 40px" }}>
                    <Row label="AI扮演角色" value={aiRole?.identity || "未配置"} />
                    <Row label="身份地位" value={aiRole?.personality || "未配置"} />
                    <Row label="背景简介" value={aiRole?.background || "未配置"} />
                    <Row label="AI角色性格" value={aiRole?.personality || "未配置"} />
                    <Row label="AI情绪设置" value={emotionLabel(aiRole?.emotion || "")} />
                    <Row label="AI语言风格" value={aiRole?.languageStyle || "未配置"} />
                    <Row label="学员角色扮演" value={learnerRole?.identity || "未配置"} />
                    <Row label="对话目标" value={learnerRole?.goal || "未配置"} />
                  </div>
                </SectionBlock>

                {/* 02 训练内容 */}
                <SectionBlock index="02" title="训练内容" desc="对话流程与训练要求" icon={<Target size={16} />}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 40px" }}>
                    <Row label="对话发起人" value={initiatorLabel(rule?.initiator || "")} />
                    <Row label="结束条件" value={rule?.endCondition || "未配置"} />
                    <Row label="中断条件" value={rule?.interruptCondition || "未配置"} />
                    <Row label="对话实例" value={rule?.description || "未配置"} />
                  </div>
                </SectionBlock>

                {/* 03 训练规则 */}
                <SectionBlock index="03" title="训练规则" desc="评分标准与考核要求" icon={<ListChecks size={16} />}>
                  {detail.scoringRules.length === 0 ? (
                    <div className="empty" style={{ padding: "12px 0" }}>未配置评分规则。</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {detail.scoringRules.map((r, i) => (
                        <div key={r.id || i} style={{
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "10px 14px", borderRadius: 8,
                          border: "1px solid rgba(115,131,154,0.12)", background: "#fafbfe",
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#4e63f0", width: 18, flexShrink: 0 }}>{i + 1}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                              <strong style={{ fontSize: 13, color: "#172b4d" }}>{r.name}</strong>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#3949c9" }}>{r.score} 分</span>
                            </div>
                            {r.criteria && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#73839a", lineHeight: 1.6 }}>{r.criteria}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionBlock>
              </div>

              {/* 右侧栏 */}
              <div style={{ padding: "24px 20px", background: "#fafbfe" }}>
                <SideBlock title="场景信息">
                  <SideRow label="场景编号" value={scene.code} />
                  <SideRow label="场景类型" value={scene.sceneType || "—"} />
                  <SideRow label="行业包" value={scene.industryPackageName || "—"} />
                  <SideRow label="创建部门" value={scene.creatorOrgName || "—"} />
                  <SideRow label="创建人" value={scene.creatorName || "—"} />
                  <SideRow label="创建时间" value={formatDate(scene.createdAt)} />
                  <SideRow label="更新时间" value={formatDate(scene.updatedAt)} />
                </SideBlock>

                <SideBlock title="评分规则">
                  {detail.scoringRules.length === 0 ? (
                    <p style={{ margin: 0, color: "#8b98aa", fontSize: 12 }}>未配置评分规则。</p>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {detail.scoringRules.map((r, i) => (
                        <div key={r.id || i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#3d4d66" }}>
                          <span>{r.name}</span>
                          <strong>{r.score} 分</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </SideBlock>

                <SideBlock title="训练资料">
                  {detail.materials.length === 0 ? (
                    <p style={{ margin: 0, color: "#8b98aa", fontSize: 12 }}>暂无关联训练资料。</p>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {detail.materials.map((m) => (
                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#3d4d66" }}>
                          <FileText size={13} style={{ color: "#8b98aa" }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SideBlock>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ---------- 子组件 ----------

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 16px", borderRadius: 10,
      border: "1px solid rgba(115,131,154,0.12)", background: "#fff",
    }}>
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: "#eef1fc", color: "#4e63f0" }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12, color: "#8b98aa" }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#3949c9", marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function SectionBlock({ index, title, desc, icon, children }: { index: string; title: string; desc: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#4e63f0" }}>{index}</span>
        <span style={{ color: "#4e63f0", display: "flex" }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 16, color: "#3949c9", fontWeight: 700 }}>{title}</h3>
      </div>
      <p style={{ margin: "0 0 12px", color: "#73839a", fontSize: 13 }}>{desc}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "7px 0", borderBottom: "1px solid rgba(115,131,154,0.06)" }}>
      <span style={{ color: "#8b98aa", fontSize: 13, minWidth: 84, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#172b4d", fontSize: 13, lineHeight: 1.6, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function SideBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(115,131,154,0.12)", background: "#fff" }}>
      <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#3949c9", fontWeight: 700 }}>{title}</h4>
      {children}
    </div>
  );
}

function SideRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "5px 0", fontSize: 12 }}>
      <span style={{ color: "#8b98aa", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#3d4d66", textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
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
