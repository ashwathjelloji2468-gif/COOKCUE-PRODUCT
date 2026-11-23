"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getKitchenObservationStats,
  forecastForKitchen,
  getLatestForecastSnapshots,
  type PrecomputedSnapshotItem,
} from "@/server/actions/forecast";
import {
  TrendingUp,
  Database,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Users,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/MetricCard";
import { QuantityDisplay } from "@/components/ui/QuantityDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataQualityBanner } from "@/components/ui/DataQualityBanner";
import { motion, AnimatePresence } from "motion/react";
import { HoverLift, OneShotBadge } from "@/components/motion";

type Stats = {
  totalObservations: number;
  eligibleObservations: number;
  dishes: {
    dishId: string;
    dishName: string;
    observationCount: number;
    lastServedPerDiner: number | null;
  }[];
};

type ForecastItem = {
  dishId: string;
  dishName: string;
  recommendedKg: number | null;
  eligibleCount: number;
  exclusionReasons: string[];
  servedPerDiner: number | null;
  status?: string;
  statusReason?: string;
  isPrecomputed?: boolean;
};

export function ForecastPanel({ kitchenId }: { kitchenId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [mealType, setMealType] = useState("LUNCH");
  const [expectedDiners, setExpectedDiners] = useState(50);
  const [forecast, setForecast] = useState<ForecastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Precomputed snapshot state
  const [precomputedSnapshots, setPrecomputedSnapshots] = useState<PrecomputedSnapshotItem[]>([]);
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<string | null>(null);
  const [snapshotDiners, setSnapshotDiners] = useState<number | null>(null);
  const [isViewingSnapshot, setIsViewingSnapshot] = useState(false);

  // Load observation stats
  useEffect(() => {
    getKitchenObservationStats(kitchenId).then((res) => {
      if (res.success) setStats(res.data);
    });
  }, [kitchenId]);

  // Load latest precomputed forecast snapshots for this meal type
  const loadSnapshots = useCallback(async () => {
    try {
      const res = await getLatestForecastSnapshots(kitchenId, mealType);
      if (res.success && res.data.length > 0) {
        setPrecomputedSnapshots(res.data);
        setSnapshotTimestamp(res.latestComputedAt);
        setSnapshotDiners(res.expectedDiners);
      } else {
        setPrecomputedSnapshots([]);
        setSnapshotTimestamp(null);
        setSnapshotDiners(null);
      }
    } catch {
      // Ignore background fetch error
    }
  }, [kitchenId, mealType]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  // Live on-demand calculate
  async function handleForecast() {
    setLoading(true);
    setError(null);
    setIsViewingSnapshot(false);
    setForecast([]);

    const res = await forecastForKitchen(kitchenId, mealType, expectedDiners);
    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }
    setForecast(res.data);
  }

  // Load precomputed snapshot into view
  function handleLoadPrecomputed() {
    if (precomputedSnapshots.length === 0) return;
    setError(null);
    setIsViewingSnapshot(true);
    if (snapshotDiners) {
      setExpectedDiners(snapshotDiners);
    }

    setForecast(
      precomputedSnapshots.map((s) => ({
        dishId: s.dishId,
        dishName: s.dishName,
        recommendedKg: s.recommendedKg,
        eligibleCount: s.eligibleCount,
        exclusionReasons: [],
        servedPerDiner: null,
        status: s.recommendedKg !== null ? "OK" : "INSUFFICIENT_HISTORY",
        isPrecomputed: true,
      }))
    );
  }

  const excludedCount = stats ? stats.totalObservations - stats.eligibleObservations : 0;

  return (
    <div className="space-y-8">
      {/* 1. Historical Observation Health Summary */}
      <div className="space-y-4">
        <div>
          <h3 className="font-heading font-bold text-foreground text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <span>Historical Service Data Quality</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review observation counts and verified consumption rates per diner.
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Total Observations"
              value={stats.totalObservations}
              unit="records"
              icon={<Database className="w-4 h-4 text-primary" />}
            />
            <MetricCard
              label="Eligible Observations"
              value={stats.eligibleObservations}
              unit="services"
              icon={<CheckCircle2 className="w-4 h-4 text-primary" />}
              status="success"
            />
            <MetricCard
              label="Filtered / Excluded"
              value={excludedCount}
              unit="exceptions"
              icon={<AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
              status={excludedCount > 0 ? "warning" : "normal"}
            />
            <MetricCard
              label="Active Dishes"
              value={stats.dishes.length}
              unit="items"
              icon={<TrendingUp className="w-4 h-4 text-primary" />}
            />
          </div>
        )}

        {stats && (
          <DataQualityBanner
            totalObservations={stats.totalObservations}
            eligibleObservations={stats.eligibleObservations}
            stockoutCount={excludedCount}
            abnormalCount={0}
          />
        )}

        {/* Per-Dish Historical Breakdown */}
        {stats && stats.dishes.length > 0 && (
          <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold font-heading">Average Served Per Diner by Dish</CardTitle>
              <CardDescription className="text-xs">
                Derived strictly from eligible historical services with complete food weight data.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {stats.dishes.map((d) => (
                  <div
                    key={d.dishId}
                    className="p-4 flex items-center justify-between text-sm hover:bg-muted/25 transition-colors"
                  >
                    <div>
                      <p className="font-heading font-bold text-foreground text-sm">{d.dishName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {d.observationCount} total closeouts logged
                      </p>
                    </div>
                    <div className="text-right">
                      {d.lastServedPerDiner !== null ? (
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Avg Served / Diner</span>
                          <span className="font-mono font-bold text-foreground text-sm tabular-nums">
                            {d.lastServedPerDiner.toFixed(3)} kg
                          </span>
                        </div>
                      ) : (
                        <StatusBadge status="missing" label="Insufficient data" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Precomputed Snapshot Banner (if available) */}
      {precomputedSnapshots.length > 0 && (
        <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <Layers className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="font-heading font-bold text-foreground text-sm">
                    Precomputed Forecast Snapshot Available
                  </h4>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    {precomputedSnapshots.length} Dishes
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Calculated {snapshotTimestamp ? new Date(snapshotTimestamp).toLocaleString() : "recently"} for {snapshotDiners ?? 100} expected diners.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadPrecomputed}
              className="gap-2 shrink-0 font-semibold text-xs h-9 border-primary/30 text-primary hover:bg-primary/10"
            >
              <span>Load Precomputed Snapshot</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 2. Pure Baseline Forecast Generator (Live on-demand) */}
      <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold font-heading flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span>Next-Day Pure Baseline Forecast</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Project production requirements based on current verified averages. No black-box multipliers applied.
              </CardDescription>
            </div>
            {isViewingSnapshot && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-mono">
                <Clock className="w-3.5 h-3.5" />
                Snapshot View
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="forecast-meal-type" className="block text-[11px] font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                Service Type
              </label>
              <select
                id="forecast-meal-type"
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-colors font-medium"
              >
                <option value="BREAKFAST">Breakfast</option>
                <option value="LUNCH">Lunch</option>
                <option value="DINNER">Dinner</option>
              </select>
            </div>
            <div>
              <label htmlFor="forecast-expected-diners" className="block text-[11px] font-semibold text-foreground mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>Expected Diners</span>
              </label>
              <input
                id="forecast-expected-diners"
                type="number"
                min={0}
                value={expectedDiners}
                onChange={(e) => setExpectedDiners(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-colors tabular-nums font-mono font-bold"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <Button
              onClick={handleForecast}
              disabled={loading}
              size="lg"
              className="gap-2 shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6"
            >
              <Sparkles className="w-4 h-4 text-[#D9EF79]" />
              <span>{loading ? "Calculating Pure Baselines..." : "Generate Live Baseline Forecast"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Output */}
      {forecast.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div>
              <h3 className="font-heading font-bold text-foreground text-lg flex items-center gap-2">
                <span>Projected Pure Baseline Targets</span>
                {isViewingSnapshot && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                    From Snapshot
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isViewingSnapshot
                  ? `Loaded from precomputed database snapshot calculated for ${expectedDiners} diners.`
                  : `Computed on-demand using live historical observations for ${expectedDiners} expected diners.`}
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-muted text-muted-foreground border border-border/60 tabular-nums">
              For {expectedDiners} Expected Diners
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {forecast.map((f) => (
              <HoverLift key={f.dishId} y={-3}>
                <Card className="p-5 border-border/80 bg-card shadow-xs rounded-xl flex flex-col justify-between hover:border-foreground/20 hover:shadow-sm transition-all h-full">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-heading font-bold text-foreground text-base">
                      {f.dishName}
                    </h4>
                    {f.recommendedKg !== null ? (
                      <StatusBadge status="eligible" label="Eligible Baseline" />
                    ) : f.status === "INVALID_TARGET" ? (
                      <StatusBadge status="missing" label="Invalid Target" />
                    ) : (
                      <StatusBadge status="missing" label="Insufficient History" />
                    )}
                  </div>

                  <div className="mt-4">
                    {f.recommendedKg !== null ? (
                      <div>
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider block font-semibold">
                          Projected Requirement
                        </span>
                        <div className="mt-1">
                          <QuantityDisplay value={f.recommendedKg} unit="kg" size="xl" />
                        </div>
                      </div>
                    ) : f.status === "INVALID_TARGET" ? (
                      <div className="p-3.5 bg-red-50 rounded-lg border border-red-200 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 mt-2">
                        <p className="font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
                          <span>Invalid Target Parameter</span>
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          {f.statusReason || "Expected diners must be a positive integer."}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 mt-2">
                        <p className="font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                          <span>Insufficient-history state</span>
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          Requires at least 3 normal eligible closeouts before baseline can be automatically generated.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-border/60 text-xs text-muted-foreground space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span>Eligible observations:</span>
                    <strong className="font-mono text-foreground font-semibold tabular-nums">{f.eligibleCount}</strong>
                  </div>
                  {f.servedPerDiner !== null && (
                    <div className="flex items-center justify-between">
                      <span>Estimated served quantity per diner:</span>
                      <strong className="font-mono text-foreground font-semibold tabular-nums">{f.servedPerDiner.toFixed(3)} kg</strong>
                    </div>
                  )}
                  {f.exclusionReasons.length > 0 && (
                    <div className="pt-1 text-[11px] text-red-700 dark:text-red-400 font-medium">
                      Exclusions: {Array.from(new Set(f.exclusionReasons)).join(", ")}
                    </div>
                  )}
                </div>
              </Card>
            </HoverLift>
          ))}
        </div>
        </div>
      )}

      {/* Error alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 text-sm flex items-start gap-2.5 font-medium shadow-2xs"
          >
            <AlertCircle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
