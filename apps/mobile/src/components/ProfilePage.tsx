"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { taskApi, recordApi, type AuthUser } from "@/lib/api";
import type { PageKey } from "./MobileApp";

const IMAGE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i;

function isAllowedImageDataUrl(value: string) {
  return IMAGE_DATA_URL_PATTERN.test(value);
}

function readStoredAvatar(): string | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem("zxtProfileAvatar");
  if (!data) return null;
  if (isAllowedImageDataUrl(data)) return data;
  localStorage.removeItem("zxtProfileAvatar");
  return null;
}

function validateImageFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type) || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return "请选择 JPG、PNG 或 WebP 图片";
  }
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
    return "图片不能超过 2MB";
  }
  return null;
}

interface ProfilePageProps {
  user: AuthUser | null;
  onNavigate: (p: PageKey) => void;
  onLogout: () => void;
  showToast: (msg: string) => void;
}

export default function ProfilePage({ user, onNavigate, onLogout, showToast }: ProfilePageProps) {
  const [view, setView] = useState<"main" | "avatar">("main");
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskDone, setTaskDone] = useState(0);
  const [learnHours, setLearnHours] = useState(0);
  const [notify, setNotify] = useState(true);
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 账号信息弹窗状态
  const [accountOpen, setAccountOpen] = useState(false);

  // 问题反馈弹窗状态
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackImages, setFeedbackImages] = useState<{ name: string; data: string }[]>([]);
  const feedbackFileRef = useRef<HTMLInputElement>(null);
  const [appRoot, setAppRoot] = useState<HTMLElement | null>(null);

  // 弹窗挂载到 .app 根（对齐原型：modal-mask 在 content/tabbar 之后，避免被 tabbar 的 stacking context 遮挡）
  useEffect(() => {
    setAppRoot(document.getElementById("mainApp") || document.body);
  }, []);

  useEffect(() => {
    Promise.all([taskApi.list({ pageSize: 100 }), recordApi.list({ pageSize: 100 })])
      .then(([td, rd]) => {
        const items = (td as any).items || [];
        setTaskTotal(items.length);
        setTaskDone(items.filter((t: any) => t.status === "completed").length);
        const doneRecords = ((rd as any).items || []).filter(
          (r: any) => r.status === "completed" && r.score != null
        ).length;
        setLearnHours(18.5 + doneRecords * 0.25);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  // 头像仅作为本机展示态，不作为服务端身份凭据。
  useEffect(() => {
    if (view === "avatar") setAvatar(readStoredAvatar());
  }, [view]);

  const percent = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0;
  const learnPercent = Math.min(100, Math.round(learnHours * 3.7));
  const roleText =
    user?.roleCode === "tenant_admin"
      ? "培训管理员"
      : user?.roleCode === "trainer"
      ? "内训师"
      : "学员";

  // 账号信息展示（登录账号优先邮箱，手机号中间四位脱敏）
  const loginAccount = user?.email || user?.mobile || "—";
  const maskMobile = (m: string | null | undefined) =>
    m && m.length >= 7 ? `${m.slice(0, 3)}****${m.slice(-4)}` : m || "—";

  const handleAvatarFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const error = validateImageFile(file);
      if (error) {
        showToast(error);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result);
        if (!isAllowedImageDataUrl(data)) {
          showToast("图片格式不受支持");
          return;
        }
        try {
          localStorage.setItem("zxtProfileAvatar", data);
        } catch {
          showToast("图片过大，请换一张小图");
          return;
        }
        setAvatar(data);
        showToast("头像已更新");
      };
      reader.readAsDataURL(file);
    },
    [showToast]
  );

  const handleFeedbackImages = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = [...(e.target.files || [])];
      e.target.value = "";
      const remaining = 3 - feedbackImages.length;
      if (remaining <= 0) {
        showToast("最多上传 3 张图片");
        return;
      }

      const files: File[] = [];
      let invalidCount = 0;
      for (const file of selected) {
        const error = validateImageFile(file);
        if (error) {
          invalidCount += 1;
          continue;
        }
        if (files.length < remaining) files.push(file);
      }
      if (invalidCount > 0) showToast("已忽略非 JPG/PNG/WebP 或超过 2MB 的图片");
      if (files.length === 0) return;
      const pending: { name: string; data: string }[] = [];
      let loaded = 0;
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          pending.push({ name: file.name, data: String(reader.result) });
          loaded += 1;
          if (loaded === files.length) {
            setFeedbackImages((prev) => [...prev, ...pending].slice(0, 3));
          }
        };
        reader.readAsDataURL(file);
      });
      if (selected.length > remaining) {
        showToast("最多上传 3 张图片");
      }
    },
    [feedbackImages.length, showToast]
  );

  const removeFeedbackImage = useCallback((idx: number) => {
    setFeedbackImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const submitFeedback = useCallback(() => {
    if (!feedbackTitle.trim() || !feedbackContent.trim()) {
      showToast("请填写反馈标题和内容");
      return;
    }
    setFeedbackOpen(false);
    showToast(
      feedbackImages.length ? `反馈已提交，附带 ${feedbackImages.length} 张图片` : "感谢反馈，我们会尽快处理"
    );
    setFeedbackTitle("");
    setFeedbackContent("");
    setFeedbackImages([]);
  }, [feedbackTitle, feedbackContent, feedbackImages.length, showToast]);

  if (view === "avatar") {
    return (
      <>
        <div className="avatar-page-head">
          <button className="avatar-back" onClick={() => setView("main")} aria-label="返回个人中心">
            ‹
          </button>
          <div>
            <h1>更换头像</h1>
            <p>选择一张图片作为你的个人头像</p>
          </div>
        </div>
        <div className="avatar-picker-card">
          <div className="avatar-preview-wrap">
            <div className="avatar avatar-large" aria-label="头像预览">
              {avatar ? <img src={avatar} alt="头像预览" /> : <span className="default-avatar" />}
            </div>
            <span className="avatar-preview-label">头像预览</span>
          </div>
          <div className="avatar-picker-copy">
            <h2>上传头像图片</h2>
            <p>支持 JPG、PNG 等常见图片格式，建议使用清晰的正方形图片。</p>
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_ACCEPT}
              hidden
              onChange={handleAvatarFile}
            />
            <button
              className="primary avatar-upload-btn"
              onClick={() => fileRef.current?.click()}
            >
              选择头像图片
            </button>
          </div>
        </div>
        <div className="avatar-page-tip">
          <span>✓</span>
          <div>
            <b>头像已安全保存</b>
            <p>选择完成后会同步更新到个人中心。</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mobile-head">
        <div>
          <h1>个人中心</h1>
          <p>管理账号、企业和学习偏好</p>
        </div>
      </div>
      <div className="profile-card">
        <button
          className="avatar avatar-button"
          onClick={() => setView("avatar")}
          aria-label="更换头像"
        >
          {avatar ? <img src={avatar} alt="头像" /> : <span className="default-avatar" />}
        </button>
        <div className="profile-text">
          <h2>{user?.name || "同学"}</h2>
          <p>
            {roleText}　·　员工编号 {user?.id?.slice(0, 8) || "ZXT-0000"}
          </p>
        </div>
        <button className="change-avatar-btn" onClick={() => setView("avatar")}>
          更换头像
        </button>
      </div>
      <div className="profile-detail">
        <div className="detail-row">
          <span>登录账号</span>
          <span>{user?.mobile || "—"}</span>
        </div>
        <div className="detail-row">
          <span>所属部门</span>
          <span>{user?.orgName || "未分配部门"}</span>
        </div>
        <div className="detail-row">
          <span>当前企业</span>
          <span>{user?.tenantName || "—"}</span>
        </div>
      </div>
      <div className="ability-preview">
        <div className="section-title">
          <h2>本月学习概览</h2>
          <a onClick={() => onNavigate("ability")}>查看综合能力 ›</a>
        </div>
        <div className="ability-line">
          <label>完成任务</label>
          <div>
            <span style={{ width: `${percent}%` }} />
          </div>
          <b>
            {taskDone}/{taskTotal}
          </b>
        </div>
        <div className="ability-line">
          <label>学习时长</label>
          <div>
            <span style={{ width: `${learnPercent}%` }} />
          </div>
          <b>{learnHours ? learnHours.toFixed(1) + "h" : "—"}</b>
        </div>
      </div>
      <div className="menu-card">
        <div className="menu-row" onClick={() => setAccountOpen(true)}>
          <span className="mi">◎</span>
          <span>账号信息</span>
          <span className="arrow">›</span>
        </div>
        <div className="menu-row">
          <span className="mi">▣</span>
          <span>消息通知</span>
          <span
            className={`switch ${notify ? "on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setNotify((v) => !v);
            }}
          />
        </div>
        <div className="menu-row" onClick={() => setFeedbackOpen(true)}>
          <span className="mi">✎</span>
          <span>问题反馈</span>
          <span className="arrow">›</span>
        </div>
      </div>
      <div className="menu-card">
        <div className="menu-row" onClick={onLogout}>
          <span className="mi" style={{ color: "var(--red)", background: "#fff0f0" }}>
            ↪
          </span>
          <span style={{ color: "var(--red)" }}>退出登录</span>
          <span className="arrow">›</span>
        </div>
      </div>
      {appRoot &&
        createPortal(
          <div className={`modal-mask ${feedbackOpen ? "show" : ""}`}>
            <div className="modal">
              <div className="modal-title-row">
                <h3>问题反馈</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setFeedbackOpen(false)}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>
              <input
                value={feedbackTitle}
                onChange={(e) => setFeedbackTitle(e.target.value)}
                placeholder="请输入问题标题"
              />
              <textarea
                value={feedbackContent}
                onChange={(e) => setFeedbackContent(e.target.value)}
                placeholder="请描述你遇到的问题或建议"
              />
              <div className="feedback-upload">
                <input
                  ref={feedbackFileRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  hidden
                  onChange={handleFeedbackImages}
                />
                <button
                  type="button"
                  className="upload-trigger"
                  onClick={() => feedbackFileRef.current?.click()}
                >
                  <span>＋</span>上传图片
                </button>
                <small>最多上传 3 张图片，单张不超过 2MB</small>
              </div>
              <div className="feedback-preview">
                {feedbackImages.map((img, i) => (
                  <div key={`${img.name}-${i}`} className="feedback-image-item">
                    <img src={img.data} alt={img.name} />
                    <button
                      type="button"
                      onClick={() => removeFeedbackImage(i)}
                      aria-label="删除图片"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setFeedbackOpen(false)}>
                  取消
                </button>
                <button className="primary" onClick={submitFeedback}>
                  提交反馈
                </button>
              </div>
            </div>
          </div>,
          appRoot
        )}
      {appRoot &&
        createPortal(
          <div
            className={`account-mask ${accountOpen ? "show" : ""}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) setAccountOpen(false);
            }}
          >
            <div className="account-modal">
              <div className="account-head">
                <div>
                  <h3>账号信息</h3>
                  <p>完善个人资料，便于企业内身份识别</p>
                </div>
                <button
                  type="button"
                  className="account-close"
                  onClick={() => setAccountOpen(false)}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>
              <div className="account-fields">
                <div className="account-field">
                  <label>姓名</label>
                  <div className="account-value">{user?.name || "—"}</div>
                </div>
                <div className="account-field">
                  <label>登录账号</label>
                  <div className="account-value">{loginAccount}</div>
                </div>
                <div className="account-field">
                  <label>手机号码</label>
                  <div className="account-value">{maskMobile(user?.mobile)}</div>
                </div>
                <div className="account-field">
                  <label>所属部门</label>
                  <div className="account-value">{user?.orgName || "未分配部门"}</div>
                </div>
                <div className="account-field">
                  <label>员工编号</label>
                  <div className="account-value">{user?.id?.slice(0, 8) || "ZXT-0000"}</div>
                </div>
              </div>
              <div className="account-modal-actions">
                <button className="secondary" onClick={() => setAccountOpen(false)}>
                  取消
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    setAccountOpen(false);
                    showToast("资料已是最新");
                  }}
                >
                  保存信息
                </button>
              </div>
            </div>
          </div>,
          appRoot
        )}
    </>
  );
}
