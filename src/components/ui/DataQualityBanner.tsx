import React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";

export interface DataQualityBannerProps {
  totalObservations: number;
  eligibleObservations: number;
  stockoutCount: number;
  abnormalCount: number;
  missingCount?: number;
  className?: string;
}

export function DataQualityBanner({
  totalObservations,
  eligibleObservations,
  stockoutCount,
  abnormalCount,
  missingCount = 0,
  className,
}: DataQualityBannerProps) {
  const issuesCount = stockoutCount + abnormalCount + missingCount;
  const isHealthy = issuesCount === 0 && eligibleObservations > 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors",
        isHealthy
          ? "bg-emerald-50/40 border-emerald-200/80 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800/60 dark:text-emerald-200"
          : "bg-amber-50/40 border-amber-200/80 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "p-2 rounded-lg shrink-0 mt-0.5",
            isHealthy
              ? "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
              : "bg-amber-100/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
          )}
        >
          {isHealthy ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <ShieldAlert className="w-5 h-5" />
          )}
        </div>
        <div>
          <h4 className="font-heading font-semibold text-sm">
            {isHealthy
              ? "Observation Data Quality is Healthy"
              : "Data Quality & Exclusion Notice"}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl leading-relaxed">
            {isHealthy
              ? `${eligibleObservations} of ${totalObservations} recorded observations meet all eligibility criteria for pure baseline calculations.`
              : `${issuesCount} observation records have been filtered from baseline recommendations to prevent underestimating true demand.`}
          </p>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2 text-xs font-mono tabular-nums shrink-0">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-border text-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Eligible: <strong>{eligibleObservations}</strong></span>
        </span>

        {stockoutCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>Stockouts: <strong>{stockoutCount}</strong></span>
          </span>
        )}

        {abnormalCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 font-medium">
            <AlertCircle className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
            <span>Abnormal: <strong>{abnormalCount}</strong></span>
          </span>
        )}
      </div>
    </div>
  );
}
