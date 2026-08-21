"use client";

import { useEffect, useRef, useState } from "react";
import { aiApi } from "@/lib/api";

interface VoiceAnswerInputProps {
  disabled?: boolean;
  onSubmit: (text: string) => void | Promise<void>;
  showToast: (message: string) => void;
  autoSubmitAfterSilence?: boolean;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function restorePunctuation(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return "";
  if (/[。！？!?；;，,、…]$/.test(text)) return text;
  return `${text}。`;
}

function createAudioContext(): AudioContext {
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  return new AudioContextCtor();
}

export default function VoiceAnswerInput({ disabled = false, onSubmit, showToast, autoSubmitAfterSilence = false }: VoiceAnswerInputProps) {
  const [recording, setRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [recSec, setRecSec] = useState(0);
  const recordingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSoundRef = useRef(Date.now());
  const submittingRef = useRef(false);
  const liveTextRef = useRef("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (silenceRef.current) clearInterval(silenceRef.current);
    timerRef.current = null;
    silenceRef.current = null;
  };

  const stopRecognition = () => {
    try { recognitionRef.current?.stop?.(); } catch { /* ignore */ }
    recognitionRef.current = null;
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    try { audioContextRef.current?.close(); } catch { /* ignore */ }
    audioContextRef.current = null;
    analyserRef.current = null;
  };

  const reset = () => {
    clearTimers();
    stopRecognition();
    stopStream();
    recorderRef.current = null;
    chunksRef.current = [];
    recordingRef.current = false;
    setRecording(false);
    setRecSec(0);
    liveTextRef.current = "";
    setLiveText("");
  };

  useEffect(() => reset, []);

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    recordingRef.current = false;
    setRecording(false);
    stopRecognition();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    clearTimers();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const chunks = chunksRef.current.filter((chunk) => chunk.size > 0);
    let text = restorePunctuation(liveTextRef.current);
    try {
      if (!text && chunks.length) {
        showToast("语音识别中…");
        const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
        const ctx = audioContextRef.current || createAudioContext();
        audioContextRef.current = ctx;
        const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
        const samples = audio.getChannelData(0);
        const pcm = new Int16Array(Math.max(1, Math.round(samples.length / ((audio.sampleRate || 48000) / 16000))));
        for (let i = 0; i < pcm.length; i += 1) {
          const sample = Math.max(-1, Math.min(1, samples[Math.min(samples.length - 1, Math.floor(i * samples.length / pcm.length))]));
          pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        let binary = "";
        const bytes = new Uint8Array(pcm.buffer);
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        const result = await aiApi.stt(btoa(binary), "pcm");
        text = restorePunctuation(result.text);
      }
      if (text) await onSubmit(text);
      else showToast("未识别到有效语音，请再试一次");
    } catch {
      showToast("语音识别失败，请重试");
    } finally {
      reset();
      submittingRef.current = false;
    }
  };

  const startRecording = async () => {
    if (disabled || recordingRef.current || submittingRef.current) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("unsupported");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      liveTextRef.current = "";
      setLiveText("");
      setRecSec(0);
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data); };
      recorder.start(1000);
      recorderRef.current = recorder;
      recordingRef.current = true;
      setRecording(true);
      timerRef.current = setInterval(() => setRecSec((seconds) => seconds + 1), 1000);
      const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (Recognition) {
        const recognition = new Recognition();
        recognition.lang = "zh-CN";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let text = "";
          for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0].transcript;
          const normalized = normalizeText(text);
          if (normalized) { liveTextRef.current = normalized; setLiveText(normalized); }
        };
        recognition.onend = () => {
          if (recordingRef.current && !submittingRef.current) {
            try { recognition.start(); } catch { /* ignore */ }
          }
        };
        recognitionRef.current = recognition;
        recognition.start();
      }
      const ctx = createAudioContext();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      lastSoundRef.current = Date.now();
      const values = new Uint8Array(analyser.frequencyBinCount);
      silenceRef.current = setInterval(() => {
        analyser.getByteFrequencyData(values);
        const average = values.reduce((sum, value) => sum + value, 0) / values.length / 255;
        if (average > 0.02) lastSoundRef.current = Date.now();
        else if (autoSubmitAfterSilence && liveTextRef.current && Date.now() - lastSoundRef.current > 3500) void submit();
      }, 250);
    } catch {
      reset();
      showToast("无法访问麦克风，请检查浏览器权限");
    }
  };

  const closeListening = () => {
    if (submittingRef.current) return;
    reset();
  };

  return recording ? (
    <div className="pv-listening-panel voice-reference-panel">
      <div className="pv-listening-top voice-reference-head">
        <div><b>语音输入</b><span className="pv-listening-badge">实时转写中</span></div>
        <button className="pv-listening-close" type="button" onClick={closeListening} aria-label="关闭聆听">×</button>
      </div>
      <div className="pv-live-text voice-reference-transcript">{liveText || "请自然表达你的回答，我会实时识别"}</div>
      <div className="pv-wave voice-reference-wave" aria-hidden="true">{Array.from({ length: 31 }).map((_, index) => <i key={index}></i>)}</div>
      <div className="pv-rec-progress" aria-hidden="true"><span className="pv-rec-bar"><i style={{ width: `${Math.min(100, Math.round((recSec / 60) * 100))}%` }} /></span><b>{recSec}s</b></div>
      <button className="pv-send-big voice-reference-end" type="button" onClick={() => void submit()} disabled={disabled}>发送回答</button>
    </div>
  ) : (
    <div className="pv-voice-default">
      <div className="pv-voice-default-label"><span className="pv-voice-default-dot"></span><div><b>语音输入</b><em>点击后实时转写</em></div></div>
      <button className="pv-record-btn voice-start-btn" type="button" onClick={() => void startRecording()} disabled={disabled}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
        开始录音 · 实时转写
      </button>
    </div>
  );
}
