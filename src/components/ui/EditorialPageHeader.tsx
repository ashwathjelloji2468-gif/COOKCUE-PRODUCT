import React from "react";
import { cn } from "@/lib/utils";

export interface EditorialPageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function EditorialPageHeader({
  eyebrow,
  title,
  subtitle,
  badge,
  actions,
  className,
}: EditorialPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 mb-8 border-b border-[var(--card-border)]",
        className
      )}
    >
      <div className="space-y-1.5 max-w-3xl">
        {eyebrow && (
          <div className="inline-flex items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              {eyebrow}
            </span>
            {badge}
          </div>
        )}
        <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[var(--foreground)] leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="shrink-0 flex items-center gap-2 pt-2 md:pt-0">{actions}</div>}
    </div>
  );
}
