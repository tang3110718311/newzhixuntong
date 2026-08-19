"use client";

import { useCallback, useEffect, useState } from "react";
import LoginScreen from "./LoginScreen";
import HomePage from "./HomePage";
import TasksPage from "./TasksPage";
import TaskDetailPage from "./TaskDetailPage";
import ExamsPage from "./ExamsPage";
import AbilityPage from "./AbilityPage";
import ProfilePage from "./ProfilePage";
import TabBar from "./TabBar";
import Toast from "./Toast";
import { authApi, setAuth, clearAuth, type AuthUser } from "@/lib/api";
export type PageKey = "home" | "tasks" | "taskDetail" | "exams" | "ability" | "profile";

interface MobileAppProps {
  initialAuthenticated: boolean;
}

export default function MobileApp({ initialAuthenticated }: MobileAppProps) {
  const [loggedIn, setLoggedIn] = useState<boolean>(initialAuthenticated);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [page, setPage] = useState<PageKey>("home");
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const handleLoginSuccess = useCallback(
    async (mobile: string, password: string, captchaToken: string) => {
      const data = await authApi.login(mobile, password, captchaToken);
      setAuth(data);
      setUser(data.user);
      setLoggedIn(true);
      setPage("home");
      return data;
    },
    []
  );

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    clearAuth();
    setUser(null);
    setLoggedIn(false);
    setPage("home");
  }, []);

  // 切换企业：后端基于手机号在目标租户建新会话；本地更新认证后整页刷新，
  // 让各页面按新租户重新拉取数据（HomePage 等 useEffect 依赖 []，仅刷新可彻底更新）
  const handleSwitchTenant = useCallback(
    async (tenantCode: string): Promise<boolean> => {
      try {
        const data = await authApi.switchTenant(tenantCode);
        setAuth(data);
        window.location.reload();
        return true;
      } catch (e: any) {
        showToast(e?.message || "切换企业失败");
        return false;
      }
    },
    [showToast]
  );

  const openTaskDetail = useCallback((taskId: string) => {
    setTaskDetailId(taskId);
    setPage("taskDetail");
  }, []);

  const closeTaskDetail = useCallback(() => {
    setTaskDetailId(null);
    setPage("tasks");
  }, []);

  // 已登录时拉取用户信息
  useEffect(() => {
    if (loggedIn) {
      authApi
        .me()
        .then((data) => setUser(data.user))
        .catch((error: { status?: number }) => {
          if (error?.status === 401 || error?.status === 403) {
            clearAuth();
            setLoggedIn(false);
          }
        });
    }
  }, [loggedIn]);

  // 切换页面时回到顶部（对齐原型 showPage 的 window.scrollTo(0,0)）
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page, loggedIn]);

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} showToast={showToast} />;
  }

  return (
    <div className="app" id="mainApp">
      <div className="content">
        <section id="home" className={`page ${page === "home" ? "active" : ""}`}>
          <HomePage user={user} onNavigate={setPage} onOpenTask={openTaskDetail} showToast={showToast} onSwitchTenant={handleSwitchTenant} />
        </section>
        <section id="tasks" className={`page ${page === "tasks" ? "active" : ""}`}>
          <TasksPage onNavigate={setPage} onOpenTask={openTaskDetail} showToast={showToast} />
        </section>
        <section id="taskDetail" className={`page ${page === "taskDetail" ? "active" : ""}`}>
          <TaskDetailPage
            taskId={taskDetailId}
            onBack={closeTaskDetail}
            showToast={showToast}
          />
        </section>
        <section id="exams" className={`page ${page === "exams" ? "active" : ""}`}>
          <ExamsPage showToast={showToast} />
        </section>
        <section id="ability" className={`page ability-page ${page === "ability" ? "active" : ""}`}>
          <AbilityPage showToast={showToast} onNavigate={setPage} />
        </section>
        <section id="profile" className={`page ${page === "profile" ? "active" : ""}`}>
          <ProfilePage user={user} onNavigate={setPage} onLogout={handleLogout} showToast={showToast} />
        </section>
      </div>
      <TabBar page={page} onNavigate={setPage} />
      <Toast message={toastMsg} />
    </div>
  );
}
