"use client";

import { useState } from "react";
import type { AuthSession } from "@zxt/shared";
import type { NavItem, ActiveSection } from "./dashboard-shared";
import {
  BarChart3, Users, ClipboardList, FileText, Bot, Database,
  AlertCircle, Settings, ShieldCheck, KeyRound, Menu, Building2,
  Briefcase, Landmark, MessageSquare, ScrollText,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const AUTH_STORAGE_KEY = "zxt-admin-auth";

// ---------- 导航配置 ----------

const defaultNavItems: NavItem[] = [
  { id: "home", key: "overview", label: "首页", icon: <BarChart3 size={18} /> },
  { id: "student-home", key: "student-home", label: "学员首页", icon: <Users size={18} /> },
  { id: "my-tasks", key: "my-tasks", label: "我的任务", icon: <ClipboardList size={18} /> },
  { id: "practice", key: "practice", label: "对练中心", icon: <MessageSquare size={18} /> },
  { id: "records", key: "records", label: "训练记录", icon: <ScrollText size={18} /> },
  { id: "my-exams", key: "my-exams", label: "我的考试", icon: <FileText size={18} /> },
  { id: "scenes", key: "scenes", label: "场景管理", icon: <Bot size={18} /> },
  { id: "knowledge", key: "knowledge", label: "企业知识库", icon: <Database size={18} /> },
  { id: "tasks", key: "tasks", label: "任务管理", icon: <ClipboardList size={18} /> },
  { id: "appeals", key: "appeals", label: "申诉管理", icon: <AlertCircle size={18} /> },
  {
    id: "statistics", key: "statistics", label: "数据统计", icon: <BarChart3 size={18} />, group: "statistics",
    children: [
      { id: "statistics-dept", key: "statistics-dept", label: "部门数据", icon: <Building2 size={16} /> },
      { id: "statistics-learner", key: "statistics-learner", label: "学员统计", icon: <Users size={16} /> },
    ],
  },
  { id: "materials", key: "materials", label: "素材管理", icon: <FileText size={18} /> },
  { id: "settings", key: "settings", label: "全局配置", icon: <Settings size={18} /> },
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

  const navItems = defaultNavItems;

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
