import { FounderShell } from "@/components/layout/FounderShell";
import { KitchenSearchForm } from "@/components/founder/KitchenSearchForm";
import { DemoWalkthroughCard } from "@/components/founder/DemoWalkthroughCard";
import { getPlatformMonitoringSummary, type MonitoringSummary } from "@/server/actions/monitoring";
import { listContractors } from "@/server/actions/contractor";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { Building2, Utensils, CheckCircle2, AlertTriangle, ArrowRight, Plus, ExternalLink } from "lucide-react";

export default async function FounderDashboardPage() {
  const [monitoringRes, contractorsRes] = await Promise.all([
    getPlatformMonitoringSummary(),
    listContractors(),
  ]);

  // Fail-safe: if query fails, default strictly to 0 and empty list (never mock/demo numbers)
  const stats: MonitoringSummary = monitoringRes.success
    ? monitoringRes.data
    : {
        totalKitchens: 0,
        totalActiveKitchens: 0,
        totalObservations: 0,
        totalStockouts: 0,
        totalAbnormal: 0,
        totalEligible: 0,
        kitchens: [],
      };

  const contractors = contractorsRes.success ? contractorsRes.data : [];

  return (
    <FounderShell
      title="Platform Operations Overview"
      subtitle="Multi-tenant institutional kitchen portfolio, data hygiene & telemetry monitoring"
    >
      <div className="space-y-8">
        {/* Metric Cards Row - Live Database Telemetry */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
          <MetricCard
            label="Active Kitchens"
            value={stats.totalActiveKitchens}
            unit="facilities"
            icon={<Utensils className="w-4 h-4 text-[var(--accent)]" />}
          />
          <MetricCard
            label="Total Services Logged"
            value={stats.totalObservations}
            unit="records"
            icon={<Building2 className="w-4 h-4 text-[var(--accent)]" />}
          />
          <MetricCard
            label="Eligible Observations"
            value={stats.totalEligible}
            unit="qualifying"
            icon={<CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />}
            status="success"
          />
          <MetricCard
            label="Stockout Incidents"
            value={stats.totalStockouts}
            unit="alerts"
            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
            status={stats.totalStockouts > 0 ? "warning" : "normal"}
          />
        </div>

        {/* Quick Actions & Search */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
          <div className="lg:col-span-2 min-w-0 space-y-6">
            <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
              <CardHeader className="pb-3 border-b border-[var(--card-border)]">
                <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
                  Kitchen Lookup
                </CardTitle>
                <CardDescription className="text-xs text-[var(--muted)]">
                  Search active kitchen facilities across contractor accounts.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <KitchenSearchForm />
              </CardContent>
            </Card>

            {/* Kitchen Facility Health */}
            <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)] overflow-hidden">
              <CardHeader className="pb-3 border-b border-[var(--card-border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
                      Kitchen Facility Health
                    </CardTitle>
                    <CardDescription className="text-xs text-[var(--muted)]">
                      Live data hygiene &amp; service log activity per kitchen facility from database.
                    </CardDescription>
                  </div>
                  <Link
                    href="/founder/audit-log"
                    className="text-xs text-[var(--accent)] hover:underline font-semibold inline-flex items-center gap-1 group"
                  >
                    <span>Full Audit Log</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[var(--background)] text-[var(--muted)] uppercase tracking-wider text-[10px] border-b border-[var(--card-border)] font-semibold">
                      <tr>
                        <th className="py-3 px-4">Kitchen Facility</th>
                        <th className="py-3 px-3">Last Closeout</th>
                        <th className="py-3 px-3">Last Plan</th>
                        <th className="py-3 px-3 text-right">Eligible</th>
                        <th className="py-3 px-3 text-right">Stockouts</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--card-border)]">
                      {stats.kitchens.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-[var(--muted)] italic">
                            No kitchen facilities found in database.
                          </td>
                        </tr>
                      ) : (
                        stats.kitchens.map((k) => (
                          <tr key={k.kitchenId} className="hover:bg-[var(--accent-soft)] transition-colors">
                            <td className="py-3 px-4 font-heading font-bold text-[var(--foreground)]">
                              <Link
                                href={`/founder/kitchens/${k.kitchenId}`}
                                className="hover:underline text-[var(--accent)] inline-flex items-center gap-1.5"
                              >
                                {k.kitchenName}
                                <ExternalLink className="w-3 h-3 text-[var(--muted)] opacity-60" />
                              </Link>
                            </td>
                            <td className="py-3 px-3 text-[var(--muted)]">
                              <span
                                className={`text-[11px] ${k.isStale ? "text-amber-600 dark:text-amber-400 font-semibold" : "font-mono"}`}
                                title={k.lastCloseoutExact || "No closeouts recorded yet"}
                              >
                                {k.lastCloseoutRelative}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[var(--muted)]">
                              <span
                                className="text-[11px] font-mono"
                                title={k.lastPlanApprovedExact || "No approved cooking plan recorded yet"}
                              >
                                {k.lastPlanApprovedRelative}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-[var(--accent)] font-bold">
                              {k.eligibleCount}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
                              {k.stockoutCount}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {k.isStale ? (
                                <StatusBadge
                                  status="abnormal"
                                  label="Stale Closeout"
                                />
                              ) : (
                                <StatusBadge
                                  status={k.status === "ACTIVE" ? (k.isBaselineReady ? "eligible" : "active") : "inactive"}
                                  label={k.status === "ACTIVE" ? (k.isBaselineReady ? "Baseline Ready" : `Learning (${k.eligibleCount}/3)`) : k.status}
                                />
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Walkthrough & Contractors Quick List */}
          <div className="min-w-0 space-y-5">
            <DemoWalkthroughCard />

            <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
              <CardHeader className="pb-3 border-b border-[var(--card-border)] flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
                    Contractors
                  </CardTitle>
                  <CardDescription className="text-xs text-[var(--muted)]">
                    Partner catering organizations
                  </CardDescription>
                </div>
                <Link
                  href="/founder/contractors/new"
                  className="p-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors shadow-xs"
                  title="Onboard Contractor"
                  aria-label="Onboard new contractor"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {contractors.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--muted)] space-y-2">
                    <Building2 className="w-8 h-8 mx-auto text-[var(--muted)] opacity-50" />
                    <p className="font-medium">No contractors registered yet.</p>
                    <p className="text-[11px] opacity-80">Onboard a contractor to begin provisioning kitchens.</p>
                  </div>
                ) : (
                  contractors.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border border-[var(--card-border)] bg-[var(--background)] hover:bg-[var(--accent-soft)] transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <Link
                          href={`/founder/contractors/${c.id}`}
                          title={c.name}
                          className="font-heading font-bold text-xs text-[var(--foreground)] hover:underline hover:text-[var(--accent)] truncate block"
                        >
                          {c.name}
                        </Link>
                        <span className="text-[10px] text-[var(--muted)] font-mono">
                          ID: {c.code ?? c.id}
                        </span>
                      </div>
                      <StatusBadge
                        status={c.status === "ACTIVE" ? "active" : "inactive"}
                        label={c.status}
                      />
                    </div>
                  ))
                )}
                {contractors.length > 0 && (
                  <div className="pt-2">
                    <Link
                      href="/founder/contractors"
                      className="text-xs text-[var(--accent)] hover:underline font-semibold inline-flex items-center gap-1 group"
                    >
                      <span>View all {contractors.length} contractors</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </FounderShell>
  );
}
