import React from "react";
import { Info, CheckCircle2, AlertTriangle, Calculator } from "lucide-react";

export function ProductPreview() {
  return (
    <div className="w-full max-w-3xl mx-auto rounded-xl border border-border bg-card shadow-sm overflow-hidden text-left">
      {/* Sample Header & Notice */}
      <div className="border-b border-border bg-muted/40 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-600" />
          <span className="font-semibold text-foreground tracking-tight">Recommendation Preview</span>
          <span className="text-muted-foreground font-mono text-[11px]">— Lunch Service</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-900 border border-amber-500/20 font-medium text-[11px]">
          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>Illustrative sample — not live kitchen data</span>
        </div>
      </div>

      <div className="p-5 sm:p-7 space-y-6">
        {/* Dish and Primary Output */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-5 border-b border-border/70">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Dish Item</div>
            <div className="text-xl sm:text-2xl font-heading font-bold text-foreground mt-0.5">Steamed Basmati Rice</div>
            <div className="text-xs text-muted-foreground mt-1">Measured in kilograms (kg)</div>
          </div>
          <div className="sm:text-right bg-muted/30 p-3 sm:p-0 rounded-lg sm:bg-transparent">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Suggested Preparation</div>
            <div className="text-3xl sm:text-4xl font-bold font-mono text-emerald-900 tracking-tight mt-0.5">
              24.0 <span className="text-base font-normal text-muted-foreground">kg</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Baseline for 120 expected diners</div>
          </div>
        </div>

        {/* Transparent Calculation Breakdown */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-primary" />
            Transparent Arithmetic
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border/80 bg-background p-3">
              <div className="text-[11px] text-muted-foreground">Historical Served</div>
              <div className="text-base font-semibold font-mono text-foreground mt-0.5">90.0 kg</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Total across past meals</div>
            </div>

            <div className="rounded-lg border border-border/80 bg-background p-3">
              <div className="text-[11px] text-muted-foreground">Historical Diners</div>
              <div className="text-base font-semibold font-mono text-foreground mt-0.5">450</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Logged attendance</div>
            </div>

            <div className="rounded-lg border border-border/80 bg-background p-3">
              <div className="text-[11px] text-muted-foreground">Served Per Diner</div>
              <div className="text-base font-semibold font-mono text-emerald-800 mt-0.5">0.200 kg</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">90.0 kg ÷ 450 diners</div>
            </div>

            <div className="rounded-lg border border-border/80 bg-background p-3">
              <div className="text-[11px] text-muted-foreground">Expected Diners</div>
              <div className="text-base font-semibold font-mono text-foreground mt-0.5">120</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Upcoming headcount</div>
            </div>
          </div>
        </div>

        {/* Observations & Exclusion Integrity */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <div className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Historical Evidence Pool</span>
            <span className="font-mono text-[11px] font-normal text-muted-foreground">3 of 4 records qualified</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-xs pt-1">
            <div className="flex items-start gap-2 text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong className="text-foreground font-medium">3 eligible services</strong> met all data quality and operational criteria.
              </span>
            </div>
            <div className="flex items-start gap-2 text-muted-foreground">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong className="text-foreground font-medium">1 service excluded</strong> due to recorded stockout flag (preventing artificially low baseline).
              </span>
            </div>
          </div>
        </div>

        {/* Explicit Manager Notice */}
        <div className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/70 pt-3 flex items-center justify-between">
          <span>Formula: 120 expected diners × 0.200 kg/diner = 24.0 kg recommended baseline.</span>
          <span className="font-medium text-foreground">Manager confirms final batch size</span>
        </div>
      </div>
    </div>
  );
}
