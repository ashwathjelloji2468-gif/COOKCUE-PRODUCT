"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getRecommendationExplanation,
  type RecommendationExplanation,
} from "@/server/actions/morning-plan";
import {
  Sparkles,
  Calculator,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle2,
  Info,
  Scale,
  X,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { KITCHEN_LABELS } from "@/lib/kitchen/labels";

interface RecommendationExplanationDialogProps {
  kitchenId: string;
  dishId: string;
  dishName: string;
  mealType: string;
  expectedDiners: number;
  isOpen: boolean;
  onClose: () => void;
}

export function RecommendationExplanationDialog({
  kitchenId,
  dishId,
  dishName,
  mealType,
  expectedDiners,
  isOpen,
  onClose,
}: RecommendationExplanationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendationExplanation | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getRecommendationExplanation(kitchenId, dishId, mealType, expectedDiners)
      .then((res) => {
        if (!isMounted) return;
        setLoading(false);
        if (res.success) {
          setData(res.data);
        } else {
          setError(res.error);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoading(false);
        setError(err?.message || "Failed to load recommendation explanation");
      });

    return () => {
      isMounted = false;
    };
  }, [kitchenId, dishId, mealType, expectedDiners, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl bg-card border-border/80 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
            <Calculator className="w-3.5 h-3.5 text-primary" />
            <span>Calculation Audit Breakdown</span>
            <span>•</span>
            <span>{mealType}</span>
          </div>
          <DialogTitle className="text-xl font-heading font-black text-foreground flex items-center justify-between gap-2 mt-1">
            <span>{dishName}</span>
            {data?.hasEnoughHistory && (
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-xs">
                <CheckCircle2 className="w-3 h-3" />
                <span>Baseline Verified</span>
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Transparent breakdown of historical service observations and pure arithmetic used for this suggestion.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground font-medium">
              Retrieving historical service baseline...
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Failed to load explanation</span>
            </div>
            <p>{error}</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-5 pt-2">
            {/* 1. Status / Main Result Banner */}
            {data.hasEnoughHistory ? (
              <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">
                      {KITCHEN_LABELS.recommendedKg}:
                    </span>
                    <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-950 dark:text-emerald-100 tabular-nums">
                      {data.suggestedKg?.toFixed(2)} {data.unit}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-mono font-semibold">
                      {data.servedPerDinerRate?.toFixed(4)} {data.unit}/diner
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono font-semibold">
                      {data.expectedDiners} diners
                    </span>
                  </div>
                </div>

                <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
                  {data.message}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>No Numerical Suggestion</span>
                </div>
                <p className="text-xs text-amber-900/85 dark:text-amber-200/85 leading-relaxed">
                  {data.message}
                </p>
                <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80 bg-amber-100/50 dark:bg-amber-900/30 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                  CookCue requires a minimum of 3 clean, disruption-free historical services for the same kitchen and meal type before computing mathematical suggestions. Kitchen staff should supply a manual target for this service.
                </div>
              </div>
            )}

            {/* 2. Arithmetic Components Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Historical Rate
                </span>
                <span className="text-base font-bold font-mono text-foreground block tabular-nums">
                  {data.servedPerDinerRate !== null ? `${data.servedPerDinerRate.toFixed(4)} ${data.unit}` : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  per diner served
                </span>
              </div>

              <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  {KITCHEN_LABELS.expectedDiners}
                </span>
                <span className="text-base font-bold font-mono text-foreground block tabular-nums">
                  {data.expectedDiners}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  planned count
                </span>
              </div>

              <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Total Served Kg
                </span>
                <span className="text-base font-bold font-mono text-foreground block tabular-nums">
                  {data.totalServedKg !== null ? `${data.totalServedKg.toFixed(1)} ${data.unit}` : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  across eligible meals
                </span>
              </div>

              <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Total Diners
                </span>
                <span className="text-base font-bold font-mono text-foreground block tabular-nums">
                  {data.totalDiners !== null ? data.totalDiners : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  served in baseline
                </span>
              </div>
            </div>

            {/* 3. High-Level Exclusion Awareness Strip */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground">Eligibility Classification:</span>
                <span className="text-muted-foreground">
                  <strong>{data.eligibleCount}</strong> clean eligible · <strong>{data.excludedCount}</strong> excluded
                </span>
              </div>

              {data.exclusionSummary && data.excludedCount > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                  {data.exclusionSummary.stockoutCount > 0 && (
                    <span className="text-red-700 dark:text-red-400">
                      {data.exclusionSummary.stockoutCount} food ran out
                    </span>
                  )}
                  {data.exclusionSummary.abnormalCount > 0 && (
                    <span className="text-amber-700 dark:text-amber-400">
                      {data.exclusionSummary.abnormalCount} unusual disruptions
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 4. Eligible Historical Observations Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <h4 className="font-bold font-heading text-foreground uppercase tracking-wider text-[11px]">
                  Eligible Observations Used in Rate Calculation
                </h4>
                {data.cappedListNotice && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {data.cappedListNotice}
                  </span>
                )}
              </div>

              {data.eligibleObservations.length === 0 ? (
                <div className="p-6 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                  No eligible historical service records found for this dish and meal type yet.
                </div>
              ) : (
                <div className="border border-border/80 rounded-lg overflow-x-auto shadow-2xs">
                  <table className="w-full text-left text-xs min-w-[520px]">
                    <thead className="bg-muted/40 border-b border-border text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Service Date</th>
                        <th className="py-2.5 px-3 text-right">{KITCHEN_LABELS.totalCookedKg}</th>
                        <th className="py-2.5 px-3 text-right">{KITCHEN_LABELS.unservedLeftoverKg}</th>
                        <th className="py-2.5 px-3 text-right">Served (kg)</th>
                        <th className="py-2.5 px-3 text-right">{KITCHEN_LABELS.actualDiners}</th>
                        <th className="py-2.5 px-3 text-right">Rate (kg/p)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono">
                      {data.eligibleObservations.map((obs) => (
                        <tr key={obs.mealId} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-foreground font-sans">
                            {obs.date}
                            {obs.notes && (
                              <span className="block text-[10px] text-muted-foreground font-normal truncate max-w-[140px]">
                                {obs.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                            {obs.cookedKg.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                            {obs.leftoverKg.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-foreground">
                            {obs.servedKg.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                            {obs.actualDiners}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                            {obs.servedPerDiner.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 5. Footer Operational Note */}
            <div className="pt-3 border-t border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="text-[11px] leading-relaxed">
                Formula: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px]">sum(servedKg) / sum(actualDiners) × expectedDiners</code>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-8 text-xs font-semibold self-end sm:self-auto"
              >
                Close Explanation
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
