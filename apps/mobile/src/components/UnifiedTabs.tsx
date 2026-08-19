"use client";

import type { CSSProperties, ReactNode } from "react";

export interface UnifiedTabItem<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface UnifiedTabsProps<T extends string> {
  ariaLabel: string;
  className?: string;
  items: readonly UnifiedTabItem<T>[];
  onChange: (value: T) => void;
  value: T;
}

export default function UnifiedTabs<T extends string>({ ariaLabel, className = "", items, onChange, value }: UnifiedTabsProps<T>) {
  return (
    <div
      className={`unified-tabs ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
      style={{ "--unified-tab-count": items.length } as CSSProperties}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            className={`unified-tab ${active ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
