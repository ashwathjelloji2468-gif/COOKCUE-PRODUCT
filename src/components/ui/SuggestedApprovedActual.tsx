import React from "react";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Clock, Sparkles } from "lucide-react";

export interface SuggestedApprovedActualProps {
  suggestedKg: number | null;
  approvedKg: number | null;
  actualKg?: number | null;
  unit?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabels?: boolean;
}

export function SuggestedApprovedActual({
  suggestedKg,
  approvedKg,
  actualKg,
  unit = "kg",
  size = "md",
  className,
  showLabels = true,
}: SuggestedApprovedActualProps) {
  const isSm = size === "sm";
  const isLg = size === "lg";

  const isAdjusted =
    suggestedKg !== null &&
    approvedKg !== null &&
    Math.abs(approvedKg - suggestedKg) > 0.01;

  const actualRecorded = actualKg !== undefined && actualKg !== null;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-xs",
        className
      )}
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-4 items-center">
        {/* 1. SUGGESTED STAGE */}
        <div className="flex flex-col space-y-1">
          {showLabels && (
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="w-3 h-3 text-primary/70 shrink-0" />
              <span className="truncate">Suggested</span>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                "font-mono font-bold text-foreground tabular-nums tracking-tight",
                isSm ? "text-sm" : isLg ? "text-xl sm:text-2xl" : "text-base sm:text-lg"
              )}
            >
              {suggestedKg !== null ? suggestedKg.toFixed(1) : "—"}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
              {suggestedKg !== null ? unit : "Manual Req."}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground hidden sm:inline truncate">
            Baseline model
          </span>
        </div>

        {/* 2. APPROVED STAGE */}
        <div className="flex flex-col space-y-1 border-x border-border/60 px-2 sm:px-3">
          {showLabels && (
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-foreground">
              <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
              <span className="truncate">Approved</span>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                "font-mono font-bold text-foreground tabular-nums tracking-tight",
                isSm ? "text-sm" : isLg ? "text-xl sm:text-2xl" : "text-base sm:text-lg",
                isAdjusted && "text-primary"
              )}
            >
              {approvedKg !== null ? approvedKg.toFixed(1) : "—"}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
              {unit}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground hidden sm:inline truncate">
            {isAdjusted ? "Manager override" : "Direct baseline"}
          </span>
        </div>

        {/* 3. ACTUAL STAGE */}
        <div className="flex flex-col space-y-1 pl-1">
          {showLabels && (
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate">Actual</span>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            {actualRecorded ? (
              <>
                <span
                  className={cn(
                    "font-mono font-bold text-foreground tabular-nums tracking-tight",
                    isSm ? "text-sm" : isLg ? "text-xl sm:text-2xl" : "text-base sm:text-lg"
                  )}
                >
                  {actualKg.toFixed(1)}
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  {unit}
                </span>
              </>
            ) : (
              <span className="text-[11px] sm:text-xs text-muted-foreground/80 font-medium italic">
                Pending
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground hidden sm:inline truncate">
            {actualRecorded ? "Post-service cooked" : "Awaiting closeout"}
          </span>
        </div>
      </div>
    </div>
  );
}
