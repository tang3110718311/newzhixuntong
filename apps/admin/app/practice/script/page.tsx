"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "../practice.css";
import AppShell from "@/components/AppShell";
import { navigateTo } from "@/lib/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const AUTH_STORAGE_KEY = "zxt-admin-auth";

type AuthUser = {
  id: string;
  tenantId: string;
  name: string;
  mobile: string;
  roleCode: string;
  orgName?: string | null;
};
type AuthSession = { token: string; expiresAt: string; user: AuthUser };

type Scene = {
  id: string;
  name: string;
  code: string;
  sceneType: string;
  mode: string;
  status: string;
  passScore: number;
  description?: string;
};

type ScriptMessage = { role: "ai" | "learner"; content: string };

type ScriptResult = {
  aiReply: string;
  isFinished: boolean;
  round: number;
  totalRounds: number;
  caller?: string;
};

const TOTAL_ROUNDS = 5;

function readStoredAuth(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export default function ScriptCheckPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ScriptMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [round, setRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [roundScores, setRoundScores] = useState<Array<{ round: number; score: number; review: string }>>([]);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = readStoredAuth()?.token || "";
        const response = await fetch(`${API_BASE}/scenes?pageSize=50`, {
          cache: "no-store",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const payload = await response.json();
        if (payload?.success && Array.isArray(payload.data?.items)) {
          const list = (payload.data.items as Scene[]).filter((s) => s.status === "published");
          if (!cancelled) setScenes(list);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // 滚动到底部
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const callScriptCheck = useCallback(async (history: ScriptMessage[], currentRound: number): Promise<ScriptResult> => {
    const token = readStoredAuth()?.token || "";
    const response = await fetch(`${API_BASE}/ai/script-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ sceneId: selectedScene?.id, messages: history, round: currentRound, totalRounds: TOTAL_ROUNDS }),
    });
    const payload = await response.json();
    if (!payload?.success) throw new Error(payload.message || payload.code || "请求失败");
    return payload.data as ScriptResult;
  }, [selectedScene]);

  const start = useCallback(async () => {
    if (!selectedScene) return;
    setError("");
    setStarted(true);
    setFinished(false);
    setMessages([]);
    setRound(1);
    setTotalScore(0);
    setRoundScores([]);
    setSending(true);
    try {
      const result = await callScriptCheck([], 1);
      setMessages([{ role: "ai", content: result.aiReply }]);
      setFinished(result.isFinished);
    } catch (err) {
      setError(err instanceof Error ? err.message : "话术检核启动失败");
      setStarted(false);
    } finally {
      setSending(false);
    }
  }, [selectedScene, callScriptCheck]);

  const submitScript = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || finished) return;
    setInput("");
    setSending(true);
    const history: ScriptMessage[] = [...messages, { role: "learner", content: text }];
    setMessages(history);
    try {
      const result = await callScriptCheck(history, round);
      setMessages((prev) => [...prev, { role: "ai", content: result.aiReply }]);
      if (result.isFinished) {
        setFinished(true);
        // 解析最后一轮得分
        const m = result.aiReply.match(/【得分】\s*(\d+)/);
        if (m) {
          const score = Math.min(100, Math.max(0, parseInt(m[1], 10)));
          setRoundScores((prev) => [...prev, { round, score, review: result.aiReply }]);
          setTotalScore((prev) => prev + score);
        }
        setRound(result.totalRounds);
      } else {
        setRound((r) => r + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSending(false);
    }
  }, [input, sending, finished, messages, round, callScriptCheck]);

  // 从 AI 回复解析当前轮得分（非最后轮也可收集，用于实时展示）
  const parseScore = useCallback((text: string) => {
    const m = text.match(/【得分】\s*(\d+)/);
    return m ? Math.min(100, Math.max(0, parseInt(m[1], 10))) : null;
  }, []);

  const back = useCallback(() => {
    navigateTo("/practice?tab=history");
  }, []);

  return (
    <AppShell
      breadcrumb={{ label: "话术检核" }}
      rightRail={undefined}
      topActions={
        <button className="pc-back-mini" type="button" onClick={back}>← 返回对练中心</button>
      }
    >
      <div className="pc-script">
        {/* 顶部标题区 */}
        <div className="pc-script-head">
          <div>
            <h2>话术检核训练</h2>
            <p>围绕场景逐题给出情景，输入你的应对话术，AI 考官按评分标准逐题打分。</p>
          </div>
          {!started && (
            <div className="pc-script-pick">
              <select
                value={selectedScene?.id || ""}
                onChange={(e) => setSelectedScene(scenes.find((s) => s.id === e.target.value) || null)}
              >
                <option value="">选择检核场景</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button className="pc-btn-primary" type="button" disabled={!selectedScene} onClick={() => void start()}>
                开始检核
              </button>
            </div>
          )}
          {started && (
            <div className="pc-script-progress">
              <span>第 {round}/{TOTAL_ROUNDS} 题</span>
              <span className="pc-script-total">累计得分：{totalScore}</span>
            </div>
          )}
        </div>

        {error && <div className="pc-script-error">{error}</div>}

        {!started ? (
          <div className="pc-empty">
            {scenes.length === 0
              ? "暂无可检核的场景，请先创建并发布场景。"
              : "选择一个已发布场景，开始话术检核。"}
          </div>
        ) : (
          <>
            <div className="pc-script-list" ref={listRef}>
              {messages.map((m, i) => (
                <div className={`pc-msg ${m.role}`} key={i}>
                  <span className="pc-msg-role">{m.role === "ai" ? "AI 考官" : "我的话术"}</span>
                  <pre className="pc-msg-content">{m.content}</pre>
                </div>
              ))}
              {sending && (
                <div className="pc-msg ai">
                  <span className="pc-msg-role">AI 考官</span>
                  <pre className="pc-msg-content">正在检核你的话术…</pre>
                </div>
              )}
            </div>

            {finished ? (
              <div className="pc-script-result">
                <h3>检核完成</h3>
                <div className="pc-script-result-score">
                  <span className="pc-script-big">{totalScore}</span>
                  <span className="pc-script-max">/ {TOTAL_ROUNDS * 100}</span>
                </div>
                <p className="pc-script-result-hint">已按各题点评持续改进你的话术，建议针对低分题复盘示范话术。</p>
                <div className="pc-script-actions">
                  <button className="pc-btn-ghost" type="button" onClick={() => void start()}>再练一次</button>
                  <button className="pc-btn-primary" type="button" onClick={back}>返回对练中心</button>
                </div>
              </div>
            ) : (
              <div className="pc-script-inputbar">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && !e.shiftKey) {
                      e.preventDefault();
                      void submitScript();
                    }
                  }}
                  placeholder={`输入第 ${round} 题的情景应对话术（Enter 发送，Shift+Enter 换行）…`}
                  disabled={sending}
                  rows={3}
                />
                <button
                  className={`pc-inputbar-send${input.trim() ? " active" : ""}`}
                  type="button"
                  onClick={() => void submitScript()}
                  disabled={sending || !input.trim()}
                >
                  {sending ? "检核中…" : "提交话术"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
