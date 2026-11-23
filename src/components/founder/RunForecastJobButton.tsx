"use client";

import React, { useState } from "react";
import { runForecastPrecomputeJob, type PrecomputeForecastResult } from "@/server/actions/forecast";
import { Button } from "@/components/ui/button";
import { TrendingUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface RunForecastJobButtonProps {
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function RunForecastJobButton({
  className = "",
  variant = "default",
  size = "sm",
}: RunForecastJobButtonProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PrecomputeForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await runForecastPrecomputeJob();
      if (!res.success) {
        setError(res.error);
      } else {
        setResult(res.data);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to execute forecast job");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
      <Button
        onClick={handleRun}
        disabled={running}
        variant={variant}
        size={size}
        className={`gap-2 font-semibold shadow-xs ${className}`}
      >
        {running ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-foreground" />
        ) : (
          <TrendingUp className="w-3.5 h-3.5" />
        )}
        <span>{running ? "Precomputing Forecasts..." : "Run forecast job"}</span>
      </Button>

      {result && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            Forecast job complete: {result.kitchensProcessed} kitchens, {result.snapshotsCreated} snapshots ({result.durationMs}ms)
          </span>
        </div>
      )}

      {error && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold animate-in fade-in duration-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
