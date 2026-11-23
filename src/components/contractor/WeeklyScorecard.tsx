"use client";

import React from "react";
import Link from "next/link";
import {
  CalendarRange,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  TrendingUp,
  Clock,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Building2,
  FileDown,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ContractorWeeklyScorecard, KitchenWeeklyScorecard } from "@/lib/domain/scorecard";

interface WeeklyScorecardProps {
  scorecard: ContractorWeeklyScorecard;
  isFounder?: boolean;
}

export function WeeklyScorecard({ scorecard, isFounder = false }: WeeklyScorecardProps) {
  const { weekStart, weekEnd, kitchens } = scorecard;

  // Format date range nicely
  const formatDate = (isoStr: string) => {
    try {
      const parts = isoStr.split("-");
      if (parts.length === 3) {
        const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      }
      return isoStr;
    } catch {
      return isoStr;
    }
  };

  const dateRangeLabel = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

  const getComplianceBadge = (pct: number | null) => {
    if (pct === null) {
      return (
        <span
          className="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded bg-muted/20 text-muted-foreground border border-border"
          title="No approved plans in the 7-day period"
        >
          —
        </span>
      );
    }
    if (pct >= 90) {
      return (
        <span className="inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          {pct.toFixed(1)}%
        </span>
      );
    }
    if (pct >= 70) {
      return (
        <span className="inline-flex items-center gap-1 font-mono font-semibold text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          {pct.toFixed(1)}%
        </span>
      );
    }
    if (pct >= 50) {
      return (
        <span className="inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          {pct.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
        <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
        {pct.toFixed(1)}%
      </span>
    );
  };

  return (
    <Card className="cc-card border-border bg-card shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/60 bg-muted/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-primary" />
              <CardTitle className="font-heading text-lg font-bold text-foreground">
                This Week’s Kitchen Scorecard
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] tracking-tight">
                {dateRangeLabel}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Operational discipline metrics from real records across the last 7 calendar days. Kitchens needing attention are prioritized.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <span className="hidden md:inline-block text-[11px] text-muted-foreground font-mono mr-1">
              Window: 7 days
            </span>
            {scorecard.contractor.id !== "platform" && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="text-xs h-8 gap-1.5 font-semibold border-border bg-card hover:bg-muted text-foreground shadow-2xs"
              >
                <a
                  href={`/api/contractor/${scorecard.contractor.id}/weekly-report.pdf`}
                  download={`CookCue-Weekly-Report-${scorecard.contractor.code || "CTR"}-${scorecard.weekEnd}.pdf`}
                  title="Download 7-day operational kitchen report as PDF"
                >
                  <FileDown className="w-3.5 h-3.5 text-primary" />
                  <span>Download weekly PDF</span>
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {kitchens.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Building2 className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm font-medium text-foreground">No kitchen facilities found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No operational kitchen stations are provisioned under this contractor organization yet.
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[600px] cc-table">
            <table className="w-full text-left border-collapse text-xs cc-table">
              <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur-xs">
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground select-none">
                  <th className="py-3 px-4 min-w-[180px]">Kitchen Facility</th>
                  <th className="py-3 px-3 text-center min-w-[130px]">
                    <div className="inline-flex items-center justify-center gap-1">
                      <span>Closeout Compliance</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              <HelpCircle className="w-3 h-3 text-[var(--muted)]" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            Meals with APPROVED plan that have closeout observations submitted / meals with APPROVED plan in the 7-day period. (— if 0 approved plans).
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center min-w-[120px]">
                    <div className="inline-flex items-center justify-center gap-1">
                      <span>Plan Approval</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              <HelpCircle className="w-3 h-3 text-[var(--muted)]" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            Approved cooking plans vs unapproved drafts or missing plans for meals in the week.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center min-w-[95px]">
                    <span>Stockout Days</span>
                  </th>
                  <th className="py-3 px-3 text-center min-w-[100px]">
                    <span>Eligible Observations</span>
                  </th>
                  <th className="py-3 px-3 text-center min-w-[90px]">
                    <span>Open Issues</span>
                  </th>
                  <th className="py-3 px-4 text-right min-w-[140px]">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]/60">
                {kitchens.map((k, idx) => {
                  const hasStockouts = k.stockoutDays > 0;
                  const hasExceptions = k.openExceptionsCount > 0;
                  const hasDrafts = k.plansDraftOrMissingCount > 0;

                  return (
                    <tr
                      key={k.kitchenId}
                      className="hover:bg-[var(--accent-soft)]/20 transition-colors group"
                    >
                      {/* Kitchen Name & Status */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-sm text-[var(--foreground)]">
                              {k.name}
                            </span>
                            {k.status !== "ACTIVE" && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 text-muted-foreground">
                                {k.status}
                              </Badge>
                            )}
                          </div>
                          {k.location && (
                            <p className="text-[11px] text-[var(--muted)] truncate max-w-[200px]">
                              {k.location}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Closeout Compliance */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          {getComplianceBadge(k.closeoutCompliancePct)}
                          <span className="text-[10px] text-[var(--muted)] font-mono">
                            {k.approvedWithCloseoutCount} of {k.approvedPlansCount} meals
                          </span>
                        </div>
                      </td>

                      {/* Plan Approval Status */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
                            {k.plansApprovedOnTimeCount} approved
                          </span>
                          {hasDrafts ? (
                            <span className="text-[10px] font-mono font-medium text-amber-600 dark:text-amber-400">
                              {k.plansDraftOrMissingCount} draft / missing
                            </span>
                          ) : (
                            <span className="text-[10px] text-[var(--muted)] font-mono">
                              0 missing
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stockout Days */}
                      <td className="py-3.5 px-3 text-center">
                        {hasStockouts ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            {k.stockoutDays} {k.stockoutDays === 1 ? "day" : "days"}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-[var(--muted)]">0 days</span>
                        )}
                      </td>

                      {/* Eligible Observations */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-mono text-xs font-medium text-[var(--foreground)]">
                          {k.eligibleObservationCount}
                        </span>
                        <span className="text-[10px] text-[var(--muted)] block font-mono">
                          verified
                        </span>
                      </td>

                      {/* Open Exceptions */}
                      <td className="py-3.5 px-3 text-center">
                        {hasExceptions ? (
                          <Badge variant="destructive" className="font-mono text-[10px] px-1.5 py-0 h-5">
                            {k.openExceptionsCount} open
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Clear
                          </span>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] px-2 gap-1 border-[var(--card-border)] hover:bg-[var(--accent-soft)]"
                          >
                            <Link href={`/kitchen/${k.kitchenId}/handoff`} title="View Shift Handoff">
                              <Clock className="w-3 h-3 text-[var(--accent)]" />
                              <span>Handoff</span>
                            </Link>
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] px-2 gap-1 hover:bg-[var(--accent-soft)]"
                          >
                            <Link href={`/kitchen/${k.kitchenId}/diary`} title="View Service Diary">
                              <BookOpen className="w-3 h-3 text-[var(--muted)]" />
                              <span className="hidden sm:inline">Diary</span>
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
