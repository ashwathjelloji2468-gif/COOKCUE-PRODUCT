import React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getContractorPortalData } from "@/server/actions/contractor-portal";
import { getContractorExceptions } from "@/server/actions/exceptions";
import { getContractorWeeklyScorecard } from "@/server/actions/scorecard";
import { ExceptionInbox } from "@/components/exceptions/ExceptionInbox";
import { WeeklyScorecard } from "@/components/contractor/WeeklyScorecard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserMenu } from "@/components/layout/UserMenu";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AmbientBackground, FadeIn, HoverLift } from "@/components/motion";
import {
  Building2,
  UtensilsCrossed,
  Activity,
  CalendarDays,
  TrendingUp,
  ClipboardCheck,
  ArrowLeft,
  MapPin,
  AlertTriangle,
  Layers,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

type Props = {
  params: Promise<{ contractorId: string }>;
};

export default async function ContractorPortalPage({ params }: Props) {
  const { contractorId } = await params;
  const [res, exceptionsRes, scorecardRes] = await Promise.all([
    getContractorPortalData(contractorId),
    getContractorExceptions(contractorId),
    getContractorWeeklyScorecard(contractorId),
  ]);

  if (!res.success) {
    if (res.statusCode === 401) {
      redirect("/login");
    }
    if (res.statusCode === 404) {
      notFound();
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)] text-[var(--foreground)]">
        <Card className="max-w-md w-full border-border p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="font-heading font-bold text-lg">Access Denied</h1>
          <p className="text-xs text-muted-foreground">{res.error}</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/login">Return to Sign In</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const { contractor, counts, kitchens, isFounder } = res.data;
  const exceptions = exceptionsRes.success ? exceptionsRes.data : [];
  const scorecard = scorecardRes.success ? scorecardRes.data : null;

  return (
    <div
      className="min-h-screen text-[var(--foreground)] flex flex-col transition-colors relative overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      <AmbientBackground variant="surface" showGrid={false} />
      {/* Top Header */}
      <header
        className="sticky top-0 z-30 h-16 border-b backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors"
        style={{
          background: "var(--header-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center p-1 shadow-xs">
              <Image
                src="/cookcue-logo.png"
                alt="CookCue"
                width={28}
                height={28}
                className="h-6 w-auto object-contain"
                priority
              />
            </div>
            <span className="font-heading font-bold text-sm tracking-tight text-foreground hidden sm:inline-block">
              CookCue
            </span>
          </Link>
          <span className="text-border hidden sm:inline-block">/</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-card text-foreground border border-border shadow-xs">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>Contractor Portal</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isFounder && (
            <Link
              href={`/founder/contractors/${contractor.id}`}
              aria-label="Back to Founder Console"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors font-medium mr-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Founder Console</span>
            </Link>
          )}
          <ThemeToggle />
          <div className="w-auto sm:w-40">
            <UserMenu variant="light" />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative z-10">
        <FadeIn direction="up" distance={10} duration={0.35} className="space-y-8">
        {/* Organization Banner */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6 border-b border-[var(--card-border)]">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--card)] border border-[var(--card-border)] flex items-center justify-center shadow-xs shrink-0">
              <Building2 className="w-7 h-7 text-[var(--accent)]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)] font-mono">
                  Dedicated Organization Portfolio
                </span>
              </div>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--foreground)]">
                {contractor.name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge
                  status={contractor.status === "ACTIVE" ? "active" : "inactive"}
                  label={contractor.status}
                />
                <span className="text-xs text-[var(--muted)] font-mono">
                  Contractor ID: <strong className="text-[var(--foreground)]">{contractor.code || "Not provided"}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Organization Record Details */}
        <Card className="border-[var(--card-border)] bg-[var(--card)] p-5 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[var(--muted)] block mb-1 uppercase tracking-wider font-semibold">
                Contractor ID
              </span>
              <span className="font-mono text-sm font-bold text-[var(--foreground)]">
                {contractor.code || "Not provided"}
              </span>
              <span className="text-xs text-[var(--foreground)]/80 font-mono block mt-1">
                Internal cuid: <code className="font-semibold text-[var(--foreground)] bg-[var(--background)] px-1.5 py-0.5 rounded border border-[var(--card-border)] select-all">{contractor.id}</code>
              </span>
            </div>

            <div>
              <span className="text-[var(--muted)] block mb-1 uppercase tracking-wider font-semibold">
                Primary Contact
              </span>
              <span className="text-sm font-medium text-[var(--foreground)]">
                {contractor.primaryContactName || "Not provided"}
              </span>
            </div>

            <div>
              <span className="text-[var(--muted)] block mb-1 uppercase tracking-wider font-semibold">
                Official Email
              </span>
              <span className="font-mono text-xs text-[var(--foreground)]">
                {contractor.contactEmail || "Not provided"}
              </span>
            </div>

            <div>
              <span className="text-[var(--muted)] block mb-1 uppercase tracking-wider font-semibold">
                Contact Phone
              </span>
              <span className="font-mono text-xs text-[var(--foreground)]">
                {contractor.contactPhone || "Not provided"}
              </span>
            </div>

            <div className="sm:col-span-2 md:col-span-4 pt-2 border-t border-[var(--card-border)]">
              <span className="text-[var(--muted)] block mb-0.5 uppercase tracking-wider font-semibold">
                Registered Address
              </span>
              <span className="text-xs text-[var(--foreground)]">
                {contractor.address || "Not provided"}
              </span>
            </div>
          </div>
        </Card>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Assigned Kitchens"
            value={counts.kitchenCount}
            unit="facilities"
            icon={<UtensilsCrossed className="w-4 h-4 text-[var(--accent)]" />}
          />
          <MetricCard
            label="Services Logged"
            value={counts.observationCount}
            unit="observations"
            icon={<Activity className="w-4 h-4 text-[var(--accent)]" />}
          />
          <MetricCard
            label="Stockout Incidents"
            value={counts.stockoutCount}
            unit="recorded"
            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
            status={counts.stockoutCount > 0 ? "warning" : "normal"}
          />
        </div>

        {/* Operational Exceptions Inbox: Needs Attention */}
        <ExceptionInbox exceptions={exceptions} />

        {/* Weekly Kitchen Discipline Scorecard */}
        {scorecard && <WeeklyScorecard scorecard={scorecard} isFounder={isFounder} />}

        {/* Provisioned Kitchens Table / Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-xl font-bold text-[var(--foreground)]">
                Operational Kitchen Facilities
              </h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Kitchen stations and meal production hubs provisioned for {contractor.name}
              </p>
            </div>
          </div>

          {kitchens.length === 0 ? (
            <Card className="cc-card border-border bg-card p-8">
              <EmptyState
                icon={<UtensilsCrossed className="w-10 h-10 text-muted-foreground" />}
                title="No kitchens yet"
                description="No kitchen facilities have been provisioned under this contractor organization yet."
                steps={[
                  "Founder or Admin provisions kitchen facility",
                  "Kitchen staff complete morning plans & closeouts",
                  "Facility performance populates here",
                ]}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kitchens.map((k) => (
                <HoverLift key={k.id} y={-3} className="h-full">
                  <Card
                    className="cc-card border-border bg-card hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between h-full"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base font-heading font-bold text-foreground">
                            {k.name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{k.location || "Location: Not provided"}</span>
                          </CardDescription>
                        </div>
                        <div className="shrink-0">
                          <StatusBadge
                            status={k.status === "ACTIVE" ? "active" : "inactive"}
                            label={k.status}
                          />
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-1">
                      <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border bg-muted/40 rounded-lg px-3">
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                            Total Services
                          </span>
                          <span className="font-heading cc-num font-bold text-sm text-foreground">
                            {k.observationCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                            Stockouts
                          </span>
                          <span className="font-heading cc-num font-bold text-sm text-amber-600 dark:text-amber-400">
                            {k.stockoutCount}
                          </span>
                        </div>
                      </div>

                      {/* Freshness & Reliability Signals */}
                      <div className="space-y-1 py-1.5 px-2.5 bg-[var(--background)]/40 rounded-md border border-[var(--card-border)]/60 text-[11px]">
                        <div className="flex items-center justify-between text-[var(--muted)]">
                          <span>Last closeout:</span>
                          <span
                            className={k.isStale ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-[var(--foreground)] font-medium"}
                            title={k.lastCloseoutExact || "No closeout recorded yet"}
                          >
                            {k.lastCloseoutRelative}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[var(--muted)]">
                          <span>Discipline:</span>
                          {k.isBaselineReady ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> Baseline ready
                            </span>
                          ) : (
                            <span className="text-[var(--muted)] text-[10px] font-mono">
                              {k.eligibleCount}/3 for baseline
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <Button asChild size="sm" variant="outline" className="text-xs h-8 px-2 border-[var(--card-border)] hover:bg-[var(--accent-soft)]">
                          <Link href={`/kitchen/${k.id}/morning`} title="Morning Cooking Plan">
                            <ClipboardCheck className="w-3.5 h-3.5 mr-1 text-[var(--accent)]" />
                            <span>Morning</span>
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="text-xs h-8 px-2 border-[var(--card-border)] hover:bg-[var(--accent-soft)]">
                          <Link href={`/kitchen/${k.id}/closeout`} title="Evening Closeout">
                            <CalendarDays className="w-3.5 h-3.5 mr-1 text-[var(--accent)]" />
                            <span>Closeout</span>
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="text-xs h-8 px-2 border-[var(--card-border)] hover:bg-[var(--accent-soft)]">
                          <Link href={`/kitchen/${k.id}/forecast`} title="Forecasting & Models">
                            <TrendingUp className="w-3.5 h-3.5 mr-1 text-[var(--accent)]" />
                            <span>Forecast</span>
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </HoverLift>
              ))}
            </div>
          )}
        </div>
        </FadeIn>
      </main>
    </div>
  );
}
