"use client";

import { useRef, useState } from "react";
import { authApi } from "@/lib/api";

interface LoginScreenProps {
  onLoginSuccess: (mobile: string, password: string, code: string) => Promise<any>;
  showToast: (msg: string) => void;
}

export default function LoginScreen({ onLoginSuccess, showToast }: LoginScreenProps) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);

  const valid = phone.length === 11 && password.length >= 6;

  const doLogin = async () => {
    if (!valid) {
      setError("请输入正确的手机号和密码（密码至少 6 位）");
      return;
    }
    setError("");
    setShowCaptcha(true);
  };

  const handleCaptchaPass = async () => {
    setShowCaptcha(false);
    setLoading(true);
    try {
      await onLoginSuccess(phone, password, "666666");
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
                <a href="javascript:void(0)" onClick={() => showToast("用户协议")}>
                  《用户协议》
                </a>
                和
                <a href="javascript:void(0)" onClick={() => showToast("隐私协议")}>
                  《隐私协议》
                </a>
              </span>
            </label>
          </div>
        </div>
      </section>
      {showCaptcha && (
        <CaptchaModal
          onClose={() => setShowCaptcha(false)}
          onPass={handleCaptchaPass}
        />
      )}
    </>
  );
}

// ===== 滑块验证码 =====
function CaptchaModal({ onClose, onPass }: { onClose: () => void; onPass: () => void }) {
  const [pos, setPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const TARGET = 236; // 目标缺口位置
  const TOLERANCE = 12;

  const handleDown = (e: React.PointerEvent) => {
    if (done) return;
    startX.current = e.clientX;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!dragging || done) return;
    const dx = e.clientX - startX.current;
    setPos(Math.max(0, Math.min(dx, 260)));
  };

  const handleUp = () => {
    if (!dragging || done) return;
    setDragging(false);
    if (Math.abs(pos - TARGET) <= TOLERANCE) {
      setDone(true);
      setTimeout(onPass, 350);
    } else {
      setPos(0);
    }
  };

  return (
    <div className="captcha-modal show" role="dialog" aria-modal="true" aria-label="拖动验证码">
      <div className="captcha-panel">
        <div className="captcha-panel-head">
          <h3>安全验证</h3>
          <button className="captcha-close" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <p className="captcha-panel-sub">请拖动滑块，将拼图放入缺口</p>
        <div className="captcha-box">
          <div className="captcha-title">
            <span>{done ? "验证通过" : "拖动完成验证"}</span>
            <button className="captcha-refresh" type="button" onClick={() => setPos(0)}>
              刷新
            </button>
          </div>
          <div className="captcha-image" id="captchaImage">
            <div className="captcha-piece" style={{ left: `${12 + pos}px` }} />
            <div className="captcha-target" />
          </div>
          <div className={`captcha-track ${done ? "done" : ""}`} ref={trackRef}>
            <span id="captchaHint">{done ? "✓ 验证通过" : "拖动滑块完成拼图"}</span>
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
