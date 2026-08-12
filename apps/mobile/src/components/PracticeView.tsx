"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aiApi } from "@/lib/api";

interface PracticeViewProps {
  scene: any;
  task: any;
  onBack: () => void;
  showToast: (msg: string) => void;
  onReport: (sessionId: string) => void;
}

interface ChatMsg {
  id: string;
  who: "ai" | "user" | "feedback";
  text: string;
  time?: string;
  score?: number;
  issues?: string[];
  advice?: string[];
  isVoice?: boolean;
}

export default function PracticeView({ scene, task, onBack, showToast, onReport }: PracticeViewProps) {
  const sceneId = scene?.scene?.id;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [recording, setRecording] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const msgSeq = useRef(0);
  const startedRef = useRef(false);

  const sceneName = scene?.scene?.name || "场景对练";
  const aiRole = scene?.roles?.find((r: any) => r.roleType === "ai");
  const aiName = aiRole?.identity || "AI 教练";

  const pushMsg = useCallback((m: Omit<ChatMsg, "id">) => {
    msgSeq.current += 1;
    setMessages((prev) => [...prev, { ...m, id: `m${Date.now()}-${msgSeq.current}-${Math.random().toString(36).slice(2, 6)}` }]);
  }, []);

  // 开场白（StrictMode 下避免重复发送）
  useEffect(() => {
    if (!sceneId || startedRef.current) return;
    startedRef.current = true;
    const sid = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSessionId(sid);
    // 发送开场消息
    setSending(true);
    aiApi
      .chat({
        sceneId,
        messages: [{ role: "system", content: "开始" }],
        sessionId: sid,
      })
      .then((res) => {
        pushAiMsgAndSpeak(res.aiReply || "你好，我是" + aiName + "，我们开始吧。");
        if (res.coachTip) pushMsg({ who: "feedback", text: res.coachTip });
        setRound(res.round || 0);
      })
      .catch(() => pushMsg({ who: "ai", text: "（AI 对练服务暂时不可用，请稍后重试）" }))
      .finally(() => setSending(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const sendText = async (text: string) => {
    if (!text.trim() || !sceneId) return;
    pushMsg({ who: "user", text: text.trim(), time: now() });
    setInput("");
    setSending(true);
    try {
      const res = await aiApi.chat({
        sceneId,
        messages: [{ role: "learner", content: text.trim() }],
        sessionId: sessionId || undefined,
      });
      if (res.aiReply) pushAiMsgAndSpeak(res.aiReply);
      if (res.coachTip) pushMsg({ who: "feedback", text: res.coachTip });
      setRound(res.round || 0);
      if (res.isFinished) {
        setScore(res.round || 0);
        showToast("训练结束，正在生成报告…");
        setTimeout(() => onReport(sessionId || ""), 600);
      }
    } catch (e: any) {
      pushMsg({ who: "ai", text: "（回复失败：" + (e.message || "网络错误") + "）" });
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    if (sending) return;
    sendText(input);
  };

  // ===== 语音录音（webm → 16kHz/16bit PCM → STT）=====
  const audioCtxRef = useRef<AudioContext | null>(null);

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
    // 取左声道
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
    // Int16Array → base64
    const bytes = new Uint8Array(pcm.buffer);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  };

  /** TTS 播放 AI 回复 */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakText = useCallback(async (text: string) => {
    try {
      const tts = await aiApi.tts(text);
      if (!tts?.audioBase64) return;
      const bin = atob(tts.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: tts.format === "wav" ? "audio/wav" : "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play();
    } catch {
      /* TTS 播放失败不阻断主流程 */
    }
  }, []);

  // AI 回复后自动播放语音
  const pushAiMsgAndSpeak = useCallback(
    (text: string) => {
      pushMsg({ who: "ai", text, time: now() });
      speakText(text);
    },
    [pushMsg, speakText]
  );

  const startRecording = async () => {
    if (!sceneId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        try {
          showToast("语音识别中…");
          const pcmBase64 = await blobToPcmBase64(blob);
          const stt = await aiApi.stt(pcmBase64, "pcm");
          if (stt.text) {
            await sendText(stt.text);
          } else {
            showToast("未识别到有效语音");
          }
        } catch {
          showToast("语音转写失败");
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setRecording(true);
    } catch {
      showToast("无法访问麦克风，请检查浏览器权限");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const hint = (() => {
    if (round === 0) return { title: "开场回答方向", body: `先礼貌问候并说明来意，再结合“${sceneName}”询问对方当前最关注的问题。` };
    if (round === 1) return { title: "需求推进方向", body: "先复述并确认对方需求，再分步骤说明方案，最后明确下一步行动和时间。" };
    return { title: "收尾回答方向", body: "总结已经确认的信息，回应对方最后的顾虑，并自然提出后续跟进或复盘安排。" };
  })();

  return (
    <>
      <div className="task-detail-head">
        <button className="task-detail-back" type="button" onClick={onBack} aria-label="返回场景工作台">
          ‹
        </button>
        <div className="task-detail-title">
          <h1>AI 对练</h1>
          <p>
            {sceneName} · 第 {round} 轮
          </p>
        </div>
        <button className="task-detail-more" type="button" onClick={() => setHintVisible((v) => !v)} aria-label="灵感提示">
          ?
        </button>
      </div>

      {hintVisible && (
        <div className="scene-work-card" style={{ marginBottom: 10 }}>
          <h3>💡 {hint.title}</h3>
          <p className="card-sub">{hint.body}</p>
        </div>
      )}

      <div className="chat-container" ref={chatRef}>
        {messages.map((m) => (
          <div key={m.id} className={`chat-row ${m.who === "user" ? "user" : ""}`}>
            {m.who === "ai" && <span className="chat-mini-avatar ai-chat-avatar">AI</span>}
            {m.who === "user" && <span className="chat-mini-avatar user-chat-avatar" />}
            <div className="chat-message-wrap">
              <span className="chat-time">{m.time}</span>
              {m.who === "feedback" ? (
                <div className="practice-feedback">
                  <div className="feedback-head">
                    <b>教练提示</b>
                  </div>
                  <div className="feedback-advice">{m.text}</div>
                </div>
              ) : (
                <div className={`chat-bubble ${m.isVoice ? "voice-bubble" : ""}`}>
                  {m.text}
                  {m.who === "ai" && !m.text.startsWith("（") && (
                    <button
                      className="chat-speak-btn"
                      type="button"
                      aria-label="播放语音"
                      onClick={() => speakText(m.text)}
                    >
                      🔊
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="chat-row">
            <span className="chat-mini-avatar ai-chat-avatar">AI</span>
            <div className="chat-message-wrap">
              <div className="chat-bubble">正在思考…</div>
            </div>
          </div>
        )}
      </div>

      <div className="practice-input-bar">
        {recording ? (
          <button className="practice-record-btn recording" type="button" onClick={stopRecording}>
            ■ 停止录音
          </button>
        ) : (
          <button
            className="practice-record-btn"
            type="button"
            onClick={startRecording}
            title="语音输入"
          >
            🎤
          </button>
        )}
        <input
          className="practice-text-input"
          placeholder="输入你的回答…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <button className="practice-send-btn" type="button" onClick={handleSend} disabled={sending}>
          发送
        </button>
      </div>
    </>
  );
}
