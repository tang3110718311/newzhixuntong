"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aiApi, recordApi } from "@/lib/api";

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
  isVoice?: boolean;
  // 反馈卡结构化数据
  score?: number | null;
  issues?: string[];
  advice?: string[];
}

/**
 * 解析教练提示（兼容两种格式）：
 * 1. 新版两段式（后端 9b287e7 起）："点评｜可以说：建议"，用 ｜ 分隔，点评 ≤12字、建议 20-35字
 * 2. 旧版："点评，可以说：建议"
 * 映射：点评 → 问题定位，建议 → 改进建议
 */
function parseCoachTip(tip: string): { issues: string[]; advice: string[] } {
  const t = (tip || "").trim();
  if (!t) return { issues: [], advice: [] };
  // 新版两段式：按 ｜ 分隔
  const pipeIdx = t.indexOf("｜");
  if (pipeIdx > -1) {
    const issues = [t.slice(0, pipeIdx).replace(/[，,。；;\s|｜]+$/, "").trim()].filter(Boolean);
    const advicePart = t.slice(pipeIdx + 1).replace(/^可以说[:：]?\s*/, "可以说：").trim();
    return { issues, advice: advicePart ? [advicePart] : [] };
  }
  // 旧版：按"可以说"拆分
  const idx = t.indexOf("可以说");
  if (idx > -1) {
    const issues = [t.slice(0, idx).replace(/[，,。；;\s]+$/, "").trim()].filter(Boolean);
    const advicePart = t.slice(idx).replace(/^可以说[:：]?\s*/, "可以说：");
    return { issues, advice: [advicePart] };
  }
  return { issues: [t].filter(Boolean), advice: [] };
}

export default function PracticeView({ scene, task, onBack, showToast, onReport }: PracticeViewProps) {
  const sceneId = scene?.scene?.id;
  // 文本形式：仅文本框+发送；语音形式：仅语音输入区（参考图还原）
  const isTextMode = scene?.scene?.mode === "text";

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [recording, setRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  // 进入本对练页面的次数（需求：对练次数=进入次数，而非对话轮数）
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
  const voiceTextSentRef = useRef(false);
  // 分段实时转写（Web Speech 不可用时的兜底：每 3s 把新增录音分片送后端 STT）
  const liveSttTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sttBusyRef = useRef(false);
  const sttChunkIndexRef = useRef(0);

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
    setSending(true);
    aiApi
      .chat({
        sceneId,
        messages: [{ role: "system", content: "开始" }],
        sessionId: sid,
      })
      .then((res) => {
        pushAiMsgAndSpeak(res.aiReply || "你好，我是" + aiName + "，我们开始吧。");
        setRound(res.round || 0);
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
  useEffect(() => {
    return () => {
      try {
        recogRef.current?.stop();
      } catch { /* ignore */ }
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
      if (liveSttTimerRef.current) clearInterval(liveSttTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const sendText = async (text: string, isVoice = false) => {
    if (!text.trim() || !sceneId) return;
    pushMsg({ who: "user", text: text.trim(), time: now(), isVoice });
    setInput("");
    setSending(true);
    try {
      // 完整对话历史（与 PC 端契约一致：后端依赖客户端每次发送全部消息，用于轮次计数与训练结束评分）
      const history = messages
        .filter((m) => m.who === "user" || m.who === "ai")
        .map((m) => ({ role: m.who === "user" ? "learner" : "ai", content: m.text }));
      const res = await aiApi.chat({
        sceneId,
        messages: [...history, { role: "learner", content: text.trim() }],
        sessionId: sessionId || undefined,
      });
      // 参考图顺序：用户消息 → 反馈卡 → AI 回复
      if (res.coachTip) {
        const { issues, advice } = parseCoachTip(res.coachTip);
        // 反馈卡右上角分数 = 本轮各维度得分之和（后端单轮评分 perTurnScores）
        const turnTotal =
          Array.isArray(res.perTurnScores) && res.perTurnScores.length
            ? res.perTurnScores.reduce((acc: number, s: any) => acc + (Number(s.score) || 0), 0)
            : null;
        pushMsg({ who: "feedback", text: res.coachTip, issues, advice, score: turnTotal });
      }
      if (res.aiReply) pushAiMsgAndSpeak(res.aiReply);
      setRound(res.round || 0);
      if (res.isFinished) {
        // 优先使用同步返回的训练记录得分；异步评分时稍后轮询一次
        if (res.trainingRecord?.score != null) {
          setScore(res.trainingRecord.score);
        } else if (res.recordPending) {
          setTimeout(() => {
            recordApi
              .bySession(sessionId || "")
              .then((rec: any) => {
                if (rec?.score != null) setScore(rec.score);
              })
              .catch(() => { /* 轮询失败不影响主流程 */ });
          }, 2500);
        }
        showToast("对练完成，正在生成报告…");
        setTimeout(() => onReport(sessionId || ""), 700);
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

  const pushAiMsgAndSpeak = useCallback(
    (text: string) => {
      // 防御性剥离模型可能残留的 [COACH_TIP:...]/【COACH_TIP:...】标记（后端已剥离，此处兜底）
      const cleaned = text.replace(/[\[【]\s*COACH_TIP\s*[:：][\s\S]*?[\]】]/g, "").trim();
      pushMsg({ who: "ai", text: cleaned, time: now() });
      speakText(cleaned);
    },
    [pushMsg, speakText]
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
  };

  const startRecording = async () => {
    if (!sceneId || submittingRef.current) return;
    try {
      // 重置上次录音残留的实时识别文字，避免旧缓存显示/静音自动提交误用
      liveTextRef.current = "";
      setLiveText("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      rec.start();
      mediaRecorderRef.current = rec;

      // 分段实时转写兜底：Web Speech 不可用时，每 3s 将新增录音分片送后端 STT，
      // 把识别结果增量显示在聆听面板（边说边显示）。
      sttChunkIndexRef.current = 0;
      sttBusyRef.current = false;
      liveSttTimerRef.current = setInterval(async () => {
        if (sttBusyRef.current || submittingRef.current) return;
        const recNow = mediaRecorderRef.current;
        if (!recNow || recNow.state !== "recording") return;
        const chunks = chunksRef.current;
        if (chunks.length <= sttChunkIndexRef.current) return;
        sttBusyRef.current = true;
        try {
          const newChunks = chunks.slice(sttChunkIndexRef.current);
          sttChunkIndexRef.current = chunks.length;
          const blob = new Blob(newChunks, { type: recNow.mimeType || "audio/webm" });
          const pcmBase64 = await blobToPcmBase64(blob);
          const stt = await aiApi.stt(pcmBase64, "pcm");
          const seg = (stt.text || "").trim();
          if (seg) {
            const prev = liveTextRef.current.trim();
            // 增量拼接：若新识别结果已包含在旧文本尾部则跳过，否则追加
            const next = prev ? (seg.startsWith(prev) ? seg : prev + seg) : seg;
            liveTextRef.current = next;
            setLiveText(next);
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
      showToast("无法访问麦克风，请检查浏览器权限");
    }
  };

  // 供 onend 判断"仍在聆听"的同步引用
  const recordingRef = useRef(false);
  recordingRef.current = recording;

  /** 发送语音：有实时识别文本直接发送，否则等待 STT 回退 */
  const submitVoice = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setRecording(false);
    stopLiveRecognition();
    const live = liveTextRef.current.trim();
    if (live) {
      voiceTextSentRef.current = true;
      stopRecorderAndStream();
      sendText(live, true);
    } else {
      stopRecorderAndStream(); // onstop 中走 STT
    }
    // 发送/提交后清空实时识别文字缓存，避免下一次录音残留
    setLiveText("");
    liveTextRef.current = "";
    // 允许再次开始录音
    setTimeout(() => {
      submittingRef.current = false;
    }, 300);
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

  const hint = (() => {
    if (round === 0) return { title: "开场回答方向", body: `先礼貌问候并说明来意，再结合“${sceneName}”询问对方当前最关注的问题。` };
    if (round === 1) return { title: "需求推进方向", body: "先复述并确认对方需求，再分步骤说明方案，最后明确下一步行动和时间。" };
    return { title: "收尾回答方向", body: "总结已经确认的信息，回应对方最后的顾虑，并自然提出后续跟进或复盘安排。" };
  })();

  return (
    <div className="pv-shell">
      {/* ===== 顶部导航（淡天蓝渐变） ===== */}
      <header className="pv-nav">
        <button className="pv-nav-back" type="button" onClick={onBack} aria-label="返回场景工作台">
          ‹
        </button>
        <div className="pv-nav-title">
          <h1>AI对练</h1>
          <span className="pv-live-badge">
            <i></i>进行中
          </span>
        </div>
        <span className="pv-nav-spacer"></span>
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
          <span>本轮得分</span>
          <b className="blue">{score != null ? `${score}分` : "—"}</b>
        </div>
      </div>

      {/* ===== 对话区 ===== */}
      <div className="pv-chat" ref={chatRef}>
        {messages.map((m) => {
          if (m.who === "feedback") {
            return (
              <div className="pv-msg feedback" key={m.id}>
                <div className="pv-feedback-card">
                  <div className="pv-feedback-head">
                    <b>实时点评</b>
                    <span>{m.score != null ? `${m.score}分` : "—"}</span>
                  </div>
                  {m.issues && m.issues.length > 0 && (
                    <div className="pv-feedback-sec">
                      <span>问题定位</span>
                      <p>{m.issues.join("；")}</p>
                    </div>
                  )}
                  {m.advice && m.advice.length > 0 && (
                    <>
                      <div className="pv-feedback-divider"></div>
                      <div className="pv-feedback-sec green">
                        <span>改进建议</span>
                        <p>{m.advice.join("；")}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          }
          return (
            <div className={`pv-msg ${m.who}`} key={m.id}>
              {m.who === "ai" ? (
                <span className="pv-avatar ai" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="1.7">
                    <rect x="4.5" y="7" width="15" height="11" rx="3.2" />
                    <circle cx="9.2" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                    <circle cx="14.8" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                    <path d="M12 4.5v2.5" />
                    <circle cx="12" cy="3.6" r="1.1" fill="#fff" stroke="none" />
                    <path d="M7 16.6h.01M11.5 16.6h.01M16 16.6h.01" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
              ) : (
                <span className="pv-avatar user" aria-hidden="true"></span>
              )}
              <div className="pv-msg-main">
                <span className="pv-time">{m.time}</span>
                <div className="pv-bubble">
                  {m.who === "user" && m.isVoice && (
                    <span className="pv-voice-wave" aria-hidden="true">
                      <i></i>
                      <i></i>
                      <i></i>
                      <i></i>
                    </span>
                  )}
                  {m.text}
                </div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="pv-msg ai">
            <span className="pv-avatar ai" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="1.7">
                <rect x="4.5" y="7" width="15" height="11" rx="3.2" />
                <circle cx="9.2" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                <circle cx="14.8" cy="12.2" r="1.2" fill="#fff" stroke="none" />
                <path d="M12 4.5v2.5" />
                <circle cx="12" cy="3.6" r="1.1" fill="#fff" stroke="none" />
              </svg>
            </span>
            <div className="pv-msg-main">
              <span className="pv-time">{now()}</span>
              <div className="pv-bubble">正在思考…</div>
            </div>
          </div>
        )}
      </div>

      {/* ===== 底部输入区 ===== */}
      <div className="pv-composer">
        {isTextMode ? (
          /* 文本形式：仅文本框 + 发送 */
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
                <button className="pv-send-big" type="button" onClick={submitVoice}>
                  发送
                </button>
              </div>
            ) : (
              <button className="pv-record-btn" type="button" onClick={startRecording}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
                  <path d="M12 17.5V21" />
                </svg>
                开始录音
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
