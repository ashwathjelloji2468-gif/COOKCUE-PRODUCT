"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileEdit,
  CheckCircle2,
  ClipboardCheck,
  AlertTriangle,
  Sparkles,
  Clock,
  ArrowRight,
  Calendar,
  Users,
  Utensils,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFloorMode } from "@/context/FloorModeContext";
import type { ServiceDiaryData, ServiceDiaryEvent } from "@/server/actions/service-diary";
import { cn } from "@/lib/utils";
import { KITCHEN_LABELS } from "@/lib/kitchen/labels";

interface ServiceDiaryTimelineProps {
  initialData: ServiceDiaryData;
  kitchenId: string;
}

export function ServiceDiaryTimeline({ initialData, kitchenId }: ServiceDiaryTimelineProps) {
  const router = useRouter();
  const { floorMode } = useFloorMode();

  const [date, setDate] = useState(initialData.date);
  const [mealType, setMealType] = useState(initialData.mealType);

  const { data } = { data: initialData };

  function handleFilterChange(newDate: string, newMeal: string) {
    setDate(newDate);
    setMealType(newMeal);
    router.push(`/kitchen/${kitchenId}/diary?date=${newDate}&mealType=${newMeal}`);
  }

  // Format timestamp to localized time
  function formatTime(isoStr: string) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Filter & Service State Bar */}
      <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className={cn("text-base font-heading font-bold text-foreground", floorMode && "text-lg")}>
                Service Log &amp; Timeline
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground floor-hide">
                Chronological operational journal tracking morning approval, execution handoff, closeouts, and learning.
              </CardDescription>
            </div>

            {/* Quick Station Navigation Links */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Link href={`/kitchen/${kitchenId}/morning`}>
                  <span>Morning</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Link href={`/kitchen/${kitchenId}/staff-board`}>
                  <span>Staff Board</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Link href={`/kitchen/${kitchenId}/closeout`}>
                  <span>Closeout</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Link href={`/kitchen/${kitchenId}/results`}>
                  <span>Results</span>
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Meal Type & Date Pickers */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => handleFilterChange(e.target.value, mealType)}
                  className="h-9 px-3 rounded-lg border border-input bg-card text-xs font-mono font-medium shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              {/* Meal Selector Buttons */}
              <div className="inline-flex rounded-lg border border-border/80 bg-muted/30 p-0.5">
                {(["BREAKFAST", "LUNCH", "DINNER"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleFilterChange(date, m)}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                      mealType === m
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m.charAt(0) + m.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Service Status Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {data.planStatus === "APPROVED" ? (
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[11px]">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{KITCHEN_LABELS.APPROVED}</span>
                </Badge>
              ) : data.planStatus === "DRAFT" ? (
                <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 text-[11px]">
                  {KITCHEN_LABELS.DRAFT}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground border-border text-[11px]">
                  {KITCHEN_LABELS.NO_PLAN}
                </Badge>
              )}

              {data.closeoutStatus === "SUBMITTED" ? (
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[11px]">
                  <ClipboardCheck className="w-3 h-3" />
                  <span>Closeout Logged</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground border-border text-[11px]">
                  Closeout Pending
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Chronological Timeline List */}
      {data.events.length === 0 ? (
        <Card className="border-border/80 bg-card p-8 sm:p-12 text-center">
          <EmptyState
            icon={<Clock className="w-10 h-10 text-muted-foreground" />}
            title="No activity recorded for this service"
            description={`No morning plan or closeout has been recorded for ${data.kitchenName} on ${data.date} (${data.mealType}).`}
            action={
              <Button asChild size="default" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 shadow-xs mt-2">
                <Link href={`/kitchen/${kitchenId}/morning`}>
                  <Utensils className="w-4 h-4 text-[#D9EF79]" />
                  <span>Start Morning Plan &rarr;</span>
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="border-border/80 bg-card shadow-xs rounded-xl p-6 sm:p-8">
          <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-[11px] sm:before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border/80">
            {data.events.map((ev) => {
              // Icon and style per event type
              let Icon = Clock;
              let iconClasses = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

              if (ev.type === "PLAN_CREATED") {
                Icon = FileEdit;
                iconClasses = "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300";
              } else if (ev.type === "PLAN_APPROVED") {
                Icon = CheckCircle2;
                iconClasses = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
              } else if (ev.type === "CLOSEOUT_SUBMITTED") {
                Icon = ClipboardCheck;
                iconClasses = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
              } else if (ev.type === "STOCKOUT") {
                Icon = AlertTriangle;
                iconClasses = "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
              } else if (ev.type === "ELIGIBILITY_SUMMARY") {
                Icon = Sparkles;
                iconClasses = "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";
              }

              return (
                <div key={ev.id} className="relative group">
                  {/* Timeline node icon */}
                  <div
                    className={cn(
                      "absolute -left-[35px] sm:-left-[39px] top-0 w-8 h-8 rounded-full border-2 border-background flex items-center justify-center shadow-xs",
                      iconClasses
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  {/* Event content box */}
                  <div className="p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/15 transition-colors shadow-2xs space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4
                          className={cn(
                            "font-heading font-bold text-sm text-foreground",
                            floorMode && "text-base font-extrabold"
                          )}
                        >
                          {ev.title}
                        </h4>
                        {ev.actor && (
                          <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0">
                            {ev.actor}
                          </Badge>
                        )}
                        {ev.severity === "WARNING" && (
                          <Badge variant="outline" className="border-rose-300 text-rose-700 dark:text-rose-300 text-[10px]">
                            Attention
                          </Badge>
                        )}
                      </div>

                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        {formatTime(ev.timestamp)}
                      </span>
                    </div>

                    <p
                      className={cn(
                        "text-xs text-muted-foreground leading-relaxed",
                        floorMode && "text-sm text-foreground/80 font-medium"
                      )}
                    >
                      {ev.detail}
                    </p>

                    {ev.href && (
                      <div className="pt-1">
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary">
                          <Link href={ev.href}>
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
