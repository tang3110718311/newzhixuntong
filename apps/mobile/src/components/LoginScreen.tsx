"use client";

import { useEffect, useRef, useState } from "react";
import { authApi, type CaptchaChallenge } from "@/lib/api";
import type { MobileModalKey } from "@/lib/mobileRoutes";
import MobilePageAction from "./MobilePageAction";

interface LoginScreenProps {
  onLoginSuccess: (mobile: string, password: string, captchaToken: string) => Promise<any>;
  showToast: (msg: string) => void;
  modal: MobileModalKey | null;
  onOpenModal: (modal: MobileModalKey) => void;
  onCloseModal: () => void;
}

function safeCaptchaImageUrl(value?: string): string | null {
  const image = (value || "").trim();
  if (/^data:image\/(?:jpeg|png|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(image)) return image;
  if (image.startsWith("/") && !image.startsWith("//") && !/[\s"'()\\]/.test(image)) return image;
  return null;
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 12.2a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}

function PasswordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5.5" y="10" width="13" height="9.5" rx="2.2" />
      <path d="M8.5 10V7.6a3.5 3.5 0 0 1 7 0V10" />
      <path d="M12 14.1v2.1" />
    </svg>
  );
}

export default function LoginScreen({ onLoginSuccess, showToast, modal, onOpenModal, onCloseModal }: LoginScreenProps) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const showCaptcha = modal === "captcha";

  const valid = phone.length === 11 && password.length >= 6;

  const doLogin = async () => {
    if (!valid) {
      setError("请输入正确的手机号和密码（密码至少 6 位）");
      return;
    }
    setError("");
    onOpenModal("captcha");
  };

  const handleCaptchaPass = async (captchaToken: string) => {
    onCloseModal();
    setLoading(true);
    try {
      await onLoginSuccess(phone, password, captchaToken);
    } catch (e: any) {
      setError(e.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="login-screen sms-login">
        <div className="login-box">
          <div className="sms-topbar">
            <button className="sms-back" type="button" onClick={() => showToast("已是当前版本")}>
              ‹
            </button>
          </div>
          <div className="sms-login-content">
            <h1 className="login-logo-title">
              <span className="brand-mark"></span>
              <span>智训通</span>
            </h1>
            <div className="sms-field phone-field">
              <span className="login-field-icon account-icon" aria-hidden="true">
                <AccountIcon />
              </span>
              <input
                inputMode="numeric"
                maxLength={11}
                autoComplete="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="sms-field code-field password-field">
              <span className="login-field-icon password-icon" aria-hidden="true">
                <PasswordIcon />
              </span>
              <input
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className={`password-toggle ${showPwd ? "visible" : ""}`}
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label="显示密码"
              >
                <span className="eye-shape"></span>
              </button>
            </div>
            <div className="login-error">{error}</div>
            <button
              className={`sms-login-btn ${valid ? "enabled" : ""}`}
              type="button"
              onClick={doLogin}
              disabled={loading}
            >
              {loading ? "登录中…" : "登录"}
            </button>
            <label className="agreement-check">
              <input type="checkbox" defaultChecked />
              <span>
                登录即代表同意
                <button
                  type="button"
                  className="agreement-link"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showToast("用户协议");
                  }}
                >
                  《用户协议》
                </button>
                和
                <button
                  type="button"
                  className="agreement-link"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showToast("隐私协议");
                  }}
                >
                  《隐私协议》
                </button>
              </span>
            </label>
          </div>
        </div>
      </section>
      {showCaptcha && (
        <CaptchaModal
          onClose={onCloseModal}
          onPass={handleCaptchaPass}
        />
      )}
    </>
  );
}

function CaptchaModal({ onClose, onPass }: { onClose: () => void; onPass: (captchaToken: string) => void }) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [pos, setPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const startX = useRef(0);
  const lastPos = useRef(0);

  async function loadChallenge() {
    setLoading(true);
    setError("");
    setDone(false);
    setPos(0);
    lastPos.current = 0;
    try {
      const next = await authApi.captcha();
      setChallenge(next);
    } catch (e: any) {
      setError(e.message || "图形验证码加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChallenge();
  }, []);

  const handleDown = (e: React.PointerEvent) => {
    if (done || loading || !challenge) return;
    startX.current = e.clientX - lastPos.current;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!dragging || done || !challenge) return;
    const nextPos = Math.max(0, Math.min(e.clientX - startX.current, challenge.trackMax));
    lastPos.current = nextPos;
    setPos(nextPos);
  };

  const handleUp = async () => {
    if (!dragging || done || !challenge) return;
    setDragging(false);
    const finalPos = Math.round(lastPos.current);

    setLoading(true);
    try {
      const result = await authApi.verifyCaptcha(challenge.captchaId, finalPos);
      setDone(true);
      setError("");
      window.setTimeout(() => onPass(result.captchaToken), 350);
    } catch (e: any) {
      const message = e.message || "图形验证码校验失败";
      await loadChallenge();
      setError(message);
    } finally {
      setLoading(false);
    }
  };
  const captchaBackgroundImage = safeCaptchaImageUrl(challenge?.backgroundImage);


  return (
    <div className="captcha-modal show" role="dialog" aria-modal="true" aria-label="拖动图形验证码">
      <div className="captcha-panel">
        <div className="captcha-panel-head">
          <h3>安全验证</h3>
          <MobilePageAction kind="close" variant="overlay" onClick={onClose} />
        </div>
        <p className="captcha-panel-sub">请拖动滑块，将拼图放入缺口</p>
        <div className="captcha-box">
          <div className="captcha-title">
            <span>{done ? "验证通过" : loading ? "加载中…" : "拖动完成验证"}</span>
            <button className="captcha-refresh" type="button" onClick={() => void loadChallenge()} disabled={loading}>
              刷新
            </button>
          </div>
          <div
            className="captcha-image"
            id="captchaImage"
            style={
              captchaBackgroundImage
                ? {
                    backgroundImage: `url("${captchaBackgroundImage}")`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }
                : undefined
            }
          >
            <div className="captcha-piece" style={{ left: `${12 + pos}px` }} />
          </div>
          <div className={`captcha-track ${done ? "done" : ""}`}>
            <span id="captchaHint">{done ? "✓ 验证通过" : error || "拖动滑块完成拼图"}</span>
            <div
              className="captcha-handle"
              id="captchaHandle"
              style={{ left: `${pos}px` }}
              onPointerDown={handleDown}
              onPointerMove={handleMove}
              onPointerUp={handleUp}
              onPointerCancel={handleUp}
              aria-label="拖动滑块"
            >
              ›
            </div>
          </div>
        </div>
        <p className="captcha-modal-tip">
          {done ? "验证通过，正在登录…" : "验证通过后将自动登录"}
        </p>
      </div>
    </div>
  );
}
