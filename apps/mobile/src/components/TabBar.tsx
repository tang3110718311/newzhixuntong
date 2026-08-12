"use client";

import { PageKey } from "./MobileApp";

const TABS: { key: PageKey; icon: string; label: string }[] = [
  { key: "home", icon: "⌂", label: "首页" },
  { key: "tasks", icon: "✓", label: "我的任务" },
  { key: "exams", icon: "▣", label: "我的考试" },
  { key: "ability", icon: "✦", label: "综合能力" },
  { key: "profile", icon: "☻", label: "个人中心" },
];

interface TabBarProps {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
}

export default function TabBar({ page, onNavigate }: TabBarProps) {
  const activeKey = page === "taskDetail" ? "tasks" : page;
  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`tab ${activeKey === tab.key ? "active" : ""}`}
          data-page={tab.key}
          onClick={() => onNavigate(tab.key)}
        >
          <i>{tab.icon}</i>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
