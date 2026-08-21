"use client";

import { PageKey } from "./MobileApp";

const TABS: { key: PageKey; icon: string; label: string }[] = [
  { key: "home", icon: "⌂", label: "首页" },
  { key: "tasks", icon: "✓", label: "我的任务" },
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
    <nav className="tabbar" aria-label="主导航">
      {TABS.map((tab, index) => (
        <button
          key={`${tab.key}-${index}`}
          className={`tab ${activeKey === tab.key ? "active" : ""}`}
          data-page={tab.key}
          type="button"
          aria-current={activeKey === tab.key ? "page" : undefined}
          onClick={() => onNavigate(tab.key)}
        >
          <i>{tab.icon}</i>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
