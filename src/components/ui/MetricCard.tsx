import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: {
    value: string | number;
    label?: string;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  status?: "normal" | "warning" | "danger" | "success";
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  delta,
  icon,
  status = "normal",
  className,
}: MetricCardProps) {
  const statusBorderClasses = {
    normal: "border-border bg-card",
    warning: "border-warning/40 bg-warning-soft text-warning",
    danger: "border-destructive/40 bg-destructive-soft text-destructive",
    success: "border-success/40 bg-success-soft text-success",
  }[status];

  return (
    <Card
      className={cn(
        "p-5 sm:p-6 flex flex-col justify-between transition-colors shadow-xs rounded-xl",
        statusBorderClasses,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {icon && (
          <div className="h-8 w-8 rounded-lg bg-accent-soft border border-border flex items-center justify-center text-accent shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-bold font-heading text-foreground tabular-nums tracking-tight cc-num">
            {value}
          </span>
          {unit && (
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {unit}
            </span>
          )}
        </div>

        {delta && (
          <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
            <span
              className={cn(
                "font-semibold tabular-nums px-1.5 py-0.5 rounded text-[10px]",
                delta.isPositive ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
              )}
            >
              {delta.value}
            </span>
            {delta.label && <span>{delta.label}</span>}
          </p>
        )}
      </div>
    </Card>
  );
}
