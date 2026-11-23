import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  ClipboardCheck,
  Database,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OperationalException } from "@/server/actions/exceptions";
import { cn } from "@/lib/utils";

interface ExceptionInboxProps {
  exceptions: OperationalException[];
  title?: string;
  subtitle?: string;
  className?: string;
}

export function ExceptionInbox({
  exceptions,
  title = "Needs attention",
  subtitle = "Operational exceptions across kitchens requiring resolution",
  className,
}: ExceptionInboxProps) {
  // Empty State: All clear — no open issues (positive, not broken)
  if (!exceptions || exceptions.length === 0) {
    return (
      <Card
        className={cn(
          "border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20 p-6 sm:p-8 transition-colors",
          className
        )}
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h3 className="font-heading text-lg font-bold text-emerald-900 dark:text-emerald-100">
                All clear — no open issues
              </h3>
              <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-300 text-[10px]">
                Healthy
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-emerald-800/80 dark:text-emerald-200/80 max-w-xl">
              All active kitchen facilities are operating smoothly with approved morning plans, complete closeouts, and zero stockout alerts.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("border-[var(--card-border)] bg-[var(--card)] shadow-xs overflow-hidden", className)}>
      <CardHeader className="pb-3 border-b border-[var(--card-border)] bg-[var(--background)]/40">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-heading font-bold text-[var(--foreground)]">
                  {title}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="font-mono text-[11px] px-2 py-0 border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                >
                  {exceptions.length} {exceptions.length === 1 ? "issue" : "issues"}
                </Badge>
              </div>
              <CardDescription className="text-xs text-[var(--muted)]">
                {subtitle}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-[var(--card-border)]">
        {exceptions.map((ex, idx) => {
          const isHigh = ex.severity === "HIGH" || ex.severity === "CRITICAL";
          const isMedium = ex.severity === "MEDIUM";

          // Icon per type
          let Icon = AlertTriangle;
          let actionLabel = "Fix Issue";

          if (ex.type === "PLAN_NOT_APPROVED") {
            Icon = Clock;
            actionLabel = "Approve Plan";
          } else if (ex.type === "CLOSEOUT_MISSING") {
            Icon = ClipboardCheck;
            actionLabel = "Submit Closeout";
          } else if (ex.type === "STOCKOUT") {
            Icon = AlertTriangle;
            actionLabel = "Inspect Closeout";
          } else if (ex.type === "LOW_ELIGIBLE_HISTORY") {
            Icon = Database;
            actionLabel = "View Forecast";
          }

          const typeLabel = {
            PLAN_NOT_APPROVED: "Plan not approved",
            CLOSEOUT_MISSING: "Closeout missing",
            STOCKOUT: "Stockout incident",
            LOW_ELIGIBLE_HISTORY: "Low history",
          }[ex.type];

          return (
            <div
              key={`${ex.kitchenId}-${ex.type}-${ex.date || idx}`}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--background)]/50 transition-colors"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                    isHigh
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                      : isMedium
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-semibold text-sm text-[var(--foreground)] truncate">
                      {ex.kitchenName}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0",
                        isHigh
                          ? "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300"
                          : isMedium
                          ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
                          : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                      )}
                    >
                      {ex.severity}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0">
                      {typeLabel}
                    </Badge>
                    {ex.date && (
                      <span className="text-[11px] font-mono text-[var(--muted)]">
                        {ex.date}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    {ex.summary}
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-end sm:self-center pl-12 sm:pl-0">
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                  <Link href={ex.href}>
                    <span>{actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
