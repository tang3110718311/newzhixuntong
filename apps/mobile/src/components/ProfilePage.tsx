"use client";

import { useEffect, useState } from "react";
import { taskApi, type AuthUser } from "@/lib/api";
import type { PageKey } from "./MobileApp";

interface ProfilePageProps {
  user: AuthUser | null;
  onNavigate: (p: PageKey) => void;
  onLogout: () => void;
  showToast: (msg: string) => void;
}

export default function ProfilePage({ user, onNavigate, onLogout, showToast }: ProfilePageProps) {
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskDone, setTaskDone] = useState(0);
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    taskApi
      .list({ pageSize: 100 })
      .then((d) => {
        const items = d.items || [];
        setTaskTotal(items.length);
        setTaskDone(items.filter((t) => t.status === "completed").length);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  const percent = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0;
  const roleText =
    user?.roleCode === "tenant_admin"
      ? "培训管理员"
      : user?.roleCode === "trainer"
      ? "内训师"
      : "学员";

  return (
    <>
      <div className="mobile-head">
        <div>
          <h1>个人中心</h1>
          <p>管理账号、企业和学习偏好</p>
        </div>
        <button className="head-action" onClick={() => showToast("暂无新消息")}>
          ♢
        </button>
      </div>
      <div className="profile-card">
        <div className="avatar">👨🏻‍💼</div>
        <div className="profile-text">
          <h2>{user?.name || "同学"}</h2>
          <p>
            {roleText}　·　员工编号 {user?.id?.slice(0, 8) || "ZXT-0000"}
          </p>
        </div>
        <button onClick={() => showToast("头像更换功能已开启")}>更换头像</button>
      </div>
      <div className="profile-detail">
        <div className="detail-row">
          <span>登录账号</span>
          <span>{user?.mobile || "—"}</span>
        </div>
        <div className="detail-row">
          <span>所属部门</span>
          <span>{user?.orgName || "未分配部门"}</span>
        </div>
        <div className="detail-row">
          <span>当前企业</span>
          <span>{user?.tenantName || "—"}</span>
        </div>
      </div>
      <div className="ability-preview">
        <div className="section-title">
          <h2>本月学习概览</h2>
          <a onClick={() => onNavigate("ability")}>查看综合能力 ›</a>
        </div>
        <div className="ability-line">
          <label>完成任务</label>
          <div>
            <span style={{ width: `${percent}%` }} />
          </div>
          <b>
            {taskDone}/{taskTotal}
          </b>
        </div>
      </div>
      <div className="menu-card">
        <div className="menu-row" onClick={() => showToast("账号信息")}>
          <span className="mi">◎</span>
          <span>账号信息</span>
          <span className="arrow">›</span>
        </div>
        <div className="menu-row">
          <span className="mi">▣</span>
          <span>消息通知</span>
          <span
            className={`switch ${notify ? "on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setNotify((v) => !v);
            }}
          />
        </div>
        <div className="menu-row" onClick={() => showToast("当前仅 1 家企业")}>
          <span className="mi">⌂</span>
          <span>切换企业</span>
          <small className="company-count">1 家企业</small>
          <span className="arrow">›</span>
        </div>
        <div className="menu-row" onClick={() => showToast("问题反馈功能已开启")}>
          <span className="mi">✎</span>
          <span>问题反馈</span>
          <span className="arrow">›</span>
        </div>
      </div>
      <div className="menu-card">
        <div className="menu-row" onClick={onLogout}>
          <span className="mi" style={{ color: "var(--red)", background: "#fff0f0" }}>
            ↪
          </span>
          <span style={{ color: "var(--red)" }}>退出登录</span>
          <span className="arrow">›</span>
        </div>
      </div>
    </>
  );
}
