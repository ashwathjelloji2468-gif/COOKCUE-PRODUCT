import { getPlatformMonitoringSummary } from "@/server/actions/monitoring";
import { getPlatformExceptions } from "@/server/actions/exceptions";
import { getPlatformWeeklyScorecard } from "@/server/actions/scorecard";
import { ExceptionInbox } from "@/components/exceptions/ExceptionInbox";
import { WeeklyScorecard } from "@/components/contractor/WeeklyScorecard";
import Link from "next/link";
import { FounderShell } from "@/components/layout/FounderShell";
import { Activity, AlertTriangle, CheckCircle2, Database, ChevronRight, UtensilsCrossed } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataQualityBanner } from "@/components/ui/DataQualityBanner";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { RunForecastJobButton } from "@/components/founder/RunForecastJobButton";
import { RunOperationalRemindersButton } from "@/components/founder/RunOperationalRemindersButton";

export default async function MonitoringPage() {
  const [res, exceptionsRes, scorecardRes] = await Promise.all([
    getPlatformMonitoringSummary(),
    getPlatformExceptions(),
    getPlatformWeeklyScorecard(),
  ]);
  const data = res.success ? res.data : null;
  const exceptions = exceptionsRes.success ? exceptionsRes.data : [];
  const scorecard = scorecardRes.success
    ? {
        weekStart: scorecardRes.data.weekStart,
        weekEnd: scorecardRes.data.weekEnd,
        contractor: { id: "platform", name: "All Platform Kitchens" },
        kitchens: scorecardRes.data.kitchens,
      }
    : null;

  return (
    <FounderShell
      title="Platform Monitoring & Data Quality"
      subtitle="Platform-wide observation telemetry, verified learning volume, and stockout audits"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <RunForecastJobButton />
          <RunOperationalRemindersButton />
        </div>
      }
    >
      {!data ? (
        <p className="text-destructive text-sm font-medium">Failed to load platform monitoring data.</p>
      ) : (
        <div className="space-y-8">
          {/* KPI Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              label="Kitchens"
              value={data.totalKitchens}
              icon={<Database className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />}
            />
            <MetricCard
              label="Total Records"
              value={data.totalObservations}
              icon={<Activity className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />}
            />
            <MetricCard
              label="Eligible Data"
              value={data.totalEligible}
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />}
              status="success"
            />
            <MetricCard
              label="Stockout Incidents"
              value={data.totalStockouts}
              icon={<AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400" />}
              status={data.totalStockouts > 0 ? "warning" : "normal"}
            />
            <MetricCard
              label="Abnormal Events"
              value={data.totalAbnormal}
              icon={<AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400" />}
              status={data.totalAbnormal > 0 ? "danger" : "normal"}
            />
          </div>

          <DataQualityBanner
            totalObservations={data.totalObservations}
            eligibleObservations={data.totalEligible}
            stockoutCount={data.totalStockouts}
            abnormalCount={data.totalAbnormal}
          />

          {/* Operational Exceptions: Platform Needs Attention */}
          <ExceptionInbox
            exceptions={exceptions}
            title="Platform Operational Exceptions"
            subtitle="Real-time exceptions across all kitchens requiring attention"
          />

          {/* Weekly Kitchen Discipline Scorecard */}
          {scorecard && <WeeklyScorecard scorecard={scorecard} isFounder={true} />}

          {/* Kitchens Audit Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">
                  Kitchen Telemetry Audits
                </h2>
                <p className="text-xs text-muted-foreground">
                  Select a kitchen to inspect chronological observation weights and data hygiene.
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {data.kitchens.length} Active Stations
              </span>
            </div>

            {data.kitchens.length === 0 ? (
              <EmptyState
                icon={<UtensilsCrossed className="w-10 h-10 text-muted-foreground" />}
                title="No operational data recorded yet"
                description="Once kitchens complete morning plans and evening closeouts, their observation audit will appear here."
              />
            ) : (
              <div className="grid gap-3">
                {data.kitchens.map((k) => (
                  <Card key={k.kitchenId} className="cc-card border-border hover:border-foreground/30 transition-all p-0">
                    <Link
                      href={`/founder/monitoring/${k.kitchenId}`}
                      className="flex items-center justify-between p-5 group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                            {k.kitchenName}
                          </h3>
                          <span className="text-xs font-mono text-muted-foreground">
                            {k.kitchenId}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-3 tabular-nums cc-num">
                          <span>Observations: <strong className="text-foreground">{k.observationCount}</strong></span>
                          <span>•</span>
                          <span>Eligible: <strong className="text-emerald-700 dark:text-emerald-400">{k.eligibleCount}</strong></span>
                          <span>•</span>
                          <span>Stockouts: <strong className="text-amber-700 dark:text-amber-400">{k.stockoutCount}</strong></span>
                          <span>•</span>
                          <span>Abnormal: <strong className="text-red-700 dark:text-red-400">{k.abnormalCount}</strong></span>
                        </p>
                        {k.lastCloseoutAt && (
                          <p className="text-[11px] text-muted-foreground/75 font-mono">
                            Latest Closeout: {new Date(k.lastCloseoutAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </FounderShell>
  );
}
