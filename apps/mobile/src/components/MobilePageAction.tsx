"use client";

import { ChevronLeft, X } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type MobilePageActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  kind: "back" | "close";
  variant?: "default" | "immersive" | "overlay";
};

/** Shared header action with a stable 44px touch target. */
export default function MobilePageAction({ kind, variant = "default", className = "", ...props }: MobilePageActionProps) {
  const Icon = kind === "back" ? ChevronLeft : X;
  const label = kind === "back" ? "返回" : "关闭";

  return (
    <button
      {...props}
      type="button"
      className={`mobile-page-action mobile-page-action--${kind} mobile-page-action--${variant} ${className}`.trim()}
      aria-label={props["aria-label"] || label}
    >
      <Icon aria-hidden="true" strokeWidth={2.25} />
    </button>
  );
}
