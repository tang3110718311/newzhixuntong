"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aiApi, recordApi, type AiInspirationHint } from "@/lib/api";
import { getDisplayedLength, splitSpeechSegments } from "@/lib/speech-sync";
import PracticeChat, { type PracticeChatMsg } from "./PracticeChat";
import { createAsyncSubmitGuard } from "@/lib/submit-guard";
import MobilePageAction from "./MobilePageAction";

interface PracticeViewProps {
  scene: any;
  task: any;
  onBack: () => void;
  showToast: (msg: string) => void;
  onReport: (sessionId: string) => void;
}

type ChatMsg = PracticeChatMsg;

/**
 * 并发受限的任务池：按 limit 并发执行 fn，返回与 items 一一对应的 promise 数组。
 * 单个任务失败不阻塞其余任务（失败结果由调用方自行 catch）。
 */
function makePooledTasks<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Array<Promise<R>> {
  const results: Array<Promise<R>> = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = fn(items[i], i);
      try {
        await results[i];
      } catch {
        /* 单个失败不影响其他任务 */
      }
    }
  };
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, run);
  void Promise.all(workers);
  return results;
}

export default function PracticeView({ scene, task, onBack, showToast, onReport }: PracticeViewProps) {
  const sceneId = scene?.scene?.id;
  // 文本形式：仅文本框+发送；语音形式：仅语音输入区（参考图还原）
  const isTextMode = task?.answerForm ? task.answerForm === "text" : scene?.scene?.mode === "text";

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inspirationHint, setInspirationHint] = useState<AiInspirationHint | null>(null);
  const [recording, setRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  // AI 语音播报状态：播报中禁止录音
  const [aiSpeaking, setAiSpeaking] = useState(false);
  // AI 消息逐字显示进度（msgId → 已显示字符数；未记录 = 显示全文）
  const [aiDisp, setAiDisp] = useState<Record<string, number>>({});
  // aiDisp 的同步引用（供 timer / audio 回调读取当前值，避免闭包过期）
  const aiDispRef = useRef<Record<string, number>>({});
  // 正在等待 TTS 合成的 AI 消息 id（合成期间气泡下显示"语音准备中…"）
  const [ttsPreparing, setTtsPreparing] = useState<string | null>(null);
  const [ttsFailed, setTtsFailed] = useState<Record<string, boolean>>({});
  // 正在播报语音的 AI 消息 id（进度条只显示在对应气泡下）
  const [speakMsgId, setSpeakMsgId] = useState<string | null>(null);
  // 学员录音已进行秒数（实时录音进度）
  const [recSec, setRecSec] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  // 进入本对练页面的次数仅用于本机展示，不作为服务端可信完成状态。
  const [practiceTimes, setPracticeTimes] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const msgSeq = useRef(0);
  const startedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSoundRef = useRef(Date.now());
  const recogRef = useRef<any>(null);
  const liveTextRef = useRef("");
  const submittingRef = useRef(false);
  const chatSubmittingRef = useRef(false);
  const voiceSubmitGuardRef = useRef(createAsyncSubmitGuard());
  const voiceTextSentRef = useRef(false);
  // 分段实时转写（Web Speech 不可用时的兜底：每 3s 把新增录音分片送后端 STT）
  const liveSttTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sttBusyRef = useRef(false);
  const sttChunkIndexRef = useRef(0);
  // 录音会话 token：隔离新旧录音，防止旧录音的异步识别结果写入新录音面板
  const recordTokenRef = useRef(0);
  // Web Speech 是否已实际产出识别结果：一旦产出即停用后端分段兜底，避免双写冲突
  const speechActiveRef = useRef(false);
  // AI 播报中同步引用（供 startRecording 等回调同步判断）
  const aiSpeakingRef = useRef(false);
  // 组件是否已卸载：用于中断"卸载后仍在 await 的 TTS 播放链"，防止关闭页面后语音继续播放
  const unmountedRef = useRef(false);
  // 录音时长计时器
  const recSecTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 当前播放中的 Audio 元素与其消息 id
  const aiAudioMsgIdRef = useRef<string | null>(null);
  // 分句播放会话 token：stopAiSpeak / 新播放 / 组件卸载时递增，播放循环检测变化即退出
  const speakSeqRef = useRef(0);
  const ttsCacheRef = useRef(new Map<string, Promise<{ audioBase64: string; format: string }>>());

  const sceneName = scene?.scene?.name || "场景对练";
  const aiRole = scene?.roles?.find((r: any) => r.roleType === "ai");
  const aiName = aiRole?.identity || "AI 教练";

  const pushMsg = useCallback((m: Omit<ChatMsg, "id">) => {
    msgSeq.current += 1;
    const id = `m${Date.now()}-${msgSeq.current}-${Math.random().toString(36).slice(2, 6)}`;
    setMessages((prev) => [...prev, { ...m, id }]);
    return id;
  }, []);

  // 开场白（StrictMode 下避免重复发送）
  useEffect(() => {
    if (!sceneId || startedRef.current) return;
    startedRef.current = true;
    setSending(true);
    aiApi
      .chat({
        sceneId,
        action: "start",
      })
      .then((res) => {
        if (res.sessionId) setSessionId(res.sessionId);
        setInspirationHint(res.inspirationHint ?? null);
        pushAiMsgAndSpeak(res.aiReply || "你好，我是" + aiName + "，我们开始吧。", res.emotion || "default");
      })
      .catch(() => pushMsg({ who: "ai", text: "（AI 对练服务暂时不可用，请稍后重试）" }))
      .finally(() => setSending(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  // 对练次数 = 进入本页面的次数（StrictMode 双执行防护）
  const enteredCountRef = useRef(false);
  useEffect(() => {
    if (!sceneId || enteredCountRef.current) return;
    enteredCountRef.current = true;
    try {
      const key = `zxt-practice-enter-${sceneId}`;
      const n = (parseInt(localStorage.getItem(key) || "0", 10) || 0) + 1;
      localStorage.setItem(key, String(n));
      setPracticeTimes(n);
    } catch { /* localStorage 不可用时忽略 */ }
  }, [sceneId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // 组件卸载时释放录音资源
  // 注意：StrictMode 开发模式下组件会 mount→unmount→remount，useRef 在 remount 时保留旧值，
  // 若不在挂载时重置 unmountedRef，cleanup 置的 true 会残留，导致 speakText 误判"已卸载"而不发 TTS 请求、AI 语音无法播放。
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      try {
        recogRef.current?.stop();
      } catch { /* ignore */ }
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
      if (liveSttTimerRef.current) clearInterval(liveSttTimerRef.current);
      if (recSecTimerRef.current) clearInterval(recSecTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopAiSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const sendText = async (text: string, isVoice = false) => {
    if (!text.trim() || !sceneId) return;
    if (chatSubmittingRef.current) return;
    if (!sessionId) {
      showToast("对练会话尚未建立，请稍后再试");
      return;
    }
    chatSubmittingRef.current = true;
    pushMsg({ who: "user", text: text.trim(), time: now(), isVoice });
    // 先占位渲染评分卡，避免评分服务超时或返回空数组时整张卡片不可见。
    const feedbackId = pushMsg({
      who: "feedback",
      text: "",
      score: null,
      feedbackMessage: "正在生成本轮点评…",
    });
    setInput("");
    setSending(true);
    try {
      const res = await aiApi.chat({
        sceneId,
        action: "message",
        sessionId,
        learnerText: text.trim(),
      });
      const activeSessionId = res.sessionId || sessionId;
      if (res.sessionId && res.sessionId !== sessionId) setSessionId(res.sessionId);
      const turnScores = res.perTurnScores ?? [];
      setMessages((prev) => prev.map((message) => message.id === feedbackId ? {
        ...message,
        score: turnScores.length
          ? turnScores.reduce((total, item) => total + (Number(item.score) || 0), 0)
          : null,
        dimensions: turnScores,
        issues: turnScores.flatMap((item) => item.issues ?? []).filter(Boolean),
        advice: turnScores.flatMap((item) => item.advice ?? []).filter(Boolean),
        feedbackMessage: turnScores.length ? undefined : "本轮暂无可用评分，已继续进行对练。",
      } : message));
      // 评分卡必须先完成首帧渲染，再继续展示或播报 AI 的下一句。
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const speakPromise = res.aiReply ? pushAiMsgAndSpeak(res.aiReply, res.emotion || "default") : null;
      setInspirationHint(res.inspirationHint ?? null);
      if (res.isFinished) {
        // 优先使用同步返回的训练记录得分；异步评分时稍后轮询一次
        if (res.trainingRecord?.score != null) {
          setScore(res.trainingRecord.score);
        } else if (res.recordPending) {
          setTimeout(() => {
            recordApi
              .bySession(activeSessionId)
              .then((rec: any) => {
                if (rec?.score != null) setScore(rec.score);
              })
              .catch(() => { /* 轮询失败不影响主流程 */ });
          }, 2500);
        }
        showToast("对练结束，正在生成报告…");
        // 等 AI 收尾话 TTS 播完再进入报告页；最长等待 30s，避免 TTS 异常导致永久阻塞
        if (speakPromise) {
          try {
            await Promise.race([
              speakPromise,
              new Promise((resolve) => setTimeout(resolve, 30000)),
            ]);
          } catch { /* 等待失败不影响进入报告页 */ }
        }
        onReport(activeSessionId);
      }
    } catch (e: any) {
      setMessages((prev) => prev.map((message) => message.id === feedbackId ? {
        ...message,
        feedbackMessage: "本轮评分服务暂时不可用，请继续完成对练。",
      } : message));
      pushMsg({ who: "ai", text: "（回复失败：" + (e.message || "网络错误") + "）" });
    } finally {
      chatSubmittingRef.current = false;
      setSending(false);
    }
  };

  const handleSend = () => {
    if (sending) return;
    sendText(input);
  };

  const endPractice = async () => {
    if (sending || !sceneId || !sessionId) return;
    setSending(true);
    try {
      const res = await aiApi.chat({ sceneId, action: "end", sessionId });
      if (res.aiReply) await pushAiMsgAndSpeak(res.aiReply, res.emotion || "default");
      showToast("对练结束，正在生成报告…");
      onReport(res.sessionId || sessionId);
    } catch (e: any) {
      showToast(e.message || "结束对练失败，请稍后重试");
    } finally {
      setSending(false);
    }
  };

  // ===== 语音链路 =====
  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  /** 解码 webm 并重采样为 16kHz mono，输出 16-bit PCM base64 */
  const blobToPcmBase64 = async (blob: Blob): Promise<string> => {
    const arrayBuf = await blob.arrayBuffer();
    const ctx = getAudioCtx();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    const src = audioBuf.getChannelData(0);
    const targetRate = 16000;
    const ratio = src.length / (audioBuf.duration * targetRate || 1);
    const outLen = Math.max(1, Math.round(src.length / ratio));
    const pcm = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const idx = Math.min(src.length - 1, Math.floor(i * ratio));
      const s = Math.max(-1, Math.min(1, src[idx]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(pcm.buffer);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  };

  /** 补全某条 AI 消息的全文显示（取消逐字进度，供播完/中断/无音频时调用） */
  const revealMsgFull = useCallback((id: string | null | undefined) => {
    if (!id) return;
    setAiDisp((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      aiDispRef.current = next;
      return next;
    });
  }, []);

  /** TTS 播放 AI 回复（记录播报状态与实时进度，供录音禁用与逐字显示） */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAiSpeak = useCallback(() => {
    // 递增会话 token：中断分句播放循环（多句合成/播放中的剩余句子全部放弃）
    speakSeqRef.current += 1;
    // 中断播报前先补全对应消息全文，避免逐字显示停留在半截
    const speakingId = aiAudioMsgIdRef.current;
    if (speakingId) revealMsgFull(speakingId);
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* ignore */ }
      try { URL.revokeObjectURL(audioRef.current.src); } catch { /* ignore */ }
      audioRef.current = null;
    }
    aiAudioMsgIdRef.current = null;
    aiSpeakingRef.current = false;
    setAiSpeaking(false);
    setSpeakMsgId(null);
    setTtsPreparing(null);
  }, [revealMsgFull]);
  /**
   * 播放单句音频（方案 A 边合边播的一部分）：
   * - 该句在全文中的起始偏移 offsetInFull 用于逐字显示定位（说到哪个字显示到哪个字）
   * - 返回 true 表示自然播完；false 表示被 stop/新播放/录音/卸载中断（调用方停止后续句子）
   */
  const playSegmentAudio = useCallback(
    (
      tts: { audioBase64: string; format: string },
      sentence: string,
      offsetInFull: number,
      totalLen: number,
      msgId: string | null,
      seq: number
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        try {
          const bin = atob(tts.audioBase64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const blob = new Blob([bytes], { type: tts.format === "wav" ? "audio/wav" : "audio/mpeg" });
          const url = URL.createObjectURL(blob);
          if (audioRef.current) {
            // 新音频抢占旧音频：先把旧消息补全全文，避免其逐字进度卡住
            const prevId = aiAudioMsgIdRef.current;
            if (prevId && prevId !== msgId) revealMsgFull(prevId);
            try { audioRef.current.pause(); } catch { /* ignore */ }
            try { URL.revokeObjectURL(audioRef.current.src); } catch { /* ignore */ }
          }
          const audio = new Audio(url);
          audioRef.current = audio;
          let settled = false;
          const settle = (played: boolean) => {
            if (settled) return;
            settled = true;
            if (audioRef.current === audio) audioRef.current = null;
            try { URL.revokeObjectURL(url); } catch { /* ignore */ }
            resolve(played);
          };
          audio.addEventListener("ended", () => settle(true));
          audio.addEventListener("error", () => settle(false));
          // 逐字显示 + 播放进度：按"该句在全文中的偏移 + 句内进度"计算绝对位置
          audio.addEventListener("timeupdate", () => {
            if (audioRef.current !== audio || !audio.duration) return;
            const p = Math.min(1, audio.currentTime / audio.duration);
            const absPos = offsetInFull + p * sentence.length;
            // 仅自动播报中的逐字消息更新展示进度；已显示全文时重播不应收回文字。
            if (msgId && aiDispRef.current[msgId] != null) {
              const shown = Math.max(aiDispRef.current[msgId], getDisplayedLength(totalLen, absPos / totalLen));
              setAiDisp((prev) => {
                if (prev[msgId] === shown) return prev;
                const next = { ...prev, [msgId]: shown };
                aiDispRef.current = next;
                return next;
              });
            }
          });
          // 播放被暂停（stopAiSpeak / 录音抢占 / 新消息）视为该句中断
          // 注意：pause 事件异步派发时 audioRef 可能已被 stopAiSpeak 置空，不能依赖它判断
          audio.addEventListener("pause", () => {
            if (audio.ended) return; // 自然播完走 ended 处理
            if (audioRef.current === audio) audioRef.current = null;
            try { URL.revokeObjectURL(url); } catch { /* ignore */ }
            settle(false);
          });
          audio.play().then(() => {
          }).catch(() => {
            if (audioRef.current === audio) audioRef.current = null;
            try { URL.revokeObjectURL(url); } catch { /* ignore */ }
            settle(false);
          });
        } catch {
          resolve(false);
        }
      });
    },
    [revealMsgFull]
  );

  const speakText = useCallback(
    async (text: string, msgId?: string, emotion = "default"): Promise<void> => {
      // 播完信号：自然播完 / 出错 / 被 stopAiSpeak 或新音频抢占时 resolve，供对练结束等关键节点等待
      const playEndResolvers: Array<() => void> = [];
      const playEndPromise = new Promise<void>((resolve: () => void) => {
        playEndResolvers.push(resolve);
      });
      const resolvePlayEnd = () => playEndResolvers.forEach((r) => r());
      // 本次播放会话 token：stop/新播放会递增，循环检测到变化即放弃后续句子
      const seq = ++speakSeqRef.current;
      try {
        // 分句：按句末标点切分（保留标点）
        const segments = splitSpeechSegments(text);
        if (!segments.length) {
          revealMsgFull(msgId);
          setTtsPreparing(null);
          resolvePlayEnd();
          return;
        }
        // 组件已卸载（页面已关闭）：TTS 结果作废，不再创建音频播放，防止关闭页面后语音继续播放
        if (unmountedRef.current) {
          setTtsPreparing(null);
          resolvePlayEnd();
          return;
        }
        // TTS 合成期间学员已开始录音，放弃语音播放并显示完整回复。
        if (recordingRef.current) {
          revealMsgFull(msgId);
          setTtsPreparing(null);
          resolvePlayEnd();
          return;
        }
        // 播报状态：AI 说话期间禁止学员录音
        aiAudioMsgIdRef.current = msgId || null;
        aiSpeakingRef.current = true;
        setAiSpeaking(true);
        setSpeakMsgId(msgId || null);
            // 分句并行合成（并发 3，避免触发后端 tts 限流），按句序 await 即"边合边播"
        const ttsPromises = makePooledTasks(segments, 3, (segment) => {
          const cacheKey = `${emotion}::${segment.ttsText}`;
          const cached = ttsCacheRef.current.get(cacheKey);
          if (cached) return cached;
          const request = aiApi.tts(segment.ttsText, "xiaoyan", emotion).then((tts) => {
            if (!tts?.audioBase64) {
              ttsCacheRef.current.delete(cacheKey);
              throw new Error("TTS returned empty audio");
            }
            return tts;
          }).catch((error) => {
            // 失败或空音频不能进入长期缓存，否则“重新播放”会重复复用失败 Promise。
            ttsCacheRef.current.delete(cacheKey);
            throw error;
          });
          ttsCacheRef.current.set(cacheKey, request);
          return request;
        });
        let allPlayed = true;
        let speechFailed = false;
        for (let i = 0; i < segments.length; i++) {
          // 中途被 stopAiSpeak / 新消息抢占 / 卸载 / 录音 → 放弃后续句子
          if (seq !== speakSeqRef.current) { allPlayed = false; break; }
          if (unmountedRef.current) { allPlayed = false; break; }
          if (recordingRef.current) { allPlayed = false; break; }
          const tts = await ttsPromises[i].catch(() => null);
          if (seq !== speakSeqRef.current) { allPlayed = false; break; }
          if (unmountedRef.current) { allPlayed = false; break; }
          if (recordingRef.current) { allPlayed = false; break; }
          if (!tts?.audioBase64) {
            speechFailed = true;
            allPlayed = false;
            break;
          }
          // 首句音频就绪（即将播放）：移除"语音准备中…"
          if (i === 0) setTtsPreparing(null);
          const segment = segments[i];
          const played = await playSegmentAudio(tts, segment.ttsText, segment.start, text.length, msgId || null, seq);
          if (!played) {
            speechFailed = seq === speakSeqRef.current && !recordingRef.current && !unmountedRef.current;
            allPlayed = false;
            break;
          }
        }
        if (allPlayed) {
          // 全部播完：补全全文 + 清播报状态
          revealMsgFull(msgId);
          setTtsPreparing(null);
          if (aiAudioMsgIdRef.current === msgId) {
            aiAudioMsgIdRef.current = null;
            aiSpeakingRef.current = false;
            setAiSpeaking(false);
                    setSpeakMsgId(null);
          }
        } else {
          if (speechFailed) {
            revealMsgFull(msgId);
            if (msgId) setTtsFailed((prev) => ({ ...prev, [msgId]: true }));
            setTtsPreparing(null);
            if (aiAudioMsgIdRef.current === msgId) {
              aiAudioMsgIdRef.current = null;
              aiSpeakingRef.current = false;
              setAiSpeaking(false);
                        setSpeakMsgId(null);
            }
            resolvePlayEnd();
            return;
          }
          // 被中断：确保当前句音频已停止（状态清理由 stopAiSpeak / 新播放负责）
          if (seq === speakSeqRef.current && audioRef.current) {
            try { audioRef.current.pause(); } catch { /* ignore */ }
          }
        }
        resolvePlayEnd();
      } catch {
        /* TTS 播放失败不阻断主流程，同时清除播报状态 */
        revealMsgFull(msgId);
        if (msgId) setTtsFailed((prev) => ({ ...prev, [msgId]: true }));
        resolvePlayEnd();
        stopAiSpeak();
      }
    },
    [stopAiSpeak, revealMsgFull, playSegmentAudio]
  );

  const pushAiMsgAndSpeak = useCallback(
    (text: string, emotion = "default"): Promise<void> => {
      // 防御性剥离模型可能残留的系统决策标记（后端已剥离，此处兜底）
      const cleaned = text.replace(/[\[【]\s*DECISION\s*[:：]\s*[a-z_]+\s*[\]】]/gi, "").trim();
      const msgId = pushMsg({ who: "ai", text: cleaned, time: now() });
      // 文本形式无需合成或播放语音，直接展示完整回复。
      if (isTextMode) return Promise.resolve();
      // 首句音频开始前不显示正文，正文由音频 timeupdate 推进。
      setAiDisp((p) => {
        const next = { ...p, [msgId]: 0 };
        aiDispRef.current = next;
        return next;
      });
      setTtsFailed((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
      // TTS 合成期间气泡下显示"语音准备中…"
      setTtsPreparing(msgId);
      // 返回播完 promise，供对练结束等场景等待收尾话播完
      return speakText(cleaned, msgId, emotion);
    },
    [isTextMode, pushMsg, speakText]
  );

  /** 停止 Web Speech 实时识别与静音检测 */
  const stopLiveRecognition = () => {
    if (recogRef.current) {
      try {
        recogRef.current.onresult = null;
        recogRef.current.onend = null;
        recogRef.current.stop();
      } catch { /* ignore */ }
      recogRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (liveSttTimerRef.current) {
      clearInterval(liveSttTimerRef.current);
      liveSttTimerRef.current = null;
    }
  };

  /** 停止录音器与麦克风流 */
  const stopRecorderAndStream = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // 停止录音时长计时
    if (recSecTimerRef.current) {
      clearInterval(recSecTimerRef.current);
      recSecTimerRef.current = null;
    }
  };

  /** 获取麦克风流：关闭聆听后设备可能未完全释放，失败时短暂等待重试一次 */
  const getMicStream = async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        throw e;
      }
    }
    throw new Error("无法访问麦克风");
  };

  const startRecording = async () => {
    if (!sceneId || submittingRef.current) return;
    // AI 正在播报时禁止开始录音，等播完再录
    if (aiSpeakingRef.current) {
      showToast("AI 正在说话，请稍候再录音");
      return;
    }
    // 学员开始说话：立即停止可能残留的 AI 播报，避免双音源
    stopAiSpeak();
    try {
      // 重置上次录音残留的实时识别文字，避免旧缓存显示/静音自动提交误用
      liveTextRef.current = "";
      setLiveText("");
      // 重置录音时长并启动计时
      setRecSec(0);
      if (recSecTimerRef.current) clearInterval(recSecTimerRef.current);
      recSecTimerRef.current = setInterval(() => {
        setRecSec((s) => s + 1);
      }, 1000);
      const stream = await getMicStream();
      streamRef.current = stream;
      // MediaRecorder（无实时识别能力时的 STT 回退录音）
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      voiceTextSentRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        // 已通过实时识别文本直接发送 / 用户取消 → 不再走 STT
        if (voiceTextSentRef.current) return;
        // 已开启新的录音（再次点击开始录音）→ 忽略旧录音器的 onstop，避免误发旧音频
        if (mediaRecorderRef.current !== rec) return;
        try {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          showToast("语音识别中…");
          const pcmBase64 = await blobToPcmBase64(blob);
          const stt = await aiApi.stt(pcmBase64, "pcm");
          if (stt.text) {
            await sendText(stt.text, true);
          } else {
            showToast("未识别到有效语音");
          }
        } catch {
          showToast("语音转写失败");
        }
      };
      // 每 1s 产生录音分片：供分段实时转写增量识别（无 timeslice 时只在 stop 时产出一次分片，
      // 录音过程中 chunks 为空，无法边说边显示）。
      rec.start(1000);
      mediaRecorderRef.current = rec;
      const recToken = ++recordTokenRef.current;
      speechActiveRef.current = false;

      // 分段实时转写兜底：Web Speech 不可用/无结果时，每 3s 把新增录音分片送后端 STT，
      // 把识别结果增量显示在聆听面板（边说边显示）。
      sttChunkIndexRef.current = 0;
      sttBusyRef.current = false;
      liveSttTimerRef.current = setInterval(async () => {
        if (sttBusyRef.current || submittingRef.current) return;
        // Web Speech 已实际产出识别结果 → 不再走后端兜底，避免双写冲突
        if (speechActiveRef.current) return;
        const recNow = mediaRecorderRef.current;
        if (!recNow || recNow.state !== "recording" || recNow !== rec) return;
        const chunks = chunksRef.current;
        if (chunks.length <= sttChunkIndexRef.current) return;
        sttBusyRef.current = true;
        try {
          const sentBefore = sttChunkIndexRef.current;
          const newChunks = chunks.slice(sentBefore);
          sttChunkIndexRef.current = chunks.length;
          // 关键：真实 MediaRecorder 的 webm 分片中只有首个分片含容器头、可独立解码，
          // 后续分片必须拼接首个分片才能 decodeAudioData。首次发送（从 0 开始）已含头分片，无需重复拼接。
          const parts = sentBefore === 0 ? newChunks : [chunks[0], ...newChunks];
          const blob = new Blob(parts, { type: recNow.mimeType || "audio/webm" });
          const pcmBase64 = await blobToPcmBase64(blob);
          const stt = await aiApi.stt(pcmBase64, "pcm");
          // 录音会话已切换（重新开始录音/已关闭）→ 丢弃过期结果
          if (recordTokenRef.current !== recToken) return;
          const seg = (stt.text || "").trim();
          if (seg) {
            // 每次识别的是"录音开始到当前"的整段音频，直接覆盖显示（文字随录音逐步完整）
            // 仅在结果不短于当前时覆盖，避免识别波动导致已显示文字后退
            if (seg.length >= liveTextRef.current.length) {
              liveTextRef.current = seg;
              setLiveText(seg);
            }
          }
        } catch {
          /* 单次分段识别失败跳过，最终整段 STT 兜底 */
        }
        sttBusyRef.current = false;
      }, 3000);

      // 音量分析（波形 + 静音自动提交判定）
      const ctx = getAudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      lastSoundRef.current = Date.now();
      silenceTimerRef.current = setInterval(() => {
        try {
          analyser.getByteFrequencyData(dataArr);
          let sum = 0;
          for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
          const avg = sum / dataArr.length / 255;
          if (avg > 0.02) {
            lastSoundRef.current = Date.now();
          } else if (Date.now() - lastSoundRef.current >= 3500) {
            // 静音超过 3.5s：有识别文本则自动提交，否则继续聆听
            if (liveTextRef.current.trim()) {
              submitVoice();
            } else {
              lastSoundRef.current = Date.now();
            }
          }
        } catch { /* ignore */ }
      }, 250);

      // 实时听写（Web Speech API，Safari/Chrome 移动端可用时启用）
      const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        try {
          const recog = new SR();
          recog.lang = "zh-CN";
          recog.continuous = true;
          recog.interimResults = true;
          recog.onresult = (e: any) => {
            let final = "";
            let interim = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const r = e.results[i];
              if (r.isFinal) final += r[0].transcript;
              else interim += r[0].transcript;
            }
            const combined = (final + interim).trim();
            // Web Speech 实际产出结果 → 停用后端分段兜底，避免双写冲突
            if (combined) speechActiveRef.current = true;
            liveTextRef.current = combined;
            setLiveText(combined);
          };
          recog.onend = () => {
            // 浏览器偶发自动停止：仍在聆听状态则重启
            if (recordingRef.current && !submittingRef.current) {
              try {
                recog.start();
              } catch { /* ignore */ }
            }
          };
          recogRef.current = recog;
          recog.start();
        } catch { /* 实时识别启动失败，回退整段录音 STT */ }
      }

      setRecording(true);
    } catch {
      // 麦克风/录音启动失败：清理录音时长计时，避免空转
      if (recSecTimerRef.current) {
        clearInterval(recSecTimerRef.current);
        recSecTimerRef.current = null;
      }
      setRecSec(0);
      showToast("无法访问麦克风，请检查浏览器权限");
    }
  };

  // 供 onend 判断"仍在聆听"的同步引用
  const recordingRef = useRef(false);
  recordingRef.current = recording;

  /** 发送语音：有实时识别文本直接发送，否则等待 STT 回退 */
  const submitVoice = () => {
    void voiceSubmitGuardRef.current.run(async () => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      try {
        setRecording(false);
        stopLiveRecognition();
        const live = liveTextRef.current.trim();
        if (live) {
          voiceTextSentRef.current = true;
          stopRecorderAndStream();
          await sendText(live, true);
        } else {
          stopRecorderAndStream(); // onstop 中走 STT
        }
        // 发送/提交后清空实时识别文字缓存，避免下一次录音残留
        setLiveText("");
        liveTextRef.current = "";
      } finally {
        submittingRef.current = false;
      }
    });
  };

  /** 关闭聆听面板（不发送） */
  const closeListening = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setRecording(false);
    stopLiveRecognition();
    voiceTextSentRef.current = true; // 取消本次，onstop 不再发送
    stopRecorderAndStream();
    setLiveText("");
    liveTextRef.current = "";
    // 允许再次开始
    setTimeout(() => {
      submittingRef.current = false;
    }, 300);
  };

  const hint = inspirationHint ?? {
    title: "回答方向",
    body: "暂无新的上下文提示，请先结合 AI 最新追问自行组织回答。",
  };

  return (
    <div className="pv-shell mobile-page-background">
      {/* ===== 顶部导航（淡天蓝渐变） ===== */}
      <header className="pv-nav">
        <MobilePageAction kind="back" variant="immersive" onClick={onBack} aria-label="返回场景工作台" />
        <div className="pv-nav-title">
          <h1>AI对练</h1>
          <span className="pv-live-badge">
            <i></i>进行中
          </span>
        </div>
        <button className="pv-end-practice" type="button" onClick={() => void endPractice()} disabled={sending || !sessionId}>结束对练</button>
      </header>

      {/* ===== 场景信息三栏卡 ===== */}
      <div className="pv-scene-card">
        <div className="pv-scene-col">
          <span>对练场景 · AI角色</span>
          <b>
            {sceneName} · {aiName}
          </b>
        </div>
        <div className="pv-scene-col">
          <span>对练次数</span>
          <b className="orange">第 {practiceTimes > 0 ? practiceTimes : 1} 次</b>
        </div>
        <div className="pv-scene-col">
          <span>最终得分</span>
          <b className="blue">{score != null ? `${score}分` : "—"}</b>
        </div>
      </div>

      {/* ===== 对话区 ===== */}
      <PracticeChat
        messages={messages}
        chatRef={chatRef}
        sending={sending}
        sendingTime={now()}
        isTextMode={isTextMode}
        aiDisp={aiDisp}
        ttsFailed={ttsFailed}
        ttsPreparing={ttsPreparing}
        aiSpeaking={aiSpeaking}
        speakMsgId={speakMsgId}
        onReplayAi={(message) => {
          stopAiSpeak();
          setTtsFailed((prev) => {
            const next = { ...prev };
            delete next[message.id];
            return next;
          });
          setTtsPreparing(message.id);
          void speakText(message.text, message.id);
        }}
        onToggleAiAudio={(message) => {
          // 同一条消息再次点击：立即停止，并由 stopAiSpeak 补全全文。
          if (aiSpeakingRef.current && aiAudioMsgIdRef.current === message.id) {
            stopAiSpeak();
            return;
          }
          stopAiSpeak();
          setTtsFailed((prev) => {
            const next = { ...prev };
            delete next[message.id];
            return next;
          });
          setTtsPreparing(message.id);
          void speakText(message.text, message.id);
        }}
      />

        {/* ===== 底部输入区 ===== */}
      <div className="pv-composer">
        {isTextMode ? (
          /* 文本形式：灵感提示 + 文本框 */
          <div className="pv-voice-area">
            <button
              className="pv-hint-pill"
              type="button"
              onClick={() => setHintVisible((v) => !v)}
              aria-expanded={hintVisible}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path d="M12 3l9 9-9 9-9-9z" fill="#2563eb" />
              </svg>
              灵感提示
            </button>

            {hintVisible && (
              <div className="pv-hint-card">
                <h4>
                  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                    <path d="M12 3l9 9-9 9-9-9z" fill="#2563eb" />
                  </svg>
                  {hint.title}
                </h4>
                <p>{hint.body}</p>
                <em>根据当前对话上下文生成</em>
              </div>
            )}

            <div className="pv-text-bar">
              <input
                className="pv-text-input"
                placeholder="输入你的回答…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                maxLength={500}
              />
              <button className="pv-text-send" type="button" onClick={handleSend} disabled={sending || !input.trim()}>
                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                  <path d="M3.5 11.8 20.5 3.5l-4.2 17-4.1-6.1-8.7-2.6Z" fill="#fff" stroke="none" />
                  <path d="m12.2 14.4 8.3-10.7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          /* 语音形式：灵感提示 + 录音面板 */
          <div className="pv-voice-area">
            <button
              className="pv-hint-pill"
              type="button"
              onClick={() => setHintVisible((v) => !v)}
              aria-expanded={hintVisible}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path d="M12 3l9 9-9 9-9-9z" fill="#2563eb" />
              </svg>
              灵感提示
            </button>

            {hintVisible && (
              <div className="pv-hint-card">
                <h4>
                  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                    <path d="M12 3l9 9-9 9-9-9z" fill="#2563eb" />
                  </svg>
                  {hint.title}
                </h4>
                <p>{hint.body}</p>
                <em>根据当前对话上下文生成</em>
              </div>
            )}

            {recording ? (
              <div className="pv-listening-panel">
                <div className="pv-listening-top">
                  <b>正在聆听，请说话...</b>
                  <button className="pv-listening-close" type="button" onClick={closeListening} aria-label="关闭聆听">
                    ×
                  </button>
                </div>
                <div className="pv-live-text">{liveText || "请自然表达你的回答，我会实时识别"}</div>
                <div className="pv-wave" aria-hidden="true">
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
                {/* 学员说话（录音）实时进度：已录时长进度条 */}
                <div className="pv-rec-progress" aria-hidden="true">
                  <span className="pv-rec-bar">
                    <i style={{ width: `${Math.min(100, Math.round((recSec / 60) * 100))}%` }}></i>
                  </span>
                  <b>{recSec}s</b>
                </div>
                <button className="pv-send-big" type="button" onClick={submitVoice}>
                  发送
                </button>
              </div>
            ) : (
              <button
                className={`pv-record-btn${aiSpeaking ? " speaking-lock" : ""}`}
                type="button"
                onClick={startRecording}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
                  <path d="M12 17.5V21" />
                </svg>
                {aiSpeaking ? "AI 说话中，请稍候…" : "开始录音"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
