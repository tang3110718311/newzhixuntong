"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./practice.css";
import AppShell, { type RightRailData } from "@/components/AppShell";

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

type ChatMessage = { role: "ai" | "learner"; content: string; emotion?: string };

type ScoreDetail = {
  id: string;
  ruleName?: string | null;
  score: number;
  deductionReason: string;
  evidenceText: string;
};

type TrainingRecordResult = {
  record: {
    id: string;
    recordNo: string;
    sceneId: string;
    sceneName?: string | null;
    mode: string;
    status: string;
    score: number;
    finishedAt?: string | null;
  };
  turns: Array<{ id: string; speaker: string; text: string; durationMs: number; startedAt?: string | null }>;
  scores: ScoreDetail[];
  suggestions: string[];
};

type HistoryItem = {
  id: string;
  sceneName?: string | null;
  sceneId?: string | null;
  userName?: string | null;
  mode: string;
  status: string;
  score: number;
  finishedAt?: string | null;
  scenePassScore: number;
  passed: number;
};

type HistoryDetail = {
  record: {
    id: string;
    sceneName?: string | null;
    mode: string;
    score: number;
    finishedAt?: string | null;
  };
  turns: Array<{ id: string; speaker: string; text: string; durationMs: number }>;
  scores: ScoreDetail[];
};

type View = "chat" | "history";

// edge-tts 微软云端中文声音（统一单一音色，避免同场多次发言音色不一致）
// 统一固定音色：云扬（edge-male-0，央视新闻联播风格的沉稳广播男声）
const CHAT_TTS_VOICES = [
  "edge-male-0",
];

function readStoredAuth(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.token || !parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function modeLabel(mode: string) {
  return mode === "voice" ? "语音模式" : "文本模式";
}

export default function PracticePage() {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  // 有 URL sceneId 时，初始直接进 chat 视图（避免闪现场景选择页）
  const [initialSceneId] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("sceneId");
  });
  const [view, setView] = useState<View>(initialSceneId ? "chat" : "history");

  // 场景列表（仅用于历史记录筛选下拉 + 对练对话加载）
  const [scenes, setScenes] = useState<Scene[]>([]);

  // 右侧面板聚合数据
  const [practiceCount, setPracticeCount] = useState(0);
  const [passRate, setPassRate] = useState("0%");

  // 对话视图
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [coachTip, setCoachTip] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(true); // 默认语音模式：AI 默认播报、学员默认语音输入
  const [chatFinished, setChatFinished] = useState(false);
  const [chatResult, setChatResult] = useState<TrainingRecordResult | null>(null);
  // 当前场景的评分维度（满分）与场景合格线
  const [sceneRules, setSceneRules] = useState<Array<{ id: string; name: string; score: number }>>([]);

  // 历史记录视图
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyFilterScene, setHistoryFilterScene] = useState("");
  const [historyFilterUser, setHistoryFilterUser] = useState("");
  const [userOptions, setUserOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<HistoryDetail | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  // 每个场景固定一种声音（进入场景时随机男女声，整个场景不变）
  const [ttsVoice, setTtsVoice] = useState<string | null>(null);

  // 错误提示
  const [error, setError] = useState("");

  // 语音采集
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingRef = useRef(false);

  // 当前播放的音频引用（用于退出/切换时停止）
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 当前场景固定声音
  const sceneVoiceRef = useRef<string | null>(null);
  // 记录当前已由哪个 sceneId 锁定了声音，避免重复进入时换声
  const sceneVoiceSceneIdRef = useRef<string | null>(null);

  const isFirstAiRef = useRef(true);

  const isAdmin = auth?.user.roleCode === "tenant_admin";

  // 每次进入场景，随机选定一个声音（男女各若干），整场固定不变。
  // 守卫：同一 sceneId 已锁定声音时不再重新随机，防止 enterChat 被重复调用导致换声。
  const pickSceneVoice = useCallback((sceneId?: string): string => {
    // 若该 scene 已锁定过声音，直接复用，绝不重新随机
    if (sceneId && sceneVoiceSceneIdRef.current === sceneId && sceneVoiceRef.current) {
      return sceneVoiceRef.current;
    }
    if (sceneVoiceRef.current && sceneVoiceSceneIdRef.current === sceneId) {
      return sceneVoiceRef.current;
    }
    const storageKey = sceneId ? `zxt-practice-voice:${sceneId}` : "";
    const stored = storageKey && typeof window !== "undefined" ? window.sessionStorage.getItem(storageKey) : "";
    const picked = stored && CHAT_TTS_VOICES.includes(stored)
      ? stored
      : CHAT_TTS_VOICES[Math.floor(Math.random() * CHAT_TTS_VOICES.length)];
    if (storageKey && typeof window !== "undefined") window.sessionStorage.setItem(storageKey, picked);
    sceneVoiceRef.current = picked;
    sceneVoiceSceneIdRef.current = sceneId ?? null;
    setTtsVoice(picked);
    return picked;
  }, []);

  // 停止当前播放的音频
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  // ===== API 封装 =====
  const apiGet = useCallback(
    async function apiGet<T>(path: string): Promise<T> {
      const token = readStoredAuth()?.token || "";
      const response = await fetch(`${API_BASE}${path}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const payload = (await response.json()) as { success: boolean; message?: string; code?: string; data: T };
      if (!payload.success) throw new Error(payload.message || payload.code || "请求失败");
      return payload.data;
    },
    [],
  );

  const apiPost = useCallback(
    async function apiPost<T>(path: string, body: unknown): Promise<T> {
      const token = readStoredAuth()?.token || "";
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { success: boolean; message?: string; code?: string; data: T };
      if (!payload.success) throw new Error(payload.message || payload.code || "请求失败");
      return payload.data;
    },
    [],
  );

  // ===== TTS（在进入对话前定义，供首问播报使用） =====
  const playTts = useCallback(
    async (text: string, emotion: string = "default", voice?: string) => {
      // 如果学员正在录音，不播放 AI 语音
      if (recordingRef.current) return;
      // 先停止上一段未播完的音频，避免叠加
      stopAudio();
      try {
        const data = await apiPost<{ audioBase64: string; format: string }>(`/ai/tts/synthesize`, { text, emotion, voice: voice || ttsVoice });
        const audio = new Audio(`data:audio/${data.format || "mp3"};base64,${data.audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => { if (audioRef.current === audio) audioRef.current = null; };
        await audio.play().catch(() => {});
      } catch {
        // 语音播报失败仅降级为文字，不阻断对话
      }
    },
    [apiPost, stopAudio, ttsVoice],
  );

  // ===== 加载场景列表 + 聚合训练记录 =====
  const loadScenes = useCallback(async () => {
    try {
      const data = await apiGet<{ items: Scene[]; total: number }>(`/scenes?pageSize=50&status=published`);
      const published = (data.items || []).filter((s) => s.status === "published");
      setScenes(published);

      // 聚合当前用户的训练记录，更新右侧面板数据
      const me = readStoredAuth();
      if (me?.user.id) {
        try {
          const recData = await apiGet<{ items: Array<{ sceneId: string; score: number; status: string }> }>(
            `/training-records?pageSize=200&userId=${encodeURIComponent(me.user.id)}`
          );
          const records = recData.items || [];
          const completed = records.filter((r) => r.status === "completed");
          setPracticeCount(completed.length);
          if (completed.length > 0) {
            const passed = completed.filter((r) => r.score >= 60).length;
            setPassRate(`${Math.round((passed / completed.length) * 100)}%`);
          }
        } catch {
          // 训练记录加载失败不影响主流程
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载场景失败");
    }
  }, [apiGet]);

  // ===== 进入对话 =====
  const enterChat = useCallback(
    async (scene: Scene) => {
      setError("");
      stopAudio();
      // 若为同一场景重复进入（如 enterChat 被多次调用），保留已选声音，不重新随机
      if (sceneVoiceSceneIdRef.current !== scene.id) {
        sceneVoiceRef.current = null;
        sceneVoiceSceneIdRef.current = null;
      }
      pickSceneVoice(scene.id);
      setSelectedScene(scene);
      setChatMessages([]);
      setChatInput("");
      setCoachTip(null);
      setChatFinished(false);
      setChatResult(null);
      setView("chat");
      try {
        const detail = await apiGet<{ scene: { passScore: number; mode: string }; scoringRules: Array<{ id: string; name: string; score: number }> }>(`/scenes/${scene.id}`);
        setSceneRules(detail.scoringRules || []);
        // AI 先开口
        await triggerAiFirst(scene, detail.scoringRules || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "进入对话失败");
      }
    },
    [apiGet, pickSceneVoice, stopAudio],
  );

  const triggerAiFirst = useCallback(
    async (scene: Scene, _rules: Array<{ id: string; name: string; score: number }>) => {
      setChatSending(true);
      try {
        const data = await apiPost<{ aiReply: string; isFinished: boolean; trainingRecord: TrainingRecordResult | null; coachTip: string | null; emotion: string }>(`/ai/chat`, {
          sceneId: scene.id,
          messages: [],
        });
        const emotion = data.emotion || "default";
        const voice = ttsVoice || pickSceneVoice(scene.id);
        setChatMessages([{ role: "ai", content: data.aiReply, emotion }]);
        setCoachTip(data.coachTip || null);
        // AI 先开口默认自动语音播报
        isFirstAiRef.current = true;
        if (voiceMode) void playTts(data.aiReply, emotion, voice);
        if (data.isFinished && data.trainingRecord) {
          setChatResult(data.trainingRecord);
          setChatFinished(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI 首问失败");
      } finally {
        setChatSending(false);
      }
    },
    [apiPost, pickSceneVoice, playTts, ttsVoice, voiceMode],
  );

  // ===== 发送消息 =====
  const sendChatMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || !selectedScene || chatSending) return;
      const nextMessages: ChatMessage[] = [...chatMessages, { role: "learner", content }];
      setChatMessages(nextMessages);
      setChatInput("");
      setChatSending(true);
      setCoachTip(null);
      try {
        const data = await apiPost<{ aiReply: string; isFinished: boolean; trainingRecord: TrainingRecordResult | null; coachTip: string | null; emotion: string }>(`/ai/chat`, {
          sceneId: selectedScene.id,
          messages: nextMessages,
        });
        const emotion = data.emotion || "default";
        const voice = ttsVoice || pickSceneVoice(selectedScene.id);
        setChatMessages([...nextMessages, { role: "ai", content: data.aiReply, emotion }]);
        setCoachTip(data.coachTip || null);
        // 仅在语音模式下且未录音时自动播放 AI 语音
        if (voiceMode && !recordingRef.current) void playTts(data.aiReply, emotion, voice);
        if (data.isFinished && data.trainingRecord) {
          setChatResult(data.trainingRecord);
          setChatFinished(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "对话失败");
      } finally {
        setChatSending(false);
      }
    },
    [apiPost, chatMessages, chatSending, pickSceneVoice, playTts, selectedScene, ttsVoice, voiceMode],
  );

  // ===== 结束训练（主动） =====
  const endTraining = useCallback(async () => {
    if (!selectedScene || chatSending) return;
    setChatSending(true);
    setError("");
    try {
      const data = await apiPost<{ aiReply: string; isFinished: boolean; trainingRecord: TrainingRecordResult | null; coachTip: string | null }>(`/ai/chat`, {
        sceneId: selectedScene.id,
        messages: chatMessages,
        finishTraining: true,
      });
      if (data.aiReply) setChatMessages((prev) => [...prev, { role: "ai", content: data.aiReply }]);
      if (data.trainingRecord) {
        setChatResult(data.trainingRecord);
        setChatFinished(true);
      } else {
        setError("训练记录保存失败，请重试。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "结束训练失败");
    } finally {
      setChatSending(false);
    }
  }, [apiPost, chatMessages, chatSending, selectedScene]);

  // ===== STT + 语音采集 =====
  const startRecording = useCallback(async () => {
    if (recordingRef.current) return;
    setError("");
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof window === "undefined" ||
      !window.isSecureContext ||
      typeof window.MediaRecorder === "undefined"
    ) {
      setError(getMicrophoneErrorMessage());
      return;
    }
    // 学员开始说话时，立即停止 AI 语音播报
    stopAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const base64 = await blobToBase64(blob);
        try {
          const data = await apiPost<{ text: string }>(`/ai/stt/transcribe`, { audioBase64: base64, format: "webm" });
          if (data.text && data.text.trim()) {
            void sendChatMessage(data.text);
          } else {
            setError("未识别到语音内容，请改用文字或重试。");
          }
        } catch {
          setError("语音识别失败，请改用文字。");
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      recordingRef.current = true;
      setIsRecording(true);
    } catch (err) {
      recordingRef.current = false;
      setIsRecording(false);
      setError(getMicrophoneErrorMessage(err));
    }
  }, [apiPost, sendChatMessage, stopAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingRef.current) {
      mediaRecorderRef.current.stop();
      recordingRef.current = false;
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // ===== 返回历史记录（中途退出，丢弃对话） =====
  const backToHistory = useCallback(() => {
    if (!chatFinished && chatMessages.length > 0) {
      const ok = window.confirm("中途退出将丢弃当前对话，不保存、不计分。确认退出？");
      if (!ok) return;
    }
    stopAudio();
    // 如果从任务详情页跳来，返回任务详情页
    const storedTaskId = window.sessionStorage.getItem("zxt-practice-taskId");
    if (storedTaskId) {
      window.location.href = `/tasks/${storedTaskId}`;
      return;
    }
    setView("history");
    setSelectedScene(null);
    setChatMessages([]);
    setCoachTip(null);
    setChatFinished(false);
    setChatResult(null);
    setSceneRules([]);
    sceneVoiceRef.current = null;
    sceneVoiceSceneIdRef.current = null;
    setTtsVoice(null);
  }, [chatFinished, chatMessages.length, stopAudio]);

  // ===== 再来一次 =====
  const restartChat = useCallback(() => {
    if (selectedScene) void enterChat(selectedScene);
  }, [enterChat, selectedScene]);

  // ===== 历史记录 =====
  const loadHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "50");
      params.set("status", "completed");
      if (historyFilterScene) params.set("sceneId", historyFilterScene);
      const me = readStoredAuth();
      const isAdminNow = me?.user.roleCode === "tenant_admin";
      if (isAdminNow && historyFilterUser) params.set("filterUserId", historyFilterUser);
      const data = await apiGet<{ items: HistoryItem[]; total: number }>(`/training-records?${params.toString()}`);
      setHistoryItems(data.items || []);
      setHistoryTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载历史记录失败");
    }
  }, [apiGet, historyFilterScene, historyFilterUser]);

  const loadExpandedDetail = useCallback(
    async (id: string) => {
      try {
        const detail = await apiGet<HistoryDetail>(`/training-records/${id}`);
        setExpandedDetail(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载详情失败");
      }
    },
    [apiGet],
  );

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiGet<{ items: Array<{ id: string; name: string }> }>(`/users?pageSize=100`);
      setUserOptions(data.items || []);
    } catch {
      // 非管理员或失败都不影响主流程
    }
  }, [apiGet]);

  // ===== 初始化 =====
  useEffect(() => {
    const stored = readStoredAuth();
    if (!stored) {
      window.location.href = "/";
      return;
    }
    setAuth(stored);

    const params = new URLSearchParams(window.location.search);
    const sceneId = params.get("sceneId");
    const taskId = params.get("taskId");
    // 记住来源任务，对练结束后跳回
    if (taskId) {
      try { window.sessionStorage.setItem("zxt-practice-taskId", taskId); } catch {}
    } else {
      try { window.sessionStorage.removeItem("zxt-practice-taskId"); } catch {}
    }
    const tab = params.get("tab");
    if (tab === "history") {
      setView("history");
      void loadHistory();
      if (isAdmin) void loadUsers();
    }
    if (sceneId) {
      // 有 sceneId 时直接进对话，不闪现场景选择页
      void (async () => {
        try {
          const data = await apiGet<{ items: Scene[] }>(`/scenes?pageSize=50`);
          const list = data.items || [];
          const scene = list.find((s) => s.id === sceneId);
          if (scene) void enterChat(scene);
          else {
            setError("未找到指定场景，已返回历史记录。");
            setView("history");
            void loadHistory();
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "加载指定场景失败");
          setView("history");
          void loadHistory();
        }
      })();
      return;
    }
    // 无 sceneId：显示历史记录 + 预加载场景列表供下拉
    void loadScenes();
    void loadHistory();
    if (isAdmin) void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换视图时加载数据
  useEffect(() => {
    if (view === "history") {
      void loadHistory();
      if (isAdmin) void loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // 对练结束后，如果从任务详情页跳来，3 秒后自动跳回
  useEffect(() => {
    if (!chatFinished) return;
    const storedTaskId = window.sessionStorage.getItem("zxt-practice-taskId");
    if (!storedTaskId) return;
    const timer = window.setTimeout(() => {
      window.location.href = `/tasks/${storedTaskId}`;
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [chatFinished]);

  // 离开页面/卸载时停止音频播放
  useEffect(() => {
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 历史筛选变化时重载
  useEffect(() => {
    if (view === "history") void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFilterScene, historyFilterUser]);


  const rightRail: RightRailData = (() => {
    return {
      userName: auth?.user.name || "学员",
      completedRecordCount: 0,
      practiceRecordCount: practiceCount,
      examCount: 0,
      passRate,
      pendingAppealCount: 0,
      tenantName: "",
    };
  })();

  // ================= 渲染 =================
  return (
    <AppShell
      activeNavKey="practice"
      onNavClick={(key: string) => { stopAudio(); window.location.href = "/?section=" + key; }}
      rightRail={rightRail}
      breadcrumb={{ label: "对练中心" }}
    >
      {error ? <div className="pc-error" onClick={() => setError("")}>{error}（点击关闭）</div> : null}

      {/* 对话视图顶部导航：只在非 chat 时显示 */}
      {view !== "chat" && (
        <nav className="practice-tabs">
          <button className="active">历史记录</button>
        </nav>
      )}

      <main className="practice-main">
        {view === "chat" && !selectedScene && (
          <div className="pc-empty" style={{ padding: "60px 0", textAlign: "center", color: "#86909c" }}>
            正在加载场景…
          </div>
        )}

        {view === "chat" && selectedScene && (
          <section className="pc-chat">
            <div className="pc-chat-head">
              <button className="pc-back-mini" onClick={backToHistory}>‹ 返回</button>
              <div className="pc-chat-title">
                <span className="pc-tag ghost">{modeLabel(selectedScene.mode)}</span>
                <strong>{selectedScene.name}</strong>
              </div>
              <button className="pc-end" onClick={() => void endTraining()} disabled={chatSending || chatFinished}>结束训练</button>
            </div>

            {/* 场景信息卡：合格线 + 评分维度 */}
            <div className="pc-scene-info">
              <div className="pc-scene-info-row">
                <span className="pc-scene-info-label">合格线</span>
                <span className="pc-scene-info-value">{selectedScene.passScore} 分</span>
              </div>
              {sceneRules.length > 0 && (
                <div className="pc-scene-info-row">
                  <span className="pc-scene-info-label">评分维度</span>
                  <div className="pc-scene-info-tags">
                    {sceneRules.map((r) => (
                      <span key={r.id} className="pc-scene-info-tag">{r.name}({r.score}分)</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pc-messages">
              {chatMessages.map((m, idx) => (
                <div className={`pc-bubble ${m.role === "ai" ? "ai" : "learner"}`} key={idx}>
                  <span className="pc-bubble-role">{m.role === "ai" ? "AI" : "我"}</span>
                  <div className="pc-bubble-text">
                    {m.content}
                    {m.role === "ai" && <button className="pc-speaker-btn" title="播放语音" onClick={() => void playTts(m.content, m.emotion || "default", ttsVoice || pickSceneVoice(selectedScene?.id))}>&#128266;</button>}
                  </div>
                </div>
              ))}
              {chatSending && <div className="pc-bubble ai"><span className="pc-bubble-role">AI</span><div className="pc-bubble-text pc-typing">正在输入…</div></div>}
            </div>

            {chatFinished && chatResult ? (
              <ScoreCard
                result={chatResult}
                sceneRules={sceneRules}
                passScore={selectedScene.passScore}
                onBack={backToHistory}
                onRestart={restartChat}
              />
            ) : (
              <div className="pc-inputbar">
                {coachTip ? <div className="pc-coachtip">教练提示：{coachTip}</div> : null}
                <div className="pc-inputrow">
                  {voiceMode ? (
                    <button
                      className={`pc-mic ${isRecording ? "recording" : ""}`}
                      onClick={toggleRecording}
                      disabled={chatSending}
                    >
                      {isRecording ? "结束说话" : "点击说话"}
                    </button>
                  ) : (
                    <>
                      <input
                        className="pc-text"
                        placeholder="输入你的回复，回车发送…"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChatMessage(chatInput); } }}
                        disabled={chatSending}
                      />
                      <button className="pc-send" onClick={() => void sendChatMessage(chatInput)} disabled={chatSending}>发送</button>
                    </>
                  )}
                  <div className="pc-mode">
                    <button className={!voiceMode ? "active" : ""} onClick={() => setVoiceMode(false)}>文本</button>
                    <button className={voiceMode ? "active" : ""} onClick={() => setVoiceMode(true)}>语音</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {view === "history" && (
          <section className="pc-history">
            <div className="pc-history-head">
              <h2>历史记录 <small>（共 {historyTotal} 条）</small></h2>
              <div className="pc-history-filters">
                <select value={historyFilterScene} onChange={(e) => setHistoryFilterScene(e.target.value)}>
                  <option value="">全部场景</option>
                  {scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {isAdmin && (
                  <select value={historyFilterUser} onChange={(e) => setHistoryFilterUser(e.target.value)}>
                    <option value="">全部学员</option>
                    {userOptions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                )}
              </div>
            </div>

            {historyItems.length === 0 ? (
              <div className="pc-empty">暂无训练记录。</div>
            ) : (
              <div className="pc-history-list">
                {historyItems.map((item) => {
                  const open = expandedId === item.id;
                  return (
                    <div className={`pc-history-row ${open ? "open" : ""}`} key={item.id}>
                      <button className="pc-history-summary" onClick={() => {
                        if (open) { setExpandedId(null); setExpandedDetail(null); }
                        else { setExpandedId(item.id); setExpandedDetail(null); void loadExpandedDetail(item.id); }
                      }}>
                        <span className="pc-h-col name">{item.sceneName || "-"}</span>
                        <span className="pc-h-col">{item.score} 分</span>
                        <span className="pc-h-col">
                          {item.passed ? <span className="pc-pass">合格</span> : <span className="pc-fail">不合格</span>}
                          <small className="pc-passline">（线 {item.scenePassScore}）</small>
                        </span>
                        <span className="pc-h-col">{modeLabel(item.mode)}</span>
                        <span className="pc-h-col">{formatDateTime(item.finishedAt)}</span>
                        {isAdmin && <span className="pc-h-col">{item.userName || "-"}</span>}
                        <span className="pc-h-caret">{open ? "收起" : "查看详情"}</span>
                      </button>
                      {open && (
                        <HistoryDetailView detail={expandedDetail} passScore={item.scenePassScore} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </AppShell>
  );
}

// ================= 评分卡 =================
function ScoreCard({
  result,
  sceneRules,
  passScore,
  onBack,
  onRestart,
}: {
  result: TrainingRecordResult;
  sceneRules: Array<{ id: string; name: string; score: number }>;
  passScore: number;
  onBack: () => void;
  onRestart: () => void;
}) {
  const ruleMaxMap = new Map(sceneRules.map((r) => [r.id, r.score]));
  const passed = result.record.score >= passScore;
  const rounds = Math.max(1, Math.ceil((result.turns?.length || 0) / 2));
  return (
    <div className="pc-scorecard">
      <div className="pc-score-head">
        <div className={`pc-score-total ${passed ? "pass" : "fail"}`}>
          <span className="pc-score-num">{result.record.score}</span>
          <span className="pc-score-unit">分</span>
        </div>
        <div className="pc-score-meta">
          <p className={passed ? "pc-pass" : "pc-fail"}>{passed ? "本次对练合格" : "本次对练未合格"}（场景合格线 {passScore}）</p>
          <p className="muted">场景：{result.record.sceneName || "-"} · {modeLabel(result.record.mode)} · 共 {rounds} 轮</p>
        </div>
      </div>

      <div className="pc-score-dims">
        <h4>各维度评分</h4>
        {result.scores?.length ? (
          result.scores.map((s, i) => {
            const max = ruleMaxMap.get((s as { scoringRuleId?: string }).scoringRuleId || "") ?? (sceneRules[i]?.score ?? 100);
            const ratio = max > 0 ? s.score / max : 0;
            const dimPass = ratio * 100 >= passScore;
            return (
              <div className="pc-dim" key={s.id || i}>
                <div className="pc-dim-top">
                  <span className="pc-dim-name">{s.ruleName || `维度${i + 1}`}</span>
                  <span className={`pc-dim-badge ${dimPass ? "pass" : "fail"}`}>{dimPass ? "达标" : "未达标"}</span>
                </div>
                <div className="pc-dim-score">{s.score} <small>/ {max}</small></div>
                {s.deductionReason ? <p className="pc-dim-reason">{s.deductionReason}</p> : null}
              </div>
            );
          })
        ) : (
          <p className="muted">本次未返回维度评分。</p>
        )}
      </div>

      {result.suggestions?.length ? (
        <div className="pc-score-suggest">
          <h4>改进建议</h4>
          <ul>
            {result.suggestions.map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="pc-score-actions">
        <button className="pc-btn-ghost" onClick={onBack}>
          {window.sessionStorage.getItem("zxt-practice-taskId") ? "返回任务详情" : "返回历史记录"}
        </button>
        <button className="pc-btn-primary" onClick={onRestart}>再来一次</button>
      </div>
    </div>
  );
}

// ================= 历史详情 =================
function HistoryDetailView({ detail, passScore }: { detail: HistoryDetail | null; passScore: number }) {
  if (!detail) return <div className="pc-detail-loading">加载中…</div>;
  return (
    <div className="pc-detail">
      <div className="pc-detail-scores">
        <h4>各维度评分</h4>
        {detail.scores?.length ? (
          <div className="pc-detail-score-grid">
            {detail.scores.map((s, i) => (
              <div className="pc-dim" key={s.id || i}>
                <div className="pc-dim-name">{s.ruleName || `维度${i + 1}`}</div>
                <div className="pc-dim-score">{s.score} <small>分</small></div>
                {s.deductionReason ? <p className="pc-dim-reason">{s.deductionReason}</p> : null}
              </div>
            ))}
          </div>
        ) : <p className="muted">无维度评分。</p>}
      </div>
      <div className="pc-detail-replay">
        <h4>对话回放</h4>
        {detail.turns?.length ? (
          <div className="pc-replay">
            {detail.turns.map((t, i) => (
              <div className={`pc-bubble ${t.speaker === "ai" ? "ai" : "learner"}`} key={t.id || i}>
                <span className="pc-bubble-role">{t.speaker === "ai" ? "AI" : "学员"}</span>
                <div className="pc-bubble-text">{t.text}</div>
              </div>
            ))}
          </div>
        ) : <p className="muted">无对话记录。</p>}
        <p className="pc-detail-pass muted">综合分 {detail.record.score} / 合格线 {passScore}</p>
      </div>
    </div>
  );
}

// ================= 工具函数 =================
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getMicrophoneErrorMessage(err?: unknown) {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "当前页面不是安全访问地址，浏览器会禁止麦克风。请使用 https:// 域名访问，或在本机用 localhost 测试。";
  }

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "当前浏览器不支持麦克风采集，请使用新版 Chrome/Edge，并确认页面通过 https 或 localhost 打开。";
  }

  if (typeof window !== "undefined" && typeof window.MediaRecorder === "undefined") {
    return "当前浏览器不支持录音组件 MediaRecorder，请使用新版 Chrome/Edge。";
  }

  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "麦克风权限被浏览器拒绝。请点击地址栏左侧权限图标，将麦克风改为允许后刷新页面。";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "没有检测到可用麦克风，请检查耳机/麦克风是否连接，并确认系统录音设备可用。";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "麦克风正在被其他软件占用，请关闭会议、录音或浏览器其他标签页后重试。";
  }
  if (name === "OverconstrainedError") {
    return "当前麦克风不满足浏览器采集要求，请切换录音设备后重试。";
  }

  return "无法访问麦克风，请检查浏览器权限、系统录音权限或设备占用情况。";
}
