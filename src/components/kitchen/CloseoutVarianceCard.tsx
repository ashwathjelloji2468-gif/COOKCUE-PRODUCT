"use client";

import React from "react";
import Link from "next/link";
import {
  Scale,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  ArrowRight,
  BookOpen,
  FileBarChart2,
  Clock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFloorMode } from "@/context/FloorModeContext";
import type { CloseoutVarianceSummary } from "@/lib/domain/closeout-variance";
import { cn } from "@/lib/utils";
import { KITCHEN_LABELS } from "@/lib/kitchen/labels";

interface CloseoutVarianceCardProps {
  variance: CloseoutVarianceSummary;
  kitchenId: string;
  date: string;
  mealType: string;
}

export function CloseoutVarianceCard({
  variance,
  kitchenId,
  date,
  mealType,
}: CloseoutVarianceCardProps) {
  const { floorMode } = useFloorMode();

  const diaryHref = `/kitchen/${kitchenId}/diary?date=${date}&mealType=${mealType}`;
  const handoffHref = `/kitchen/${kitchenId}/handoff?date=${date}&mealType=${mealType}`;
  const resultsHref = `/kitchen/${kitchenId}/results`;

  // Case 1: Insufficient prior eligible history (< 3 prior eligible services)
  if (!variance.hasEnoughHistory) {
    return (
      <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden transition-all">
        <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-muted-foreground shrink-0" />
            <CardTitle
              className={cn(
                "text-sm font-heading font-bold text-foreground",
                floorMode && "text-base"
              )}
            >
              Post-Closeout Consumption Variance
            </CardTitle>
            <Badge variant="outline" className="text-[10px] ml-auto font-mono">
              History: {variance.priorServicesCount}/3 required
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="p-3.5 rounded-lg border border-border/70 bg-muted/30">
            <p
              className={cn(
                "text-xs font-semibold text-foreground",
                floorMode && "text-sm font-bold"
              )}
            >
              {variance.message || "Not enough eligible history to compare yet"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Comparison requires at least 3 prior clean service records for{" "}
              <strong className="text-foreground">{mealType}</strong> with zero stockouts or abnormal exclusions. Found {variance.priorServicesCount} prior eligible services.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-[11px] text-muted-foreground">
              Variance analysis updates automatically as closeout records accumulate.
            </span>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Link href={handoffHref}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Shift Handoff</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
                <Link href={diaryHref}>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{KITCHEN_LABELS.serviceDiary}</span>
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Case 2: Sufficient eligible history (>= 3 prior eligible services)
  const isHigher = variance.varianceLabel === "higher";
  const isLower = variance.varianceLabel === "lower";
  const isSimilar = variance.varianceLabel === "similar";

  return (
    <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden transition-all">
      <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary shrink-0" />
            <CardTitle
              className={cn(
                "text-sm font-heading font-bold text-foreground",
                floorMode && "text-base"
              )}
            >
              Post-Closeout Consumption Variance
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            vs last {variance.priorServicesCount} eligible {mealType.toLowerCase()} services
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. This Service */}
          <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              This Service
            </span>
            <div
              className={cn(
                "text-lg font-bold font-mono text-foreground tabular-nums",
                floorMode && "text-xl"
              )}
            >
              {variance.thisServiceKgPerDiner?.toFixed(3)}{" "}
              <span className="text-xs font-normal text-muted-foreground">kg/diner</span>
            </div>
            <span className="text-[10px] text-muted-foreground block">
              Actual served food per diner
            </span>
          </div>

          {/* 2. Recent Eligible Average */}
          <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Recent Eligible Avg
            </span>
            <div
              className={cn(
                "text-lg font-bold font-mono text-foreground tabular-nums",
                floorMode && "text-xl"
              )}
            >
              {variance.baselineKgPerDiner?.toFixed(3)}{" "}
              <span className="text-xs font-normal text-muted-foreground">kg/diner</span>
            </div>
            <span className="text-[10px] text-muted-foreground block">
              Mean over last {variance.priorServicesCount} clean services
            </span>
          </div>

          {/* 3. Variance Delta */}
          <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Variance
            </span>
            <div className="flex items-center gap-1.5">
              {isHigher && <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />}
              {isLower && <TrendingDown className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
              {isSimilar && <Minus className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
              <span
                className={cn(
                  "text-lg font-bold font-mono tabular-nums",
                  floorMode && "text-xl",
                  isHigher && "text-amber-700 dark:text-amber-300",
                  isLower && "text-blue-700 dark:text-blue-300",
                  isSimilar && "text-emerald-700 dark:text-emerald-300"
                )}
              >
                {variance.variancePct && variance.variancePct > 0 ? "+" : ""}
                {variance.variancePct?.toFixed(1)}%
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block truncate">
              {isHigher && "higher than recent eligible average"}
              {isLower && "lower than recent eligible average"}
              {isSimilar && "similar to recent eligible average"}
            </span>
          </div>
        </div>

        {/* Explainable Neutral Summary Banner */}
        <div className="p-3 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Summary:</span>
            <span className="text-muted-foreground font-medium">
              {variance.varianceText}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground italic shrink-0 hidden sm:inline">
            Informational only · No auto plan changes
          </span>
        </div>

        {/* Footer Deep Links */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
          <span className="text-[11px] text-muted-foreground">
            Strict arithmetic comparison &middot; Same facility and service window
          </span>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Link href={handoffHref}>
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Shift Handoff</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Link href={diaryHref}>
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                <span>{KITCHEN_LABELS.serviceDiary}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Link href={resultsHref}>
                <FileBarChart2 className="w-3.5 h-3.5 text-primary" />
                <span>Station Results</span>
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
