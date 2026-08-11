"use client";

import { AlertTriangle } from "lucide-react";

/**
 * 通用确认弹窗（替代 window.confirm，样式对齐原型「删除确认」弹窗）
 */
export function ConfirmDialog({
  open,
  title = "删除确认",
  message,
  confirmText = "确认删除",
  cancelText = "取消",
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
        <div className="modal-head">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8, color: danger ? "#ef4444" : undefined }}>
            <AlertTriangle size={18} /> {title}
          </h2>
          <button className="link-btn" type="button" onClick={onCancel}>×</button>
        </div>
        <p style={{ color: "#6b7280", lineHeight: 1.7, margin: "12px 0 20px" }}>{message}</p>
        <div className="modal-actions">
          <button className="btn" type="button" onClick={onCancel}>{cancelText}</button>
          <button
            className="btn"
            type="button"
            onClick={onConfirm}
            style={{ background: danger ? "#ef4444" : "var(--blue)", borderColor: danger ? "#ef4444" : "var(--blue)", color: "#fff" }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
