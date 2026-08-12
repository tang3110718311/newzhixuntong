"use client";

import { useEffect, useState } from "react";
import MobileApp from "@/components/MobileApp";
import { getToken } from "@/lib/api";

export default function HomePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 客户端渲染初始化
    setReady(true);
  }, []);

  if (!ready) return null;

  return <MobileApp initialToken={getToken()} />;
}
