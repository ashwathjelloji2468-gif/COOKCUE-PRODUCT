"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getKitchenTodayStrip,
  type KitchenTodayStripData,
} from "@/server/actions/kitchen-strip";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  ArrowRight,
  Users,
  Utensils,
  ClipboardList,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { KITCHEN_LABELS } from "@/lib/kitchen/labels";

interface KitchenTodayStripProps {
  kitchenId: string;
}

export function KitchenTodayStrip({ kitchenId }: KitchenTodayStripProps) {
  const pathname = usePathname();
  const [data, setData] = useState<KitchenTodayStripData | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const loadStripData = useCallback(async (mType?: string) => {
    setLoading(true);
    const res = await getKitchenTodayStrip(kitchenId, undefined, mType);
    if (res.success) {
      setData(res.data);
      if (!selectedMealType) {
        setSelectedMealType(res.data.mealType);
      }
    }
    setLoading(false);
  }, [kitchenId, selectedMealType]);

  useEffect(() => {
    loadStripData(selectedMealType);
  }, [loadStripData, selectedMealType]);

  if (!data && loading) {
    return (
      <div className="mb-6 rounded-xl border border-border/60 bg-card/60 p-3 flex items-center justify-between animate-pulse">
        <div className="h-4 w-48 bg-muted rounded"></div>
        <div className="h-7 w-28 bg-muted rounded-lg"></div>
      </div>
    );
  }

  if (!data) return null;

  const isMorningRoute = pathname.includes("/morning");
  const isCloseoutRoute = pathname.includes("/closeout");
  const isStaffBoardRoute = pathname.includes("/staff-board");
  const isResultsRoute = pathname.includes("/results");
  const isDiaryRoute = pathname.includes("/diary");
  const isHandoffRoute = pathname.includes("/handoff");

  return (
    <div className="mb-6 rounded-xl border border-border/80 bg-card/90 shadow-2xs backdrop-blur-xs overflow-hidden transition-all">
      <div className="p-3 sm:px-4 sm:py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Left: Meal Switcher & Service Info */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-foreground shrink-0">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="font-heading font-bold uppercase tracking-wider text-[11px]">Today:</span>
          </div>

          {/* Quick Meal Type Buttons */}
          <div className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-0.5">
            {(["BREAKFAST", "LUNCH", "DINNER"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMealType(m)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  data.mealType === m
                    ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.charAt(0) + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Diners indicator */}
          {data.expectedDiners !== null ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/60 text-[11px] font-medium">
              <Users className="w-3 h-3 text-primary" />
              <strong className="text-foreground tabular-nums font-mono">{data.expectedDiners}</strong> Diners
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground italic hidden sm:inline">
              (No expected diners set)
            </span>
          )}

          {/* Plan Status Badge */}
          {data.planStatus === "APPROVED" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
              <CheckCircle2 className="w-3 h-3" />
              {KITCHEN_LABELS.APPROVED}
            </span>
          )}
          {data.planStatus === "DRAFT" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
              <FileEdit className="w-3 h-3" />
              {KITCHEN_LABELS.DRAFT}
            </span>
          )}
          {data.planStatus === "NO_PLAN" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border/60">
              <AlertCircle className="w-3 h-3" />
              {KITCHEN_LABELS.NO_PLAN}
            </span>
          )}

          {/* Closeout Status Badge */}
          {data.closeoutStatus === "SUBMITTED" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
              <CheckCircle2 className="w-3 h-3" />
              Closeout Logged
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border/60">
              Closeout Pending
            </span>
          )}

          {/* Freshness Signal: Last closeout */}
          <span
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted/50 text-muted-foreground border border-border/60"
            title={data.lastCloseoutExact || "No closeouts recorded yet for this kitchen"}
          >
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span>Last closeout: <strong className="text-foreground font-medium">{data.lastCloseoutRelative}</strong></span>
          </span>
        </div>

        {/* Right: Quick Chips + Primary Action CTA */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Quick Route Link Chips */}
          <div className="hidden lg:flex items-center gap-1 border-r border-border/60 pr-2 mr-1">
            <Link
              href={`/kitchen/${kitchenId}/morning`}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                isMorningRoute
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Morning
            </Link>
            <Link
              href={`/kitchen/${kitchenId}/staff-board`}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                isStaffBoardRoute
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Staff Board
            </Link>
            <Link
              href={`/kitchen/${kitchenId}/closeout`}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                isCloseoutRoute
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Closeout
            </Link>
            <Link
              href={`/kitchen/${kitchenId}/results`}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                isResultsRoute
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Results
            </Link>
            <Link
              href={`/kitchen/${kitchenId}/diary?date=${data.date}&mealType=${data.mealType}`}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                isDiaryRoute
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {KITCHEN_LABELS.serviceDiary}
            </Link>
            <Link
              href={`/kitchen/${kitchenId}/handoff?date=${data.date}&mealType=${data.mealType}`}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                isHandoffRoute
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Handoff
            </Link>
          </div>

          {/* Next Action Primary CTA */}
          <Link
            href={data.nextAction.href}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-transform active:scale-[0.98]"
          >
            <span>{data.nextAction.label}</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#D9EF79] dark:text-emerald-100" />
          </Link>
        </div>
      </div>
    </div>
  );
}
