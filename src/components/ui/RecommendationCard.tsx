"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { QuantityDisplay } from "@/components/ui/QuantityDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AllergenChips } from "@/components/kitchen/AllergenChips";
import { Info, AlertCircle, ChefHat, Sparkles, CheckCircle2, HelpCircle } from "lucide-react";
import { motion } from "motion/react";

export interface RecommendationCardProps {
  dishName: string;
  expectedDiners: number;
  eligibleCount: number;
  recommendedKg: number | null;
  exclusionReasons?: string[];
  status?: string;
  statusReason?: string;
  approvedKg: string;
  onApprovedKgChange?: (val: string) => void;
  onExplain?: () => void;
  unit?: string;
  disabled?: boolean;
  allergenTags?: string[];
  menuCycleLabel?: string | null;
}

export function RecommendationCard({
  dishName,
  expectedDiners,
  eligibleCount,
  recommendedKg,
  exclusionReasons = [],
  status = "OK",
  statusReason,
  approvedKg,
  onApprovedKgChange,
  onExplain,
  unit = "kg",
  disabled = false,
  allergenTags = [],
  menuCycleLabel = null,
}: RecommendationCardProps) {
  const approvedNum = parseFloat(approvedKg);
  const isAdjusted =
    recommendedKg !== null &&
    !isNaN(approvedNum) &&
    Math.abs(approvedNum - recommendedKg) > 0.01;

  const uniqueExclusions = Array.from(new Set(exclusionReasons));

  return (
    <Card className="p-5 cc-card shadow-xs transition-all hover:border-foreground/20 hover:shadow-sm rounded-xl flex flex-col justify-between overflow-hidden min-w-0 h-full">
      {/* Top: Metadata & Dish */}
      <div className="space-y-3.5 min-w-0 flex-1">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <ChefHat className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <h4
                className="font-heading font-bold text-foreground text-base tracking-tight truncate min-w-0 flex-1 floor-dish-title"
                title={dishName}
              >
                {dishName}
              </h4>
              {status && status !== "OK" && (
                <span className="shrink-0">
                  <StatusBadge
                    status={
                      status === "INVALID_TARGET" || status === "INVALID_CONFIG"
                        ? "abnormal"
                        : "missing"
                    }
                    label={status === "INSUFFICIENT_DATA" ? "Cold Start" : status}
                  />
                </span>
              )}
            </div>
            <AllergenChips
              allergenTags={allergenTags}
              menuCycleLabel={menuCycleLabel}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 min-w-0 floor-hide">
              <span>
                Expected diners:{" "}
                <strong className="text-foreground tabular-nums font-semibold cc-num">{expectedDiners}</strong>
              </span>
              <span className="text-muted-foreground/60">•</span>
              <span>
                Eligible services:{" "}
                <strong className="text-foreground tabular-nums font-semibold cc-num">{eligibleCount}</strong>
              </span>
            </p>
          </div>
        </div>

        {/* Calculation Basis / Error / Cold Start Status */}
        {status === "INVALID_TARGET" ? (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2.5 border border-destructive/20 min-w-0 floor-hide">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <span className="break-words min-w-0">
              Target issue: {statusReason || "Expected diners must be a positive integer."}
            </span>
          </div>
        ) : status === "INVALID_CONFIG" ? (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2.5 border border-destructive/20 min-w-0 floor-hide">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <span className="break-words min-w-0">
              Configuration error: {statusReason}
            </span>
          </div>
        ) : recommendedKg !== null ? (
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground cc-well rounded-lg p-2.5 min-w-0 floor-hide">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span className="break-words min-w-0 leading-relaxed">
                Baseline served/diner computed across {eligibleCount} eligible historical services.
              </span>
            </div>
            {onExplain && (
              <button
                type="button"
                onClick={onExplain}
                className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 hover:underline flex items-center gap-1 self-start transition-colors pt-0.5"
                title="View eligible service history and calculation breakdown"
              >
                <HelpCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Why this kg?</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 text-xs text-warning bg-warning-soft rounded-lg p-2.5 border border-warning/30 min-w-0 floor-hide">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <span className="break-words min-w-0">
                Insufficient history (&lt;3 eligible services). Enter manual estimate.
              </span>
            </div>
            {onExplain && (
              <button
                type="button"
                onClick={onExplain}
                className="text-[11px] font-semibold text-amber-900 dark:text-amber-300 hover:underline flex items-center gap-1 self-start transition-colors pt-0.5"
                title="View why no number is shown"
              >
                <HelpCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Why this kg?</span>
              </button>
            )}
          </div>
        )}

        {/* Exclusions information */}
        {uniqueExclusions.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1.5 pt-1 min-w-0 floor-hide">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Excluded from baseline:
            </span>
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {uniqueExclusions.map((ex, idx) => (
                <StatusBadge
                  key={idx}
                  status={
                    ex.toLowerCase().includes("stockout")
                      ? "stockout"
                      : ex.toLowerCase().includes("abnormal")
                      ? "abnormal"
                      : "missing"
                  }
                  label={ex}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Quantitative Section (Suggested & Approved) */}
      <div className="mt-5 pt-4 border-t border-border/70 min-w-0">
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl cc-well items-center min-w-0">
          {/* Suggested Stage */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="w-3 h-3 text-primary shrink-0" />
              <span className="truncate">Suggested</span>
            </div>
            <motion.div
              key={recommendedKg}
              initial={{ opacity: 0.8, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              <QuantityDisplay
                value={recommendedKg}
                unit={unit}
                size="lg"
                fallback="Manual Req."
              />
            </motion.div>
            {onExplain ? (
              <button
                type="button"
                onClick={onExplain}
                className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 hover:underline flex items-center gap-1 text-left truncate floor-hide"
                title="View eligible service history and calculation breakdown"
              >
                <span>Why this kg?</span>
              </button>
            ) : (
              <span className="text-[10px] text-muted-foreground block truncate floor-hide">
                Pure baseline
              </span>
            )}
          </div>

          {/* Approved Stage (Manager/Head Cook Input) */}
          <div className="space-y-1 text-right min-w-0">
            <div className="flex items-center justify-end gap-1.5">
              <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider truncate">
                Approved
              </label>
              {isAdjusted && (
                <span className="shrink-0">
                  <StatusBadge status="overridden" label="Adjusted" />
                </span>
              )}
            </div>
            <div className="flex items-center justify-end gap-1.5 min-w-0">
              <input
                type="number"
                step="0.01"
                min="0"
                value={approvedKg}
                disabled={disabled}
                onChange={(e) => onApprovedKgChange?.(e.target.value)}
                placeholder="0.00"
                className="w-20 sm:w-24 text-right font-heading font-bold cc-num text-sm sm:text-base rounded-lg border border-input bg-card px-2.5 py-1.5 tabular-nums shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary disabled:opacity-50 transition-all min-w-0 floor-target-weight"
              />
              <span className="text-xs font-semibold text-muted-foreground uppercase shrink-0">
                {unit}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block truncate floor-hide">
              Committed target
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
