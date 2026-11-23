"use client";

import { useState, useEffect, useCallback } from "react";
import { getKitchenResultsDashboard, type KitchenResultsDashboardData } from "@/server/actions/kitchen-results";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Scale,
  TrendingDown,
  AlertTriangle,
  History,
  CheckCircle2,
  Filter,
  RefreshCw,
  Info,
  Sparkles,
} from "lucide-react";

export function KitchenResultsDashboard({ kitchenId }: { kitchenId: string }) {
  const [data, setData] = useState<KitchenResultsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mealType, setMealType] = useState("ALL");
  const [dishId, setDishId] = useState("ALL");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getKitchenResultsDashboard({
      kitchenId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      mealType: mealType || undefined,
      dishId: dishId || undefined,
    });
    setLoading(false);

    if (!res.success) {
      setError(res.error);
    } else {
      setData(res.data);
    }
  }, [kitchenId, startDate, endDate, mealType, dishId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const summary = data?.summary;
  const records = data?.records || [];
  const dishes = data?.dishes || [];

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <Card className="border-border/80 shadow-xs p-4 bg-card rounded-xl">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span>Filters:</span>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="From Date"
                aria-label="Filter from date"
                className="h-9 text-xs w-36 font-mono font-medium"
              />
              <span className="text-xs text-muted-foreground font-medium">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="To Date"
                aria-label="Filter to date"
                className="h-9 text-xs w-36 font-mono font-medium"
              />
            </div>

            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              aria-label="Filter by meal service"
              className="h-9 text-xs rounded-lg border border-input bg-card px-3 text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
            >
              <option value="ALL">All Meal Services</option>
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="DINNER">Dinner</option>
              <option value="SNACKS">Snacks</option>
            </select>

            <select
              value={dishId}
              onChange={(e) => setDishId(e.target.value)}
              aria-label="Filter by dish"
              className="h-9 text-xs rounded-lg border border-input bg-card px-3 text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs max-w-[200px] truncate"
            >
              <option value="ALL">All Dishes</option>
              {dishes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            size="sm"
            onClick={loadDashboard}
            disabled={loading}
            className="h-9 text-xs gap-2 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs px-4"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D9EF79] ${loading ? "animate-spin" : ""}`} />
            <span>Apply Filters</span>
          </Button>
        </div>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 flex items-center gap-2.5 font-medium shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Actual Cooked */}
        <Card className="p-4 border-border/80 shadow-xs space-y-2 bg-card rounded-xl hover:border-foreground/20 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-primary" />
            <span>Actual Cooked</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-foreground tabular-nums tracking-tight">
            {summary?.totalCookedKg ?? 0} <span className="text-xs font-semibold text-muted-foreground">kg</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">Physical production</div>
        </Card>

        {/* Approved Target */}
        <Card className="p-4 border-border/80 shadow-xs space-y-2 bg-card rounded-xl hover:border-foreground/20 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            <span>Approved Target</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-foreground tabular-nums tracking-tight">
            {summary?.totalApprovedKg ?? 0} <span className="text-xs font-semibold text-muted-foreground">kg</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">Manager approved</div>
        </Card>

        {/* Suggested Baseline */}
        <Card className="p-4 border-border/80 shadow-xs space-y-2 bg-card rounded-xl hover:border-foreground/20 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Suggested Baseline</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-foreground tabular-nums tracking-tight">
            {summary?.totalSuggestedKg ?? 0} <span className="text-xs font-semibold text-muted-foreground">kg</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">Algorithm forecast</div>
        </Card>

        {/* Unserved Leftovers */}
        <Card className="p-4 border-border/80 shadow-xs space-y-2 bg-card rounded-xl hover:border-foreground/20 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>Unserved Leftovers</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-foreground tabular-nums tracking-tight">
            {summary?.totalLeftoverKg ?? 0} <span className="text-xs font-semibold text-muted-foreground">kg</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">
            {summary?.leftoverPerDiner !== null
              ? `${summary?.leftoverPerDiner} kg / diner`
              : "0 diners"}
          </div>
        </Card>

        {/* Stockout Incidents */}
        <Card className="p-4 border-border/80 shadow-xs space-y-2 bg-card rounded-xl hover:border-foreground/20 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Stockout Incidents</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-foreground tabular-nums tracking-tight">
            {summary?.stockoutCount ?? 0}
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">Food ran out</div>
        </Card>

        {/* Exceptions / Missing */}
        <Card className="p-4 border-border/80 shadow-xs space-y-2 bg-card rounded-xl hover:border-foreground/20 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Exceptions / Missing</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-foreground tabular-nums tracking-tight">
            {(summary?.abnormalCount ?? 0) + (summary?.missingCount ?? 0)}
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">
            {summary?.abnormalCount ?? 0} abnormal · {summary?.missingCount ?? 0} missing
          </div>
        </Card>
      </div>

      {/* Service Records Table */}
      {records.length === 0 ? (
        <EmptyState
          icon={<History className="w-10 h-10 text-muted-foreground" />}
          title="No service records matching criteria"
          description="Adjust your date or filter options above, or record completed services via the Evening Closeout station."
        />
      ) : (
        <Card className="border-border/80 shadow-xs rounded-xl overflow-hidden p-0 bg-card">
          <div className="px-5 py-3.5 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <span className="font-heading font-bold text-sm text-foreground">Operational History &amp; Lifecycles</span>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60 tabular-nums">
              {records.length} records
            </span>
          </div>

          {/* Mobile Cards (< sm) */}
          <div className="sm:hidden divide-y divide-border/60">
            {records.map((r) => (
              <div key={r.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-heading font-bold text-foreground text-sm">{r.dishName}</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted text-foreground border border-border/70">
                    {r.mealType}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <span>{r.date}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r.isStockout && <StatusBadge status="stockout" label="Stockout" />}
                    {r.isAbnormal && <StatusBadge status="abnormal" label="Abnormal" />}
                    {r.totalCookedKg === null && <StatusBadge status="missing" label="Missing Cooked" />}
                    {!r.isStockout && !r.isAbnormal && r.totalCookedKg !== null && (
                      <StatusBadge status="eligible" label="Eligible" />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Cooked</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {r.totalCookedKg !== null ? `${r.totalCookedKg.toFixed(1)} kg` : "Pending"}
                    </div>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Leftover</div>
                    <div className="font-mono text-muted-foreground mt-0.5">
                      {r.unservedLeftoverKg !== null ? `${r.unservedLeftoverKg.toFixed(1)} kg` : "—"}
                    </div>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Diners</div>
                    <div className="font-mono text-muted-foreground mt-0.5">
                      {r.actualDiners ?? "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono pt-0.5">
                  <span>Suggested: {r.suggestedKg !== null ? `${r.suggestedKg.toFixed(1)} kg` : "—"}</span>
                  <span>Approved: {r.approvedKg !== null ? `${r.approvedKg.toFixed(1)} kg` : "—"}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop & Tablet Table (sm+) */}
          <div className="hidden sm:block overflow-x-auto">
            <Table className="min-w-[850px]">
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">
                  <TableHead className="py-3 px-4">Date</TableHead>
                  <TableHead className="py-3 px-4">Service</TableHead>
                  <TableHead className="py-3 px-4">Dish</TableHead>
                  <TableHead className="py-3 px-4 text-right">Suggested</TableHead>
                  <TableHead className="py-3 px-4 text-right">Approved</TableHead>
                  <TableHead className="py-3 px-4 text-right">Cooked</TableHead>
                  <TableHead className="py-3 px-4 text-right">Leftover</TableHead>
                  <TableHead className="py-3 px-4 text-right">Actual Diners</TableHead>
                  <TableHead className="py-3 px-4 text-right">Leftover/Diner</TableHead>
                  <TableHead className="py-3 px-4 text-center">Service Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60">
                {records.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/25 transition-colors">
                    <TableCell className="py-3 px-4 font-mono text-xs tabular-nums text-muted-foreground">
                      {r.date}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted text-foreground border border-border/70">
                        {r.mealType}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-4 font-heading font-bold text-foreground text-xs">
                      {r.dishName}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {r.suggestedKg !== null ? `${r.suggestedKg.toFixed(1)} kg` : "—"}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right font-mono text-xs tabular-nums text-foreground font-semibold">
                      {r.approvedKg !== null ? `${r.approvedKg.toFixed(1)} kg` : "—"}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right font-mono text-xs tabular-nums text-foreground font-bold">
                      {r.totalCookedKg !== null ? `${r.totalCookedKg.toFixed(1)} kg` : "Pending"}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {r.unservedLeftoverKg !== null ? `${r.unservedLeftoverKg.toFixed(1)} kg` : "—"}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {r.actualDiners ?? "—"}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right font-mono text-xs tabular-nums text-muted-foreground font-medium">
                      {r.leftoverPerDiner !== null ? `${r.leftoverPerDiner.toFixed(3)} kg` : "—"}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {r.isStockout && <StatusBadge status="stockout" label="Stockout" />}
                        {r.isAbnormal && <StatusBadge status="abnormal" label="Abnormal" />}
                        {r.totalCookedKg === null && <StatusBadge status="missing" label="Missing Cooked" />}
                        {!r.isStockout && !r.isAbnormal && r.totalCookedKg !== null && (
                          <StatusBadge status="eligible" label="Eligible" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
