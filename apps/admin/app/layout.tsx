import type { Metadata } from "next";
import "./globals.css";
import "./dashboard-boards.css";

export const metadata: Metadata = {
  title: "AI 智训通管理端",
  description: "行业化 AI 角色实训与能力评估平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}