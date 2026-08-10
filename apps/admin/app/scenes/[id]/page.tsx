"use client";

import { useEffect, useState } from "react";
import type { ApiResponse, AuthSession } from "@zxt/shared";
import { ArrowLeft, Edit } from "lucide-react";
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

function statusLabel(status: string) {
  const map: Record<string, string> = {
    published: "已发布", enabled: "启用", draft: "草稿",
    disabled: "停用", stopped: "已停用",
  };
  return map[status] || status;
}

function modeLabel(mode: string) {
  return mode === "voice" ? "语音模式" : "文本模式";
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
    ? new URL(window.location.href).pathname.split("/").pop() || ""
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

  return (
    <AppShell
      activeNavKey="scenes"
      onNavClick={(key: string) => { window.location.href = "/?section=" + key; }}
      rightRail={rightRail}
      breadcrumb={{ label: "场景管理", childLabel: "场景详情" }}
    >
      {error && <div className="notice">{error}</div>}

      {!detail ? (
        <div className="empty" style={{ padding: 40 }}>加载中...</div>
      ) : (
        <div className="page-section">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 28px", borderBottom: "1px solid rgba(115,131,154,0.1)",
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: "#0f3168" }}>场景详情</h2>
                <p style={{ margin: "4px 0 0", color: "#73839a", fontSize: 14 }}>查看场景配置与基本信息</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" type="button" onClick={() => window.history.back()}>
                  <ArrowLeft size={16} /> 返回列表
                </button>
                <button className="btn primary" type="button" onClick={() => { window.location.href = '/scenes/' + detail.scene.id + '/edit'; }}>
                  <Edit size={16} /> 编辑
                </button>
              </div>
            </div>
            <div style={{ padding: "24px 28px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 48px" }}>
                <Row label="场景名称" value={detail.scene.name} />
                <Row label="场景编号" value={detail.scene.code} />
                <Row label="状态" value={statusLabel(detail.scene.status)} />
                <Row label="对话模式" value={modeLabel(detail.scene.mode)} />
                <Row label="关联任务数" value={`${detail.scoringRules.length}个`} />
                <Row label="创建部门" value={detail.scene.industryPackageName || "—"} />
                <Row label="创建人" value="—" />
                <Row label="创建时间" value="—" />
                <Row label="上传附件" value="暂无附件" />
                <Row label="AI扮演角色" value={aiRole?.goal || "未配置"} />
                <Row label="身份地位" value={aiRole?.background || "未配置"} />
                <Row label="背景简介" value={aiRole?.background || "未配置"} />
                <Row label="AI角色性格" value={aiRole?.personality || "未配置"} />
                <Row label="AI情绪设置" value={aiRole?.emotion || "未配置"} />
                <Row label="学员角色扮演" value={learnerRole?.goal || "未配置"} />
                <Row label="上传附件" value="暂无附件" />
                <Row label="对话目标" value={detail.rule?.endCondition || "未配置"} />
                <Row label="场景说明" value={detail.rule?.description || "未配置"} />
                <Row label="对话发起人" value={detail.rule?.initiator || "未配置"} />
                <Row label="结束条件" value={detail.rule?.endCondition || "未配置"} />
                <Row label="中断条件" value={detail.rule?.interruptCondition || "未配置"} />
                <Row label="评分规则" value={detail.scoringRules.length > 0 ? `${detail.scoringRules.length} 项` : "未配置"} />
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ---------- 查看态字段行 ----------

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(115,131,154,0.06)" }}>
      <span style={{ color: "#73839a", fontSize: 14, fontWeight: 600, minWidth: 80, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#172b4d", fontSize: 14, lineHeight: 1.6, wordBreak: "break-word" }}>{value}</span>
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
