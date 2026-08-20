"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { getFullTextFallback } from "@/lib/speech-sync";
import { type AiTurnScore } from "@/lib/api";

export interface PracticeChatMsg {
  id: string;
  who: "ai" | "user" | "feedback";
  text: string;
  time?: string;
  isVoice?: boolean;
  voiceAudioUrl?: string;
  score?: number | null;
  dimensions?: AiTurnScore[];
  issues?: string[];
  advice?: string[];
  feedbackMessage?: string;
}

interface PracticeChatProps {
  messages: PracticeChatMsg[];
  chatRef?: RefObject<HTMLDivElement | null>;
  sending?: boolean;
  sendingTime?: string;
  isTextMode?: boolean;
  aiDisp?: Record<string, number>;
  ttsFailed?: Record<string, boolean>;
  ttsPreparing?: string | null;
  aiSpeaking?: boolean;
  speakMsgId?: string | null;
  onReplayAi?: (message: PracticeChatMsg) => void;
  onToggleAiAudio?: (message: PracticeChatMsg) => void;
  reportMode?: boolean;
}

function AiAvatar({ reportMode = false }: { reportMode?: boolean }) {
  return (
    <span className={`pv-avatar ai${reportMode ? " report" : ""}`} aria-hidden="true">
      {reportMode ? (
        <img src={`${process.env.NEXT_PUBLIC_APP_BASE_PATH || ""}/cute-3d-training-robot.png`} alt="" />
      ) : (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="1.7">
          <rect x="4.5" y="7" width="15" height="11" rx="3.2" />
          <circle cx="9.2" cy="12.2" r="1.2" fill="#fff" stroke="none" />
          <circle cx="14.8" cy="12.2" r="1.2" fill="#fff" stroke="none" />
          <path d="M12 4.5v2.5" />
          <circle cx="12" cy="3.6" r="1.1" fill="#fff" stroke="none" />
          <path d="M7 16.6h.01M11.5 16.6h.01M16 16.6h.01" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

function PracticeFeedbackCard({ message }: { message: PracticeChatMsg }) {
  const [collapsed, setCollapsed] = useState(true);
  const hasDetail =
    (message.dimensions && message.dimensions.length > 0) ||
    message.feedbackMessage ||
    (message.issues && message.issues.length > 0) ||
    (message.advice && message.advice.length > 0);

  return (
    <div className={`pv-feedback-card ${collapsed ? "collapsed" : "expanded"}`}>
      <div
        className="pv-feedback-head pv-feedback-toggle"
        onClick={hasDetail ? () => setCollapsed((v) => !v) : undefined}
        style={hasDetail ? { cursor: "pointer" } : undefined}
      >
        <b>实时点评.本次回复综合分</b>
        <span style={{ gap: "6px", alignItems: "center" }}>
          {message.score != null ? <><strong>{message.score}</strong>分</> : "—"}
          {hasDetail && (
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`pv-feedback-chevron${collapsed ? "" : " open"}`}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </span>
      </div>
      {!collapsed && (
        <>
          {message.dimensions && message.dimensions.length > 0 && (
            <div className="pv-feedback-dimensions" aria-label="本轮评分维度">
              {message.dimensions.map((dimension, index) => (
                <span className={`pv-feedback-dimension ${dimension.level}`} key={`${dimension.name}-${index}`}>
                  <em>{dimension.name}</em>
                  <b>{dimension.score}/{dimension.maxScore}</b>
                </span>
              ))}
            </div>
          )}
          {message.feedbackMessage && <p className="pv-feedback-empty">{message.feedbackMessage}</p>}
          {message.issues && message.issues.length > 0 && (
            <div className="pv-feedback-sec">
              <span>问题定位</span>
              <p>{message.issues.join("；")}</p>
            </div>
          )}
          {message.advice && message.advice.length > 0 && (
            <>
              <div className="pv-feedback-divider"></div>
              <div className="pv-feedback-sec green">
                <span>改进建议</span>
                <p>{message.advice.join("；")}</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function PracticeChat({
  messages,
  chatRef,
  sending = false,
  sendingTime = "",
  isTextMode = true,
  aiDisp = {},
  ttsFailed = {},
  ttsPreparing = null,
  aiSpeaking = false,
  speakMsgId = null,
  onReplayAi,
  onToggleAiAudio,
  reportMode = false,
}: PracticeChatProps) {
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUserVoiceId, setPlayingUserVoiceId] = useState<string | null>(null);

  const stopUserVoice = () => {
    if (userAudioRef.current) {
      try { userAudioRef.current.pause(); } catch { /* ignore */ }
      userAudioRef.current = null;
    }
    setPlayingUserVoiceId(null);
  };

  useEffect(() => stopUserVoice, []);

  const toggleUserVoice = (message: PracticeChatMsg) => {
    if (!message.voiceAudioUrl) return;
    if (playingUserVoiceId === message.id) {
      stopUserVoice();
      return;
    }
    stopUserVoice();
    const audio = new Audio(message.voiceAudioUrl);
    userAudioRef.current = audio;
    setPlayingUserVoiceId(message.id);
    const clear = () => {
      if (userAudioRef.current === audio) userAudioRef.current = null;
      setPlayingUserVoiceId(null);
    };
    audio.addEventListener("ended", clear, { once: true });
    audio.addEventListener("error", clear, { once: true });
    audio.play().catch(clear);
  };

  const soundIcon = (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a8.5 8.5 0 0 1 0 13" />
    </svg>
  );

  return (
    <div className={`pv-chat${reportMode ? " report-mode" : ""}`} ref={chatRef}>
      {messages.map((message) => {
        if (message.who === "feedback") {
          return (
            <div className="pv-msg feedback" key={message.id}>
              <PracticeFeedbackCard message={message} />
            </div>
          );
        }
        return (
          <div className={`pv-msg ${message.who}`} key={message.id}>
            {message.who === "ai" ? <AiAvatar reportMode={reportMode} /> : <span className="pv-avatar user" aria-hidden="true"></span>}
            <div className="pv-msg-main">
              <span className="pv-time">{message.time}</span>
              <div className="pv-bubble">
                {message.who === "ai" ? (
                  <>
                    {!isTextMode && onToggleAiAudio && (
                      <button
                        className={`pv-ai-sound-icon${aiSpeaking && speakMsgId === message.id ? " playing" : ""}`}
                        type="button"
                        aria-label={aiSpeaking && speakMsgId === message.id ? "停止播放 AI 语音" : "播放 AI 语音"}
                        onClick={() => onToggleAiAudio(message)}
                      >
                        {soundIcon}
                      </button>
                    )}
                    <span className="pv-ai-message-text">
                      {aiDisp[message.id] != null && !ttsFailed[message.id]
                        ? message.text.slice(0, aiDisp[message.id])
                        : getFullTextFallback(message.text)}
                    </span>
                  </>
                ) : (
                  <>
                    {message.isVoice && (
                      <button
                        className={`pv-voice-wave${playingUserVoiceId === message.id ? " playing" : ""}`}
                        type="button"
                        aria-label={playingUserVoiceId === message.id ? "停止播放学员语音" : "播放学员语音"}
                        onClick={() => toggleUserVoice(message)}
                        disabled={!message.voiceAudioUrl}
                      >
                        {soundIcon}
                      </button>
                    )}
                    <span className="pv-user-message-text">{message.text}</span>
                  </>
                )}
              </div>
              {message.who === "ai" && !(aiSpeaking && speakMsgId === message.id) && ttsPreparing === message.id && (
                <div className="pv-ai-preparing" aria-hidden="true">
                  <b>语音准备中…</b>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {sending && (
        <div className="pv-msg ai">
          <AiAvatar reportMode={reportMode} />
          <div className="pv-msg-main">
            <span className="pv-time">{sendingTime}</span>
            <div className="pv-bubble">正在思考…</div>
          </div>
        </div>
      )}
    </div>
  );
}
