"use client";

import { useEffect, useState } from "react";
import type { AuthSession } from "@zxt/shared";
import type { NavItem, ActiveSection } from "./dashboard-shared";
import {
  BarChart3, Users, ClipboardList, FileText, Bot, Database,
  AlertCircle, Settings, ShieldCheck, KeyRound, Menu, Building2,
  Briefcase, Landmark, ScrollText,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const AUTH_STORAGE_KEY = "zxt-admin-auth";

// ---------- 导航配置 ----------
// 图标采用原型链接（zxt-static-pages-attachment-v3）左侧菜单栏的线性描边 SVG，
// 统一 viewBox="0 0 24 24"、fill:none、stroke:currentColor、stroke-width:1.8。

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// 首页：房子
const IcoHome = () => (
  <svg {...iconProps}><path d="m3 10 9-7 9 7" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></svg>
);
// 学员首页：人像
const IcoStudent = () => (
  <svg {...iconProps}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.4 3.2-5.2 7-5.2s6.2 1.8 7 5.2" /><path d="M4 12.5c1-.8 2-1.2 3.2-1.2M20 12.5c-1-.8-2-1.2-3.2-1.2" /></svg>
);
// 我的任务：清单
const IcoTasks = () => (
  <svg {...iconProps}><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="m8 8 1.4 1.4L12 6.8M14 9h3M8 14l1.4 1.4 2.6-2.6M14 15h3" /></svg>
);
// 场景管理：星星
const IcoScenes = () => (
  <svg {...iconProps}><path d="m12 3 1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7zM5 3v3M3.5 4.5h3" /></svg>
);
// 企业知识库：书本
const IcoKnowledge = () => (
  <svg {...iconProps}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21z" /><path d="M7.5 7H9M15 7h1.5" /></svg>
);
// 任务管理：文件+清单行
const IcoTaskManage = () => (
  <svg {...iconProps}><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3h6v2M8.5 10h7M8.5 14h7M8.5 18h4" /></svg>
);
// 申诉管理：聊天气泡
const IcoAppeals = () => (
  <svg {...iconProps}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" /><path d="M8 8h8M8 12h5" /></svg>
);
// 数据统计：柱状图
const IcoStatistics = () => (
  <svg {...iconProps}><path d="M4 19V5M4 19h17" /><rect x="7" y="11" width="2.8" height="5" rx=".5" /><rect x="12" y="8" width="2.8" height="8" rx=".5" /><rect x="17" y="5" width="2.8" height="11" rx=".5" /></svg>
);
// 素材管理：文件夹
const IcoMaterials = () => (
  <svg {...iconProps}><path d="M4 7.5h6l1.7 2H20v9.5H4z" /><path d="M4 7.5V5h6l1.7 2" /></svg>
);
// 全局配置：齿轮
const IcoSettings = () => (
  <svg {...iconProps}><path d="m12 3 1.2 1.1 1.7-.3.8 1.5 1.7.5.1 1.7 1.4 1-.6 1.6.6 1.6-1.4 1-.1 1.7-1.7.5-.8 1.5-1.7-.3L12 21l-1.2-1.1-1.7.3-.8-1.5-1.7-.5-.1-1.7-1.4-1 .6-1.6-.6-1.6 1.4-1 .1-1.7 1.7-.5.8-1.5 1.7.3z" /><circle cx="12" cy="12" r="3" /></svg>
);
// 子菜单：部门数据（方块）
const IcoDept = () => <span className="nav-sub-ico">▦</span>;
// 子菜单：学员数据（棋子）
const IcoLearner = () => <span className="nav-sub-ico">♙</span>;

const defaultNavItems: NavItem[] = [
  { id: "home", key: "overview", label: "首页", icon: <IcoHome /> },
  { id: "student-home", key: "student-home", label: "学员首页", icon: <IcoStudent /> },
  { id: "my-tasks", key: "my-tasks", label: "我的任务", icon: <IcoTasks /> },
  { id: "records", key: "records", label: "训练记录", icon: <ScrollText size={18} /> },
  { id: "scenes", key: "scenes", label: "场景管理", icon: <IcoScenes /> },
  { id: "knowledge", key: "knowledge", label: "企业知识库", icon: <IcoKnowledge /> },
  { id: "tasks", key: "tasks", label: "任务管理", icon: <IcoTaskManage /> },
  { id: "appeals", key: "appeals", label: "申诉管理", icon: <IcoAppeals /> },
  {
    id: "statistics", key: "statistics", label: "数据统计", icon: <IcoStatistics />, group: "statistics",
    children: [
      { id: "statistics-dept", key: "statistics-dept", label: "部门数据", icon: <IcoDept /> },
      { id: "statistics-learner", key: "statistics-learner", label: "学员统计", icon: <IcoLearner /> },
    ],
  },
  { id: "materials", key: "materials", label: "素材管理", icon: <IcoMaterials /> },
  { id: "settings", key: "settings", label: "全局配置", icon: <IcoSettings /> },
  {
    id: "sys", key: "sys", label: "系统管理", icon: <ShieldCheck size={18} />, group: "sys",
    children: [
      { id: "sys-users", key: "sys-users", label: "用户管理", icon: <Users size={16} /> },
      { id: "sys-roles", key: "sys-roles", label: "角色管理", icon: <KeyRound size={16} /> },
      { id: "sys-menus", key: "sys-menus", label: "菜单管理", icon: <Menu size={16} /> },
      { id: "sys-departments", key: "sys-departments", label: "部门管理", icon: <Building2 size={16} /> },
      { id: "sys-posts", key: "sys-posts", label: "岗位管理", icon: <Briefcase size={16} /> },
      { id: "sys-tenants", key: "sys-tenants", label: "租户管理", icon: <Landmark size={16} /> },
    ],
  },
];

// ---------- 右侧面板数据 ----------

export type RightRailData = {
  userName: string;
  completedRecordCount: number;
  practiceRecordCount: number;
  examCount: number;
  passRate: string;
  pendingAppealCount: number;
  tenantName: string;
};

// ---------- 组件 ----------

export default function AppShell({
  children,
  activeNavKey,
  onNavClick,
  rightRail,
  breadcrumb,
  topActions,
}: {
  children: React.ReactNode;
  activeNavKey?: string;
  onNavClick?: (key: string) => void;
  rightRail?: RightRailData;
  breadcrumb?: { label: string; childLabel?: string };
  topActions?: React.ReactNode;
}) {
  const [openNavGroups, setOpenNavGroups] = useState<Record<string, boolean>>({ statistics: false, sys: false });
  const auth: AuthSession | null = getAuth();

  // 从后端菜单表加载启停状态：status=disabled 的菜单 code 从导航中隐藏
  const [disabledMenuCodes, setDisabledMenuCodes] = useState<Set<string>>(new Set());
  useEffect(() => {
    const token = auth?.token || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch(`${API_BASE}/menus?pageSize=100`, { headers, cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (json?.success && Array.isArray(json.data?.items)) {
          const disabled = new Set<string>();
          for (const menu of json.data.items as Array<{ code: string; status: string }>) {
            if (menu.status === "disabled") disabled.add(menu.code);
          }
          setDisabledMenuCodes(disabled);
        }
      })
      .catch(() => { /* 菜单加载失败时保持默认导航 */ });
  }, [auth?.token]);

  const filterNavItems = (items: NavItem[]): NavItem[] =>
    items
      .filter((item) => !disabledMenuCodes.has(item.key))
      .map((item) =>
        item.children ? { ...item, children: item.children.filter((child) => !disabledMenuCodes.has(child.key)) } : item,
      )
      .filter((item) => !item.children || item.children.length > 0);

  const navItems = filterNavItems(defaultNavItems);

  return (
    <div className="shell">
      {/* 左侧导航 */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">智</div>
          <div>
            <p className="brand-title">AI 智训通</p>
            <p className="brand-subtitle">行业角色实训平台</p>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => {
            if (item.children && item.group) {
              const open = openNavGroups[item.group];
              const hasActiveChild = item.children.some((c) => c.key === activeNavKey);
              return (
                <div className={`nav-group ${open || hasActiveChild ? "open" : ""}`} key={item.id}>
                  <button
                    className={`nav-item group-head ${hasActiveChild ? "active" : ""}`}
                    type="button"
                    onClick={() => setOpenNavGroups((prev) => ({ ...prev, [item.group as string]: !prev[item.group as string] }))}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-caret">{open || hasActiveChild ? "⌄" : "›"}</span>
                  </button>
                  {(open || hasActiveChild) && (
                    <div className="nav-sub">
                      {item.children.map((child) => (
                        <button
                          className={`nav-item sub ${child.key === activeNavKey ? "active" : ""}`}
                          key={child.id}
                          type="button"
                          onClick={() => onNavClick?.(child.key)}
                        >
                          <span className="nav-icon">{child.icon}</span>
                          <span className="nav-label">{child.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button
                className={`nav-item ${item.key === activeNavKey ? "active" : ""}`}
                key={item.id}
                onClick={() => onNavClick?.(item.key)}
                type="button"
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {typeof item.badge === "number" && item.badge > 0 ? <span className="nav-badge">{item.badge}</span> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 主内容区 */}
      <main className="content">
        {/* 顶部栏 */}
        <div className="topbar prototype-topbar">
          <div className="breadcrumb">
            <strong>工作台</strong>
            {breadcrumb && (
              <>
                <span>/</span>
                <span>{breadcrumb.label}</span>
                {breadcrumb.childLabel && <><span>/</span><span>{breadcrumb.childLabel}</span></>}
              </>
            )}
          </div>
          <div className="top-actions">
            <span className="top-message">◌ 消息通知</span>
            <span className="tenant-selector" suppressHydrationWarning>{rightRail?.tenantName || auth?.user?.name || "智训通本地验证租户"} ⌄</span>
            <span className="avatar" />
            <button className="user-menu" type="button" suppressHydrationWarning>
              {auth?.user?.name || "管理员"}⌄
            </button>
          </div>
        </div>

        {/* 主内容 + 右侧面板在同一个 home-grid 容器内 */}
        <div className="home-grid">
          <div className="home-main">
            {children}
          </div>

          {/* 右侧面板 — 布局流内，与主页一致 */}
          {rightRail && (
            <aside className="right-rail">
              <div className="profile card">
                <span className="avatar large" />
                <div>
                  <h2>{rightRail.userName}</h2>
                  <p>企业管理员</p>
                  <p>培训负责人</p>
                </div>
              </div>
              <div className="sidecard card">
                <div className="sidecard-head"><h2>培训概况</h2><span>本年度</span></div>
                <strong>{rightRail.completedRecordCount}</strong>
                <p>已完成培训任务</p>
                <div className="mini-stats">
                  <span>对练<b>{rightRail.practiceRecordCount}</b></span>
                  <span>考试<b>{rightRail.examCount}</b></span>
                  <span>合格率<b>{rightRail.passRate}</b></span>
                </div>
              </div>
              <div className="sidecard card">
                <h2>通知消息</h2>
                <p>{rightRail.pendingAppealCount ? `当前有 ${rightRail.pendingAppealCount} 条申诉待处理，请及时跟进。` : "暂无新的通知消息，系统将及时推送任务派发、培训安排及学习进度提醒。"}</p>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

// ---------- 工具 ----------

function getAuth(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}
