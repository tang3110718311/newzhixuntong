"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import LoginScreen from "./LoginScreen";
import HomePage from "./HomePage";
import TasksPage from "./TasksPage";
import TaskDetailPage from "./TaskDetailPage";
import AbilityPage from "./AbilityPage";
import ProfilePage from "./ProfilePage";
import TabBar from "./TabBar";
import Toast from "./Toast";
import { authApi, setAuth, clearAuth, type AuthUser } from "@/lib/api";
import {
  parseMobileRoute,
  pathForPage,
  pathForTask,
  withModal,
  type MobileModalKey,
  type MobilePageKey,
} from "@/lib/mobileRoutes";

export type PageKey = MobilePageKey;

interface MobileAppProps {
  initialAuthenticated: boolean;
}

export default function MobileApp({ initialAuthenticated }: MobileAppProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = useMemo(() => parseMobileRoute(pathname || "/", searchParams), [pathname, searchParams]);
  const page = route.page;
  const taskDetailId = route.taskId;
  const [loggedIn, setLoggedIn] = useState<boolean>(initialAuthenticated);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const navigateTo = useCallback(
    (nextPage: PageKey) => {
      router.push(pathForPage(nextPage));
    },
    [router]
  );

  const openModalRoute = useCallback(
    (modal: MobileModalKey) => {
      router.push(withModal(pathname || "/", modal));
    },
    [pathname, router]
  );

  const closeModalRoute = useCallback(() => {
    router.push(pathname || "/");
  }, [pathname, router]);

  const handleLoginSuccess = useCallback(
    async (mobile: string, password: string, captchaToken: string) => {
      const data = await authApi.login(mobile, password, captchaToken);
      setAuth(data);
      setUser(data.user);
      setLoggedIn(true);
      router.replace("/");
      return data;
    },
    [router]
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
    router.replace("/");
  }, [router]);

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

  const openTaskDetail = useCallback(
    (taskId: string) => {
      router.push(pathForTask(taskId));
    },
    [router]
  );

  const closeTaskDetail = useCallback(() => {
    router.push("/tasks");
  }, [router]);

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
  }, [pathname, loggedIn]);

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} showToast={showToast} modal={route.modal} onOpenModal={openModalRoute} onCloseModal={closeModalRoute} />;
  }

  return (
    <div className="app" id="mainApp">
      <div className="content">
        <section id="home" className={`page ${page === "home" ? "active" : ""}`}>
          <HomePage
            user={user}
            onNavigate={navigateTo}
            onOpenTask={openTaskDetail}
            showToast={showToast}
            onSwitchTenant={handleSwitchTenant}
            modal={route.modal}
            onOpenModal={openModalRoute}
            onCloseModal={closeModalRoute}
          />
        </section>
        <section id="tasks" className={`page ${page === "tasks" ? "active" : ""}`}>
          <TasksPage onNavigate={navigateTo} onOpenTask={openTaskDetail} showToast={showToast} />
        </section>
        <section id="taskDetail" className={`page ${page === "taskDetail" ? "active" : ""}`}>
          <TaskDetailPage
            taskId={taskDetailId}
            routeState={route}
            onBack={closeTaskDetail}
            showToast={showToast}
          />
        </section>
        <section id="ability" className={`page ability-page ${page === "ability" ? "active" : ""}`}>
          <AbilityPage showToast={showToast} onNavigate={navigateTo} />
        </section>
        <section id="profile" className={`page ${page === "profile" ? "active" : ""}`}>
          <ProfilePage
            user={user}
            onNavigate={navigateTo}
            onLogout={handleLogout}
            showToast={showToast}
            routeState={route}
            onOpenModal={openModalRoute}
            onCloseModal={closeModalRoute}
          />
        </section>
      </div>
      <TabBar page={page} onNavigate={navigateTo} />
      <Toast message={toastMsg} />
    </div>
  );
}
