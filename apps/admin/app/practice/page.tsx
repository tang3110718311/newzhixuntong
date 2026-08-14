"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./practice.css";
import AppShell, { type RightRailData } from "@/components/AppShell";
import { navigateTo } from "@/lib/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const AUTH_STORAGE_KEY = "zxt-admin-auth";
// 自有 FunASR 桥接服务(实时流式识别直连地址)
const FUNASR_WS_URL = process.env.NEXT_PUBLIC_FUNASR_WS_URL || "wss://zxt.xingyiwulian.cn:8765";

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
  level?: string | null;
};

const LEVEL_META: Record<string, { label: string; cls: string }> = {
  excellent: { label: "精通", cls: "excellent" },
  pass: { label: "达标", cls: "pass" },
  developing: { label: "待提升", cls: "developing" },
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
  highlights?: string[];
  weaknesses?: string[];
  capabilityProfile?: string;
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
  turns: Array<{ id: string; speaker: string; text: string; durationMs: number; emotion?: string }>;
  scores: ScoreDetail[];
};

type View = "chat" | "history";

// 统一固定音色：晓燕（旧版智训通 TTS 默认音色，避免同场多次发言音色不一致）
const CHAT_TTS_VOICES = [
  "xiaoyan",
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

// AI 开场等待时的分步文案（循环提示，缓解等待焦虑）
const AI_OPENING_STEPS = ["正在唤醒 AI 教练", "正在分析场景上下文", "正在生成首问话术"];

export default function PracticePage() {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  // 有 URL sceneId 时，初始直接进 chat 视图（避免闪现场景选择页）
  // 注意：不能直接在 useState 初始值里读 window.location（SSR 阶段 window 不存在，
  // 会导致 SSR 渲染 history、客户端 hydration 渲染 chat，触发 React 水合错误 #418 页面空白），
  // 必须挂载后再用 useEffect 读取并设置 view。
  const [view, setView] = useState<View>("history");

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
  // 结束过渡:AI 收尾话播完再切评分页(语音模式),期间隐藏输入区
  const [chatEnding, setChatEnding] = useState(false);
  const endingStateRef = useRef<{ record: TrainingRecordResult | null; pending: boolean; session: string | null } | null>(null);
  const endingSettledRef = useRef(false);
  // 对练前引导数据 + 引导层显隐 + 轮次进度
  const [sceneBrief, setSceneBrief] = useState<{
    description?: string;
    aiRole?: { identity?: string; background?: string; goal?: string } | null;
    learnerRole?: { identity?: string; goal?: string } | null;
    scoringRules: Array<{ name: string; score: number; criteria?: string }>;
    passScore: number;
    endCondition?: string;
  } | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  const [chatRound, setChatRound] = useState(0);
  // 进入对练时间 + 展示用记录编号（对应截图顶部"编号 · 时间"）
  const [enterTime, setEnterTime] = useState("");
  const [recordNo, setRecordNo] = useState("");
  // 当前场景的评分维度（满分）与场景合格线
  const [sceneRules, setSceneRules] = useState<Array<{ id: string; name: string; score: number }>>([]);
  // AI 开场等待态：分步文案轮播的当前步骤索引
  const [openingStep, setOpeningStep] = useState(0);
  // 场景开场白预览（引导页展示 AI 会如何开场）
  const [openingPreview, setOpeningPreview] = useState<string | null>(null);
  const [openingPreviewLoading, setOpeningPreviewLoading] = useState(false);

  // 历史记录视图
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 20;
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize));
  const [historyFilterScene, setHistoryFilterScene] = useState("");
  const [historyFilterUser, setHistoryFilterUser] = useState("");
  const [userOptions, setUserOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<HistoryDetail | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  // 实时识别回显文本(流式录音时动态更新)
  const [liveTranscript, setLiveTranscript] = useState("");
  // 语音识别后自动发送开关(默认关=识别文字回显到输入框,确认后再发送)
  const [autoSendVoice, setAutoSendVoice] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("zxt-practice-auto-send-voice") === "1";
  });
  const autoSendVoiceRef = useRef(autoSendVoice);

  const toggleAutoSendVoice = useCallback(() => {
    setAutoSendVoice((prev) => {
      const next = !prev;
      autoSendVoiceRef.current = next;
      localStorage.setItem("zxt-practice-auto-send-voice", next ? "1" : "0");
      return next;
    });
  }, []);
  // 每个场景固定一种声音（进入场景时随机男女声，整个场景不变）
  const [ttsVoice, setTtsVoice] = useState<string | null>(null);

  // 错误提示
  const [error, setError] = useState("");

  // 语音采集
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingRef = useRef(false);
  // 实时流式识别(WebSocket 直连自有桥接服务)引用
  const liveStreamRef = useRef<{
    ws: WebSocket;
    ctx: AudioContext;
    scriptNode: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    stream: MediaStream;
    finalText: string;
  } | null>(null);

  // 当前播放的音频引用（用于退出/切换时停止）
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 当前场景固定声音
  const sceneVoiceRef = useRef<string | null>(null);
  // 记录当前已由哪个 sceneId 锁定了声音，避免重复进入时换声
  const sceneVoiceSceneIdRef = useRef<string | null>(null);
  // 对练会话 ID：进入场景时生成，整个会话共享，用于训练记录幂等与评分轮询
  const sessionIdRef = useRef<string>("");
  // 评分轮询定时器（组件卸载时清理）
  const pollTimerRef = useRef<number | null>(null);

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

  // ===== 评分结果轮询（结束回合后评分在后台执行，轮询 by-session 接口取结果） =====
  const pollTrainingResult = useCallback(
    async (sessionId: string, attempt = 1) => {
      try {
        const data = await apiGet<TrainingRecordResult | null>(`/training-records/by-session/${encodeURIComponent(sessionId)}`);
        if (data) {
          setChatResult(data);
          return;
        }
      } catch {
        // 轮询失败静默重试，不打断用户
      }
      if (attempt >= 15) {
        setError("评分生成较慢，可稍后在历史记录中查看本次对练结果。");
        return;
      }
      pollTimerRef.current = window.setTimeout(() => {
        void pollTrainingResult(sessionId, attempt + 1);
      }, 2000);
    },
    [apiGet],
  );

  // ===== TTS（在进入对话前定义，供首问播报使用） =====
  // 返回 Promise:播放结束(或出错/超时/被停止)后 resolve,供"收尾话播完再切评分页"使用
  const playTts = useCallback(
    async (text: string, emotion: string = "default", voice?: string): Promise<boolean> => {
      // 如果学员正在录音，不播放 AI 语音
      if (recordingRef.current) return false;
      // 先停止上一段未播完的音频，避免叠加
      stopAudio();
      try {
        const data = await apiPost<{ audioBase64: string; format: string }>(`/ai/tts/synthesize`, { text, emotion, voice: voice || ttsVoice });
        if (!data?.audioBase64) return false;
        const audio = new Audio(`data:audio/${data.format || "mp3"};base64,${data.audioBase64}`);
        audioRef.current = audio;
        const played = await new Promise<boolean>((resolve) => {
          let settled = false;
          const done = (ok: boolean) => {
            if (settled) return;
            settled = true;
            if (audioRef.current === audio) audioRef.current = null;
            resolve(ok);
          };
          audio.onended = () => done(true);
          audio.onerror = () => done(false);
          audio.onpause = () => done(false); // 被 stopAudio 中断也算"播完"
          audio.play().catch(() => done(false));
          // 兜底:30s 未播完(如浏览器限制)也放行，避免卡住结束流程
          window.setTimeout(() => done(true), 30000);
        });
        return played;
      } catch {
        // 语音播报失败仅降级为文字，不阻断对话
        return false;
      }
    },
    [apiPost, stopAudio, ttsVoice],
  );

  // ===== 结束收尾：AI 收尾话播完(或跳过)后切评分页并取评分 =====
  const finishToScore = useCallback(
    (st: { record: TrainingRecordResult | null; pending: boolean; session: string | null }) => {
      setChatFinished(true);
      if (st.record) setChatResult(st.record);
      else if (st.pending && st.session) void pollTrainingResult(st.session);
    },
    [pollTrainingResult],
  );

  // 收尾话播放中，用户点"跳过"直接看评分
  const skipEnding = useCallback(() => {
    if (endingSettledRef.current || !endingStateRef.current) return;
    endingSettledRef.current = true;
    stopAudio();
    finishToScore(endingStateRef.current);
  }, [finishToScore, stopAudio]);

  // 进入结束过渡：记录评分取数所需数据，语音模式等收尾话播完再切评分页
  const beginEnding = useCallback(
    async (data: { aiReply: string; trainingRecord: TrainingRecordResult | null; recordPending?: boolean; emotion?: string; voice?: string }) => {
      setChatEnding(true);
      endingSettledRef.current = false;
      endingStateRef.current = {
        record: data.trainingRecord ?? null,
        pending: data.recordPending ?? false,
        session: sessionIdRef.current,
      };
      if (voiceMode && !recordingRef.current) {
        await playTts(data.aiReply, data.emotion || "default", data.voice).catch(() => false);
      }
      if (!endingSettledRef.current) {
        endingSettledRef.current = true;
        finishToScore(endingStateRef.current);
      }
    },
    [finishToScore, playTts, voiceMode],
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

  // 加载 AI 开场白预览（引导页展示）：调 /ai/chat 空消息，不创建训练记录
  const loadOpeningPreview = useCallback(
    async (scene: Scene) => {
      setOpeningPreviewLoading(true);
      setOpeningPreview(null);
      try {
        const data = await apiPost<{ aiReply: string }>(`/ai/chat`, {
          sceneId: scene.id,
          preview: true,
        });
        setOpeningPreview(data.aiReply || null);
      } catch {
        setOpeningPreview(null);
      } finally {
        setOpeningPreviewLoading(false);
      }
    },
    [apiPost],
  );

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
      // 新会话开始前：停止上一会话遗留的评分轮询，清空结束过渡状态
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      endingSettledRef.current = false;
      endingStateRef.current = null;
      setSelectedScene(scene);
      setChatMessages([]);
      setChatInput("");
      setCoachTip(null);
      setChatFinished(false);
      setChatResult(null);
      // sessionId 由服务端创建，避免客户端伪造会话和成绩
      sessionIdRef.current = "";
      // 记录进入对练的时间与展示用编号（RW + 年月日时分）
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setEnterTime(
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
      );
      setRecordNo(`RW${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`);
      setView("chat");
      setShowBrief(true);
      setChatRound(0);
      try {
        const detail = await apiGet<{
          scene: { passScore: number; mode: string; description?: string };
          roles?: Array<{ roleType: string; identity?: string; background?: string; goal?: string }>;
          scoringRules: Array<{ id: string; name: string; score: number; criteria?: string }>;
          rule?: { endCondition?: string };
        }>(`/scenes/${scene.id}`);
        setSceneRules(detail.scoringRules || []);
        setSceneBrief({
          description: detail.scene?.description || "",
          aiRole: detail.roles?.find((r) => r.roleType === "ai") || null,
          learnerRole: detail.roles?.find((r) => r.roleType === "learner") || null,
          scoringRules: detail.scoringRules || [],
          passScore: detail.scene?.passScore ?? 80,
          endCondition: detail.rule?.endCondition || undefined,
        });
        // 引导页展示后,预取 AI 开场白（仅预览，不创建训练记录）
        void loadOpeningPreview(scene);
      } catch (err) {
        setError(err instanceof Error ? err.message : "进入对话失败");
      }
    },
    [apiGet, pickSceneVoice, stopAudio, loadOpeningPreview],
  );

  const triggerAiFirst = useCallback(
    async (scene: Scene, _rules: Array<{ id: string; name: string; score: number }>) => {
      setChatSending(true);
      try {
        const data = await apiPost<{ aiReply: string; isFinished: boolean; trainingRecord: TrainingRecordResult | null; recordPending?: boolean; coachTip: string | null; emotion: string; round?: number; sessionId?: string }>(`/ai/chat`, {
          sceneId: scene.id,
          action: "start",
        });
        if (data.sessionId) sessionIdRef.current = data.sessionId;
        const emotion = data.emotion || "default";
        const voice = ttsVoice || pickSceneVoice(scene.id);
        setChatMessages([{ role: "ai", content: data.aiReply, emotion }]);
        setCoachTip(data.coachTip || null);
        setChatRound(data.round ?? 0);
        // AI 先开口默认自动语音播报；若首问即结束，则等播完再切评分页
        isFirstAiRef.current = true;
        if (data.isFinished) {
          void beginEnding({ aiReply: data.aiReply, trainingRecord: data.trainingRecord, recordPending: data.recordPending, emotion, voice });
        } else if (voiceMode) {
          void playTts(data.aiReply, emotion, voice);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI 首问失败");
      } finally {
        setChatSending(false);
      }
    },
    [apiPost, pickSceneVoice, playTts, ttsVoice, voiceMode, pollTrainingResult],
  );

  // 引导页"开始训练":关闭引导并触发 AI 首问
  const startTraining = useCallback(async () => {
    setShowBrief(false);
    setOpeningStep(0);
    if (selectedScene) {
      await triggerAiFirst(selectedScene, sceneRules);
    }
  }, [selectedScene, sceneRules, triggerAiFirst]);

  // AI 开场等待态：无消息且请求中时，分步文案每 1.8s 轮播一次
  useEffect(() => {
    if (chatMessages.length > 0 || !chatSending) {
      setOpeningStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setOpeningStep((s) => (s + 1) % AI_OPENING_STEPS.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [chatMessages.length, chatSending]);

  // ===== 发送消息 =====
  const sendChatMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || !selectedScene || chatSending) return;
      if (!sessionIdRef.current) {
        setError("对练会话尚未建立，请重新开始训练。");
        return;
      }
      const nextMessages: ChatMessage[] = [...chatMessages, { role: "learner", content }];
      setChatMessages(nextMessages);
      setChatInput("");
      setChatSending(true);
      setCoachTip(null);
      try {
        const data = await apiPost<{ aiReply: string; isFinished: boolean; trainingRecord: TrainingRecordResult | null; recordPending?: boolean; coachTip: string | null; emotion: string; round?: number; sessionId?: string }>(`/ai/chat`, {
          sceneId: selectedScene.id,
          action: "message",
          sessionId: sessionIdRef.current,
          learnerText: content,
        });
        if (data.sessionId) sessionIdRef.current = data.sessionId;
        const emotion = data.emotion || "default";
        const voice = ttsVoice || pickSceneVoice(selectedScene.id);
        setChatMessages([...nextMessages, { role: "ai", content: data.aiReply, emotion }]);
        setCoachTip(data.coachTip || null);
        setChatRound(data.round ?? 0);
        // 结束:先播 AI 收尾话(语音模式),播完再切评分页;未结束则正常播报
        if (data.isFinished) {
          void beginEnding({ aiReply: data.aiReply, trainingRecord: data.trainingRecord, recordPending: data.recordPending, emotion, voice });
        } else if (voiceMode && !recordingRef.current) {
          void playTts(data.aiReply, emotion, voice);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "对话失败");
      } finally {
        setChatSending(false);
      }
    },
    [apiPost, chatMessages, chatSending, pickSceneVoice, playTts, selectedScene, ttsVoice, voiceMode, pollTrainingResult],
  );

  // ===== 结束训练（主动） =====
  const endTraining = useCallback(async () => {
    if (!selectedScene || chatSending) return;
    if (!sessionIdRef.current) {
      setError("对练会话尚未建立，请重新开始训练。");
      return;
    }
    setChatSending(true);
    setError("");
    try {
      const data = await apiPost<{ aiReply: string; isFinished: boolean; trainingRecord: TrainingRecordResult | null; recordPending?: boolean; coachTip: string | null }>(`/ai/chat`, {
        sceneId: selectedScene.id,
        action: "end",
        sessionId: sessionIdRef.current,
      });
      if (data.aiReply) setChatMessages((prev) => [...prev, { role: "ai", content: data.aiReply }]);
      // 等 AI 收尾话播完(语音模式)再切评分页
      void beginEnding({ aiReply: data.aiReply, trainingRecord: data.trainingRecord, recordPending: data.recordPending, emotion: "default" });
      if (!data.trainingRecord && !data.recordPending) {
        setError("训练记录保存失败，请重试。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "结束训练失败");
    } finally {
      setChatSending(false);
    }
  }, [apiPost, chatMessages, chatSending, selectedScene, pollTrainingResult]);

  // ===== STT + 语音采集(实时流式优先,失败回退一次性转写) =====
  const startLiveStream = useCallback(async (stream: MediaStream): Promise<boolean> => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx || typeof window.WebSocket === "undefined") return false;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const scriptNode = ctx.createScriptProcessor(4096, 1, 1);
      const ws = new WebSocket(FUNASR_WS_URL);
      const state = { ws, ctx, scriptNode, source, stream, finalText: "" };
      let opened = false;

      scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!opened || ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm = resampleToInt16(input, ctx.sampleRate, 16000);
        if (pcm.byteLength > 0) ws.send(pcm);
      };
      ws.onopen = () => {
        opened = true;
      };
      ws.onmessage = (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(ev.data as string) as { asr_result?: string; status?: string };
          if (typeof msg.asr_result === "string" && msg.asr_result.length > 0) {
            state.finalText = msg.asr_result;
            setLiveTranscript(msg.asr_result);
          }
        } catch { /* 非 JSON 忽略 */ }
      };
      ws.onerror = () => { /* 交由超时保护统一失败 */ };

      // 麦克风音频不输出到扬声器(接静音 gain 节点保证 scriptNode 被拉取)
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(scriptNode);
      scriptNode.connect(mute);
      mute.connect(ctx.destination);

      // 3 秒内未连上桥接则视为失败,回退一次性转写
      const result = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          if (!opened) {
            try { ws.close(); } catch { /* noop */ }
            try { scriptNode.onaudioprocess = null; source.disconnect(); scriptNode.disconnect(); ctx.close(); } catch { /* noop */ }
            resolve(false);
          } else {
            resolve(true);
          }
        }, 3000);
        ws.onopen = () => {
          opened = true;
          clearTimeout(timer);
          resolve(true);
        };
      });
      if (!result) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      liveStreamRef.current = state;
      return true;
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (recordingRef.current) return;
    setError("");
    setLiveTranscript("");
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof window === "undefined" ||
      !window.isSecureContext
    ) {
      setError(getMicrophoneErrorMessage());
      return;
    }
    // 学员开始说话时，立即停止 AI 语音播报
    stopAudio();
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 实时流式优先：WebSocket 直连自有桥接服务，边录边回显文字
      const liveOk = await startLiveStream(stream);
      if (liveOk) {
        recordingRef.current = true;
        setIsRecording(true);
        return;
      }
      // 回退：MediaRecorder 一次性转写
      if (typeof window.MediaRecorder === "undefined") {
        setError(getMicrophoneErrorMessage());
        return;
      }
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream?.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        // 优先转 16kHz/16bit PCM 走自有 FunASR 桥接服务;解码失败回退 webm 走 Whisper
        const pcmBase64 = await blobToPcm16Base64(blob);
        const audioBase64 = pcmBase64 ?? (await blobToBase64(blob));
        const format = pcmBase64 ? "pcm16" : "webm";
        try {
          const data = await apiPost<{ text: string }>(`/ai/stt/transcribe`, { audioBase64, format });
          if (data.text && data.text.trim()) {
            const text = data.text.trim();
            if (autoSendVoiceRef.current) {
              void sendChatMessage(text);
            } else {
              setChatInput(text);
              setError("");
            }
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
      stream?.getTracks().forEach((t) => t.stop());
      recordingRef.current = false;
      setIsRecording(false);
      setError(getMicrophoneErrorMessage(err));
    }
  }, [apiPost, sendChatMessage, stopAudio, startLiveStream]);

  const stopRecording = useCallback(() => {
    // 实时流式模式：结束音源、发 stop、取最终文本
    if (liveStreamRef.current) {
      const live = liveStreamRef.current;
      liveStreamRef.current = null;
      live.scriptNode.onaudioprocess = null;
      try { live.source.disconnect(); live.scriptNode.disconnect(); } catch { /* noop */ }
      live.stream.getTracks().forEach((t) => t.stop());
      try { void live.ctx.close(); } catch { /* noop */ }
      recordingRef.current = false;
      setIsRecording(false);
      try {
        live.ws.send(JSON.stringify({ command: "stop" }));
      } catch { /* noop */ }
      // 给最后一段识别结果留时间，再取最终文本
      setTimeout(() => {
        try { live.ws.close(); } catch { /* noop */ }
        const finalText = live.finalText;
        setLiveTranscript("");
        if (finalText && finalText.trim()) {
          const text = finalText.trim();
          if (autoSendVoiceRef.current) {
            // 开关打开：识别后自动发送
            void sendChatMessage(text);
          } else {
            // 默认：回显到输入框，学员确认/修改后点发送
            setChatInput(text);
            setError("");
          }
        } else {
          setError("未识别到语音内容，请改用文字或重试。");
        }
      }, 400);
      return;
    }
    if (mediaRecorderRef.current && recordingRef.current) {
      mediaRecorderRef.current.stop();
      recordingRef.current = false;
    }
  }, [sendChatMessage]);

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
    // 离开对话视图：停止上一会话的评分轮询，避免串场更新新会话状态
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    // 如果从任务详情页跳来，返回任务详情页
    const storedTaskId = window.sessionStorage.getItem("zxt-practice-taskId");
    if (storedTaskId) {
      navigateTo(`/tasks/${storedTaskId}`);
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
  const loadHistory = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams();
      params.set("pageSize", String(historyPageSize));
      params.set("page", String(page));
      params.set("status", "completed");
      if (historyFilterScene) params.set("sceneId", historyFilterScene);
      const me = readStoredAuth();
      const isAdminNow = me?.user.roleCode === "tenant_admin";
      if (isAdminNow && historyFilterUser) params.set("filterUserId", historyFilterUser);
      const data = await apiGet<{ items: HistoryItem[]; total: number }>(`/training-records?${params.toString()}`);
      setHistoryItems(data.items || []);
      setHistoryTotal(data.total || 0);
      setHistoryPage(page);
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
      navigateTo("/");
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
      setView("chat");
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

  // 对练结束后停留在评分页：自动滚到顶部让学员看到评分，不自动跳转
  useEffect(() => {
    if (!chatFinished) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [chatFinished]);

  // 离开页面/卸载时停止音频播放 + 清理评分轮询定时器
  useEffect(() => {
    return () => {
      stopAudio();
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 历史筛选变化时重载（回到第1页）
  useEffect(() => {
    if (view === "history") void loadHistory(1);
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

  // 训练提示（左栏训练目标卡片）：按轮次给方向性话术建议
  const hint = (() => {
    if (chatRound === 0) return { title: "开场回答方向", body: `先礼貌问候并说明来意，再结合"${selectedScene?.name || ""}"询问对方当前最关注的问题。` };
    if (chatRound === 1) return { title: "需求推进方向", body: "先复述并确认对方需求，再分步骤说明方案，最后明确下一步行动和时间。" };
    return { title: "收尾回答方向", body: "总结已经确认的信息，回应对方最后的顾虑，并自然提出后续跟进或复盘安排。" };
  })();

  // ================= 渲染 =================
  return (
    <AppShell
      activeNavKey="practice"
      onNavClick={(key: string) => { stopAudio(); navigateTo("/?section=" + key); }}
      rightRail={view === "chat" ? undefined : rightRail}
      breadcrumb={view === "chat" ? { label: "我的任务", childLabel: "AI对练" } : { label: "对练中心" }}
    >
      {error ? <div className="pc-error" onClick={() => setError("")}>{error}（点击关闭）</div> : null}

      {/* 对话视图顶部导航：只在非 chat 时显示 */}
      {view !== "chat" && (
        <nav className="practice-tabs">
          <button className="active">历史记录</button>
          <button type="button" onClick={() => navigateTo("/practice/script")}>话术检核</button>
        </nav>
      )}

      <main className={`practice-main${view === "chat" && selectedScene ? " practice-shell-chat" : ""}`}>
        {view === "chat" && !selectedScene && (
          <div className="pc-empty" style={{ padding: "60px 0", textAlign: "center", color: "#86909c" }}>
            正在加载场景…
          </div>
        )}

        {view === "chat" && selectedScene && (
          <section className="practice-page">
            {/* ===== 顶部标题区（原型 practice-top） ===== */}
            <div className="practice-top">
              <div className="practice-top-text">
                <div className="practice-kicker">我的任务 / AI对练</div>
                <h1>AI对练</h1>
                <p>跟随场景与AI完成一次真实沟通训练</p>
              </div>
              <div className="practice-top-actions">
                <span className={`tag blue${chatFinished ? " done" : ""}`}>
                  {chatFinished ? "对练已完成" : "对练进行中"}
                </span>
                {!chatFinished && !chatEnding && (
                  <button className="btn outline" type="button" onClick={backToHistory}>
                    退出对练
                  </button>
                )}
                {!chatFinished && !chatEnding && (
                  <button
                    className="btn danger"
                    type="button"
                    disabled={chatSending || chatMessages.length < 2}
                    onClick={() => { if (window.confirm("确定结束本次对练并查看评分？")) void endTraining(); }}
                  >
                    结束对练
                  </button>
                )}
              </div>
            </div>

            {/* ===== 三列主体：左场景信息 / 中对话区 / 右实时评分（原型 practice-layout） ===== */}
            <div className="practice-layout">
              {/* 左列：当前场景 + 训练目标 */}
              <aside className="practice-context">
                <div className="practice-context-card card">
                  <span className="practice-context-label">当前场景</span>
                  <h2>{selectedScene.name || "场景"}</h2>
                  {sceneBrief?.description ? <p className="practice-context-desc">{sceneBrief.description}</p> : null}
                  <div className="practice-info-list">
                    <div className="practice-info-row">
                      <span>AI角色</span>
                      <strong>{sceneBrief?.aiRole?.identity || "—"}</strong>
                    </div>
                    <div className="practice-info-row">
                      <span>学员角色</span>
                      <strong>{sceneBrief?.learnerRole?.identity || "—"}</strong>
                    </div>
                    <div className="practice-info-row">
                      <span>当前轮数</span>
                      <strong><em>{chatRound}</em> / 6</strong>
                    </div>
                    <div className="practice-info-row">
                      <span>回答方式</span>
                      <strong>{voiceMode ? "语音输入" : "文本输入"}</strong>
                    </div>
                  </div>
                </div>
                <div className="practice-goal-card card">
                  <span className="practice-context-label">本次训练目标</span>
                  <p>{sceneBrief?.endCondition || "与 AI 角色完成情境对话，达成场景目标。"}</p>
                  <div className="practice-tip">
                    <span>训练提示</span>
                    <p>{hint.body}</p>
                  </div>
                </div>
              </aside>

              {/* 中列：对话区 */}
              <div className="practice-main card">
                <div className="practice-chat-head">
                  <div className="practice-chat-title">
                    <span className="practice-ai-mark" aria-hidden="true">AI</span>
                    <div>
                      <div className="practice-chat-eyebrow">实时语音对练</div>
                      <h2>与AI角色进行情境对话</h2>
                      <p>每次回答后，评分、问题与改进建议会即时显示在回答下方</p>
                    </div>
                  </div>
                  <div className="practice-head-right">
                    <span className={`practice-live${chatFinished ? " done" : ""}`}>
                      <i aria-hidden="true" />{chatFinished ? "对练已完成" : "AI在线"}
                    </span>
                    <div className="practice-head-metrics">
                      <div>
                        <b>{chatRound}</b>
                        <small>已完成轮数</small>
                      </div>
                      <div>
                        <b>{chatResult?.record?.score ?? 0}</b>
                        <small>当前综合分</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 开始训练前引导：复用现有 brief（样式自适应中列） */}
                {showBrief && sceneBrief && (
                  <div className="pc-brief">
                    <div className="pc-brief-info">
                      <h3>{selectedScene.name || "训练说明"}</h3>
                      {sceneBrief.description ? <p className="pc-brief-desc">{sceneBrief.description}</p> : null}
                      <div className="pc-brief-grid">
                        {sceneBrief.learnerRole?.identity ? (
                          <div className="pc-brief-item">
                            <span className="pc-brief-label">你的角色</span>
                            <span className="pc-brief-value">{sceneBrief.learnerRole.identity}</span>
                          </div>
                        ) : null}
                        {sceneBrief.aiRole?.identity ? (
                          <div className="pc-brief-item">
                            <span className="pc-brief-label">AI 扮演</span>
                            <span className="pc-brief-value">{sceneBrief.aiRole.identity}</span>
                          </div>
                        ) : null}
                        {sceneBrief.endCondition ? (
                          <div className="pc-brief-item">
                            <span className="pc-brief-label">训练目标</span>
                            <span className="pc-brief-value">{sceneBrief.endCondition}</span>
                          </div>
                        ) : null}
                      </div>
                      {sceneBrief.scoringRules.length > 0 && (
                        <div className="pc-brief-rules">
                          <span className="pc-brief-label">评分标准(及格 {sceneBrief.passScore} 分)</span>
                          <div className="pc-brief-rules-bars">
                            {sceneBrief.scoringRules.map((r) => {
                              const total = sceneBrief.scoringRules.reduce((sum, x) => sum + (x.score || 0), 0);
                              const pct = total > 0 ? Math.round(((r.score || 0) / total) * 100) : 0;
                              return (
                                <div className="pc-brief-rule-bar" key={r.name}>
                                  <span className="pc-brief-rule-name">{r.name}</span>
                                  <div className="pc-brief-rule-track">
                                    <div className="pc-brief-rule-fill" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="pc-brief-rule-score">{r.score}分</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="pc-brief-action">
                      <div className="pc-brief-preview">
                        <div className="pc-brief-preview-head">
                          <span>👀 AI 开场预览</span>
                          {openingPreview && (
                            <button type="button" className="pc-brief-preview-refresh" onClick={() => void loadOpeningPreview(selectedScene)}>
                              换一段
                            </button>
                          )}
                        </div>
                        <div className="pc-brief-preview-body">
                          {openingPreviewLoading ? (
                            <span className="pc-brief-preview-loading">
                              <i className="pc-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                              AI 正在构思开场…
                            </span>
                          ) : openingPreview ? (
                            <p className="pc-brief-preview-text">“{openingPreview}”</p>
                          ) : (
                            <p className="pc-brief-preview-text muted">开场白生成失败，点“开始训练”仍可正常对练。</p>
                          )}
                        </div>
                      </div>
                      <div className="pc-brief-duration">
                        <span className="pc-brief-duration-ico">⏱</span>
                        <span>预计时长 3-5 分钟，AI 实时对练，结束后自动评分</span>
                      </div>
                      <button className="pc-btn-primary pc-brief-start" type="button" onClick={() => void startTraining()}>
                        开始训练
                      </button>
                      {chatRound > 0 && !chatFinished && (
                        <button className="pc-btn-ghost pc-brief-restart" type="button" onClick={() => void restartChat()}>
                          重新训练
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {chatFinished ? (
                  <div className="pc-score-view">
                    {chatResult ? (
                      <>
                        <div className="pc-score-title">📊 训练评分</div>
                        <ScoreCard
                          result={chatResult}
                          sceneRules={sceneRules}
                          passScore={selectedScene.passScore}
                          scenes={scenes}
                          onBack={backToHistory}
                          onRestart={() => void enterChat(selectedScene)}
                          onRetrainWeak={(target) => void enterChat(target)}
                        />
                      </>
                    ) : (
                      <div className="pc-score-loading">
                        <div className="pc-spinner" />
                        <p>对练已结束，正在生成评分报告…</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="practice-messages">
                      {chatMessages.length === 0 && chatSending && (
                        <div className="pc-opening">
                          <div className="pc-spinner" />
                          <p className="pc-opening-title">AI 教练正在准备开场…</p>
                          <div className="pc-opening-steps">
                            {AI_OPENING_STEPS.map((step, i) => (
                              <span key={step} className={`pc-opening-step${i <= openingStep ? " active" : ""}`}>
                                <i>{i < openingStep ? "✓" : i === openingStep ? "●" : "○"}</i>
                                {step}
                              </span>
                            ))}
                          </div>
                          <p className="pc-opening-hint">通常需要 3-8 秒，请稍候</p>
                          <button
                            className="pc-btn-ghost pc-opening-cancel"
                            type="button"
                            onClick={() => { stopAudio(); backToHistory(); }}
                          >
                            取消并返回
                          </button>
                        </div>
                      )}
                      {chatMessages.map((m, idx) => (
                        <div className={`practice-message ${m.role}`} key={`${m.role}-${idx}`}>
                          <span className={`practice-avatar${m.role === "learner" ? " student-avatar" : ""}`}>
                            {m.role === "ai" ? "AI" : "我"}
                          </span>
                          <div className="practice-msg-body">
                            <div className="practice-bubble">
                              <p className="practice-bubble-text">{m.content}</p>
                            </div>
                            <div className="practice-msg-meta">
                              <span className="practice-message-meta">{m.role === "ai" ? "AI角色 · 刚刚" : "我 · 刚刚"}</span>
                              {m.role === "ai" && (
                                <button
                                  className="pc-replay-tts-btn"
                                  type="button"
                                  onClick={() => void playTts(m.content, m.emotion, ttsVoice || undefined)}
                                >
                                  🔊 重播
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {chatSending && (
                        <div className="practice-message ai">
                          <span className="practice-avatar">AI</span>
                          <div className="practice-msg-body">
                            <div className="practice-bubble">
                              <p className="practice-bubble-text" style={{ color: "#86909c" }}>正在思考…</p>
                            </div>
                            <span className="practice-message-meta">AI角色 · 刚刚</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {coachTip && (
                      <div className="pc-coachtip-float">
                        <span className="pc-coachtip-icon">🎯</span>
                        <div className="pc-coachtip-body">
                          <div className="pc-coachtip-label">
                            <span>教练提示</span>
                            <button
                              type="button"
                              className="pc-coachtip-copy"
                              onClick={() => void navigator.clipboard?.writeText(coachTip)}
                              title="复制参考话术"
                            >
                              📋 复制话术
                            </button>
                          </div>
                          <p className="pc-coachtip-text">{coachTip}</p>
                        </div>
                      </div>
                    )}

                    {chatEnding ? (
                      <div className="pc-chat-ending">
                        <div className="pc-spinner" />
                        <p>AI 正在收尾总结，请稍候…</p>
                        <button className="pc-btn-ghost pc-skip-end" type="button" onClick={skipEnding}>跳过，直接查看评分</button>
                      </div>
                    ) : (
                      <>
                        <div className="practice-feedback">
                          {voiceMode && isRecording ? (
                            <span className="practice-feedback-rec">
                              <i aria-hidden="true" />
                              {liveTranscript ? `录音中：${liveTranscript}` : "录音中，请说话…"}
                            </span>
                          ) : (
                            <span>回答后查看本轮评分</span>
                          )}
                        </div>
                        <div className="practice-composer">
                          {voiceMode ? (
                            <div className="practice-voice-composer">
                              <button
                                className={`practice-record-btn${isRecording ? " recording" : ""}`}
                                type="button"
                                onClick={toggleRecording}
                                disabled={chatSending || !voiceMode}
                                title={isRecording ? "停止录音并识别" : "点击开始语音回答"}
                              >
                                <span className="practice-mic">{isRecording ? "⏹" : "🎤"}</span>
                                <b>{isRecording ? (liveTranscript ? liveTranscript : "正在聆听，请说话…") : "点击开始语音回答"}</b>
                                <small>{isRecording ? "再次点击结束录音并发送" : "录音完成后发送"}</small>
                              </button>
                              <button
                                className="practice-send-btn"
                                type="button"
                                onClick={() => void sendChatMessage(chatInput)}
                                disabled={chatSending || !chatInput.trim()}
                              >
                                发送回答
                              </button>
                            </div>
                          ) : (
                            <div className="practice-text-composer">
                              <textarea
                                className="field"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void sendChatMessage(chatInput); }}
                                placeholder="输入你的回答…"
                                disabled={chatSending}
                              />
                              <div className="practice-text-actions">
                                <span>{chatInput.length} 字</span>
                                <button
                                  className="practice-send-btn"
                                  type="button"
                                  onClick={() => void sendChatMessage(chatInput)}
                                  disabled={chatSending || !chatInput.trim()}
                                >
                                  发送回答
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* 右列：实时评分（原型 practice-score） */}
              <aside className="practice-score card">
                <div className="practice-score-head">
                  <div>
                    <h2>实时评分</h2>
                    <p>AI根据场景评分维度评估</p>
                  </div>
                  <div className="practice-score-total">
                    <strong>{chatResult?.record?.score ?? 0}</strong>
                    <small>综合分</small>
                  </div>
                </div>
                <div className="practice-score-list">
                  {(sceneRules.length > 0 ? sceneRules : [{ id: "t1", name: "需求理解", score: 100 }, { id: "t2", name: "沟通表达", score: 100 }, { id: "t3", name: "问题解决", score: 100 }]).map((r) => {
                    const got = chatResult?.scores?.find((s) => (s as { scoringRuleId?: string }).scoringRuleId === r.id)?.score ?? 0;
                    const max = r.score || 100;
                    const pct = max > 0 ? Math.min(100, (got / max) * 100) : 0;
                    return (
                      <div className="practice-score-item" key={r.id}>
                        <div className="practice-score-item-head">
                          <span className="practice-score-name">{r.name}</span>
                          <b>{got > 0 ? got : 0}</b>
                        </div>
                        <div className="practice-score-meter">
                          <i style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="practice-score-note">评分会随每次回答实时更新，结束对练后生成本次记录。</div>
              </aside>
            </div>
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
            {historyTotalPages > 1 && (
              <div className="pc-pagination">
                <button className="pc-page-btn" disabled={historyPage <= 1} onClick={() => void loadHistory(1)}>首页</button>
                <button className="pc-page-btn" disabled={historyPage <= 1} onClick={() => void loadHistory(historyPage - 1)}>上一页</button>
                <span className="pc-page-info">{historyPage} / {historyTotalPages}</span>
                <button className="pc-page-btn" disabled={historyPage >= historyTotalPages} onClick={() => void loadHistory(historyPage + 1)}>下一页</button>
                <button className="pc-page-btn" disabled={historyPage >= historyTotalPages} onClick={() => void loadHistory(historyTotalPages)}>末页</button>
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
  scenes,
  onBack,
  onRestart,
  onRetrainWeak,
}: {
  result: TrainingRecordResult;
  sceneRules: Array<{ id: string; name: string; score: number }>;
  passScore: number;
  scenes?: Scene[];
  onBack: () => void;
  onRestart: () => void;
  onRetrainWeak?: (target: Scene) => void;
}) {
  const ruleMaxMap = new Map(sceneRules.map((r) => [r.id, r.score]));
  const passed = result.record.score >= passScore;
  const rounds = Math.max(1, Math.ceil((result.turns?.length || 0) / 2));
  // 短板重练：优先匹配场景名包含短板关键词的场景，否则取任一其他场景
  const weakKeywords = (result.weaknesses || []).map((w) => w.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").slice(0, 6));
  const recommendedScene = (scenes || []).find((sc) => sc.id !== result.record.sceneId && weakKeywords.some((kw) => kw && (sc.name || "").includes(kw)))
    || (scenes || []).find((sc) => sc.id !== result.record.sceneId)
    || null;
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

      {result.capabilityProfile ? (
        <div className="pc-score-profile">
          <h4>能力综述</h4>
          <p>{result.capabilityProfile}</p>
        </div>
      ) : null}

      <div className="pc-score-dims">
        <h4>胜任力维度评分</h4>
        {result.scores?.length ? (
          <>
            <ScoreRadar scores={result.scores} sceneRules={sceneRules} />
            {result.scores.map((s, i) => {
              const max = ruleMaxMap.get((s as { scoringRuleId?: string }).scoringRuleId || "") ?? (sceneRules[i]?.score ?? 100);
              const ratio = max > 0 ? s.score / max : 0;
              const lvlKey = s.level && LEVEL_META[s.level] ? s.level : (ratio >= 0.9 ? "excellent" : ratio >= 0.6 ? "pass" : "developing");
              const lvl = LEVEL_META[lvlKey] || LEVEL_META.developing;
              return (
                <div className="pc-dim" key={s.id || i}>
                  <div className="pc-dim-top">
                    <span className="pc-dim-name">{s.ruleName || `维度${i + 1}`}</span>
                    <span className={`pc-level-badge ${lvl.cls}`}>{lvl.label}</span>
                  </div>
                  <div className="pc-dim-score">{s.score} <small>/ {max}</small></div>
                  {s.deductionReason ? <p className="pc-dim-reason">{s.deductionReason}</p> : null}
                  {s.evidenceText ? <p className="pc-dim-evidence">依据：{s.evidenceText}</p> : null}
                </div>
              );
            })}
          </>
        ) : (
          <p className="muted">本次未返回维度评分。</p>
        )}
      </div>

      {result.highlights?.length ? (
        <div className="pc-score-highlights">
          <h4>本轮亮点</h4>
          <ul>
            {result.highlights.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </div>
      ) : null}

      {result.weaknesses?.length ? (
        <div className="pc-score-weak">
          <h4>待提升短板</h4>
          <ul>
            {result.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          {onRetrainWeak && recommendedScene ? (
            <button className="pc-btn-primary pc-weak-retrain" type="button" onClick={() => onRetrainWeak(recommendedScene)}>
              针对短板去练习 → {recommendedScene.name}
            </button>
          ) : (
            <p className="muted">可在场景列表选择针对性场景继续练习。</p>
          )}
        </div>
      ) : null}

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

// 能力维度雷达图（SVG 自绘，轻量无依赖）
function ScoreRadar({ scores, sceneRules }: { scores: ScoreDetail[]; sceneRules: Array<{ id: string; name: string; score: number }> }) {
  const ruleMaxMap = new Map(sceneRules.map((r) => [r.id, r.score]));
  const items = scores.map((s, i) => {
    const max = ruleMaxMap.get((s as { scoringRuleId?: string }).scoringRuleId || "") ?? (sceneRules[i]?.score ?? 100);
    return { label: s.ruleName || `维度${i + 1}`, value: max > 0 ? Math.min(1, s.score / max) : 0 };
  });
  if (items.length < 3) return null;
  const SIZE = 200;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 64;
  const angle = (i: number) => (Math.PI * 2 * i) / items.length - Math.PI / 2;
  const pt = (i: number, ratio: number) => {
    const a = angle(i);
    return [CX + Math.cos(a) * R * ratio, CY + Math.sin(a) * R * ratio];
  };
  const grids = [1, 0.75, 0.5, 0.25].map((g) => items.map((_, i) => pt(i, g).join(",")).join(" "));
  const poly = items.map((_, i) => pt(i, items[i].value).join(",")).join(" ");
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="pc-radar" role="img" aria-label="能力维度雷达图">
      {grids.map((g, i) => <polygon key={i} points={g} fill="none" stroke="rgba(78,99,240,0.16)" strokeWidth="1" />)}
      <polygon points={poly} fill="rgba(78,99,240,0.28)" stroke="#4e63f0" strokeWidth="1.5" strokeLinejoin="round" />
      {items.map((it, i) => {
        const a = angle(i);
        const p1 = pt(i, it.value);
        const p2 = pt(i, 1);
        return (
          <g key={i}>
            <line x1={CX} y1={CY} x2={p2[0]} y2={p2[1]} stroke="rgba(78,99,240,0.12)" strokeWidth="1" />
            <circle cx={p1[0]} cy={p1[1]} r="3.2" fill="#4e63f0" />
            <text x={CX + Math.cos(a) * (R + 16)} y={CY + Math.sin(a) * (R + 16)} textAnchor="middle" dominantBaseline="central" fontSize="10.5" fill="#4c5085">
              {it.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ================= 历史详情 =================
function HistoryDetailView({ detail, passScore }: { detail: HistoryDetail | null; passScore: number }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // 播放回放 TTS
  const playReplayTts = async (turnId: string, text: string, emotion?: string) => {
    // 停止当前播放
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    if (playingId === turnId) {
      setPlayingId(null);
      return;
    }
    setPlayingId(turnId);
    try {
      const token = readStoredAuth()?.token || "";
      const response = await fetch(`${API_BASE}/ai/tts/synthesize`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, emotion: emotion || "default", voice: "xiaoyan" }),
      });
      const payload = await response.json() as { success: boolean; data?: { audioBase64: string; format: string } };
      if (!payload.success || !payload.data?.audioBase64) throw new Error("TTS failed");
      const audio = new Audio(`data:audio/${payload.data.format || "mp3"};base64,${payload.data.audioBase64}`);
      audioElRef.current = audio;
      audio.onended = () => { if (audioElRef.current === audio) audioElRef.current = null; setPlayingId(null); };
      audio.onerror = () => { setPlayingId(null); };
      await audio.play().catch(() => { setPlayingId(null); });
    } catch {
      setPlayingId(null);
    }
  };

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
                <div className="pc-bubble-text">
                  {t.text}
                  {t.speaker === "ai" && (
                    <button
                      className={`pc-replay-tts-btn ${playingId === t.id ? "playing" : ""}`}
                      onClick={() => playReplayTts(t.id, t.text, t.emotion)}
                      title={playingId === t.id ? "停止播放" : "播放语音"}
                    >
                      {playingId === t.id ? "\u25A0" : "\u25B6"}
                    </button>
                  )}
                </div>
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

function floatToInt16(value: number): number {
  const s = Math.max(-1, Math.min(1, value));
  return s < 0 ? s * 0x8000 : s * 0x7fff;
}

/** 实时流式:Float32 音频帧重采样为 16kHz/16bit 小端 PCM(ArrayBuffer,可直接 ws.send) */
function resampleToInt16(input: Float32Array, fromRate: number, toRate = 16000): ArrayBuffer {
  const len = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const out = new Int16Array(len);
  if (fromRate === toRate) {
    for (let i = 0; i < len; i++) out[i] = floatToInt16(input[i]);
  } else {
    for (let i = 0; i < len; i++) {
      const pos = (i * fromRate) / toRate;
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = pos - i0;
      out[i] = floatToInt16(input[i0] * (1 - frac) + input[i1] * frac);
    }
  }
  return out.buffer;
}

function bytesToBase64(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    reader.readAsDataURL(new Blob([arrayBuffer], { type: "application/octet-stream" }));
  });
}

/**
 * 将录音 blob(webm/opus)解码并重采样为 16kHz/16bit 小端 PCM 的 base64。
 * 旧版智训通桥接服务(FunASR)要求的正是该格式。失败返回 null,由调用方回退 webm。
 */
async function blobToPcm16Base64(blob: Blob, targetRate = 16000): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    await ctx.close().catch(() => undefined);
    const sourceRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    const targetLen = Math.round((channelData.length * targetRate) / sourceRate);
    const pcm = new Int16Array(targetLen);
    if (sourceRate === targetRate) {
      for (let i = 0; i < targetLen; i++) pcm[i] = floatToInt16(channelData[i]);
    } else {
      for (let i = 0; i < targetLen; i++) {
        const pos = (i * sourceRate) / targetRate;
        const i0 = Math.floor(pos);
        const i1 = Math.min(i0 + 1, channelData.length - 1);
        const frac = pos - i0;
        pcm[i] = floatToInt16(channelData[i0] * (1 - frac) + channelData[i1] * frac);
      }
    }
    const bytes = new Uint8Array(pcm.length * 2);
    for (let i = 0; i < pcm.length; i++) {
      bytes[i * 2] = pcm[i] & 0xff;
      bytes[i * 2 + 1] = (pcm[i] >> 8) & 0xff;
    }
    return await bytesToBase64(bytes);
  } catch {
    return null;
  }
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
