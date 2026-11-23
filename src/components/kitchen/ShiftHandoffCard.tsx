"use client";

import React from "react";
import Link from "next/link";
import {
  Clock,
  Calendar,
  Users,
  ChefHat,
  ClipboardCheck,
  AlertTriangle,
  Scale,
  ArrowRight,
  BookOpen,
  FileBarChart2,
  CheckCircle2,
  FileEdit,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Utensils,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFloorMode } from "@/context/FloorModeContext";
import type { ShiftHandoffSummary } from "@/server/actions/shift-handoff";
import { cn } from "@/lib/utils";
import { KITCHEN_LABELS } from "@/lib/kitchen/labels";

interface ShiftHandoffCardProps {
  data: ShiftHandoffSummary;
  showStationLinks?: boolean;
}

export function ShiftHandoffCard({ data, showStationLinks = true }: ShiftHandoffCardProps) {
  const { floorMode } = useFloorMode();

  const isApproved = data.planStatus === "APPROVED";
  const isDraft = data.planStatus === "DRAFT";
  const isNoPlan = data.planStatus === "NO_PLAN";
  const isCloseoutDone = data.closeoutStatus === "SUBMITTED";

  // Case 1: Empty service state (no meal record)
  if (!data.mealExists) {
    return (
      <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden transition-all">
        <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <CardTitle
                className={cn(
                  "text-sm font-heading font-bold text-foreground",
                  floorMode && "text-base"
                )}
              >
                {data.mealType} Handoff · {data.date}
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              No Operational Record
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 text-center space-y-4">
          <div className="mx-auto w-10 h-10 rounded-full bg-muted/50 border border-border flex items-center justify-center text-muted-foreground">
            <Utensils className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p
              className={cn(
                "text-sm font-semibold text-foreground",
                floorMode && "text-base font-bold"
              )}
            >
              No operational activity recorded for this service yet
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Neither a morning preparation plan nor a closeout submission has been started for{" "}
              <strong>{data.kitchenName}</strong> during this service window.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Button asChild size="sm" className="h-8 text-xs gap-1">
              <Link href={data.links.morning}>
                <ChefHat className="w-3.5 h-3.5" />
                <span>Start Morning Plan</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
              <Link href={data.links.closeout}>
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Open Closeout</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Case 2: Meal service has activity
  return (
    <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden transition-all">
      {/* 1. Header Strip */}
      <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <CardTitle
                className={cn(
                  "text-base font-heading font-bold text-foreground",
                  floorMode && "text-lg"
                )}
              >
                {data.mealType} Shift Handoff
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono">
                {data.date}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5 floor-hide">
              {data.kitchenName} · 30-second situational status for incoming cooks and line staff
            </CardDescription>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {isApproved && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {KITCHEN_LABELS.APPROVED}
              </span>
            )}
            {isDraft && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                <FileEdit className="w-3.5 h-3.5" />
                {KITCHEN_LABELS.DRAFT}
              </span>
            )}
            {isNoPlan && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border/60">
                <AlertCircle className="w-3.5 h-3.5" />
                {KITCHEN_LABELS.NO_PLAN}
              </span>
            )}

            {isCloseoutDone ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Closeout Logged
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                <Clock className="w-3.5 h-3.5" />
                Closeout Pending
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        {/* 2. Morning Prep vs Closeout Actuals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Box A: Preparation & Plan */}
          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-xs font-bold font-heading uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <ChefHat className="w-4 h-4 text-primary" />
                <span>Morning Preparation</span>
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {data.planItemsCount} {data.planItemsCount === 1 ? "dish" : "dishes"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[11px] text-muted-foreground block">{KITCHEN_LABELS.expectedDiners}</span>
                <span
                  className={cn(
                    "text-base font-bold font-mono text-foreground tabular-nums",
                    floorMode && "text-lg"
                  )}
                >
                  {data.expectedDiners ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Approval Status</span>
                <span
                  className={cn(
                    "text-xs font-semibold text-foreground block truncate",
                    floorMode && "text-sm"
                  )}
                >
                  {isApproved ? `Approved by ${data.approvedBy || "Head Cook"}` : isDraft ? "Draft pending review" : "Unplanned"}
                </span>
              </div>
            </div>
          </div>

          {/* Box B: Execution & Closeout Actuals */}
          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-xs font-bold font-heading uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                <span>Service Closeout Actuals</span>
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {isCloseoutDone ? "Recorded" : "Pending"}
              </span>
            </div>

            {isCloseoutDone ? (
              <div className="grid grid-cols-3 gap-2 pt-1 text-center sm:text-left">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    {KITCHEN_LABELS.actualDiners}
                  </span>
                  <span
                    className={cn(
                      "text-base font-bold font-mono text-foreground tabular-nums",
                      floorMode && "text-lg"
                    )}
                  >
                    {data.actualDiners ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Cooked / Left in vessel
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold font-mono text-foreground tabular-nums block",
                      floorMode && "text-sm"
                    )}
                  >
                    {data.totalCookedKg ?? "—"} / {data.totalLeftoverKg ?? "—"} kg
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Total Served
                  </span>
                  <span
                    className={cn(
                      "text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums",
                      floorMode && "text-lg"
                    )}
                  >
                    {data.totalServedKg ?? "—"} <span className="text-[10px] font-normal">kg</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-2 text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Service closeout has not been submitted yet.</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Incidents / Stockout Banner (if any) */}
        {data.stockoutDishes.length > 0 && (
          <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Stockout Incident Notice</span>
              <span className="text-[11px] leading-relaxed">
                Food ran out during service rush for:{" "}
                <strong>{data.stockoutDishes.join(", ")}</strong>. The incoming shift should check buffer inventory and prep quantities accordingly.
              </span>
            </div>
          </div>
        )}

        {/* 4. Variance Summary (if present) */}
        {data.varianceText && (
          <div className="p-3 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground">Consumption Variance:</span>
              <span className="text-muted-foreground font-medium">
                {data.varianceText}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground italic shrink-0 hidden sm:inline">
              vs prior eligible baseline
            </span>
          </div>
        )}

        {/* 5. Station Navigation Bar */}
        {showStationLinks && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
            <span className="text-[11px] text-muted-foreground">
              Station Quick Links:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Link href={data.links.morning}>
                  <ChefHat className="w-3.5 h-3.5" />
                  <span>Morning Plan</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Link href={data.links.staffBoard}>
                  <Users className="w-3.5 h-3.5" />
                  <span>Staff Board</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Link href={data.links.closeout}>
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>Closeout</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Link href={data.links.diary}>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{KITCHEN_LABELS.serviceDiary}</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-8 text-xs gap-1">
                <Link href={data.links.results}>
                  <FileBarChart2 className="w-3.5 h-3.5" />
                  <span>Results</span>
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
