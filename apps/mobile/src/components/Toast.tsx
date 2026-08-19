"use client";

interface ToastProps {
  message: string | null;
}

export default function Toast({ message }: ToastProps) {
  return <div className={`toast ${message ? "show" : ""}`}>{message}</div>;
}
