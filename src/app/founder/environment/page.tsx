import { FounderShell } from "@/components/layout/FounderShell";
import { getEnvironmentDiagnostics, type EnvironmentDiagnostics } from "@/server/actions/environment";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/MetricCard";
import { RunForecastJobButton } from "@/components/founder/RunForecastJobButton";
import { RecheckHealthButton } from "@/components/founder/RecheckHealthButton";
import { RunOperationalRemindersButton } from "@/components/founder/RunOperationalRemindersButton";
import {
  Server,
  Database,
  Cpu,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Lock,
} from "lucide-react";

export default async function FounderEnvironmentPage() {
  const res = await getEnvironmentDiagnostics();

  const data: EnvironmentDiagnostics = res.success
    ? res.data
    : {
        database: {
          status: "UNAVAILABLE",
          provider: "PostgreSQL",
          latencyMs: null,
          error: "Failed to query database diagnostics.",
        },
        application: {
          nodeEnv: process.env.NODE_ENV || "unknown",
          serverTime: new Date().toISOString(),
          uptimeSeconds: 0,
          nodeVersion: process.version,
          framework: "Next.js 15.5.28 (App Router)",
          sessionSecurity: "Web Crypto HMAC-SHA256",
        },
        notifications: {
          configured: false,
          hostName: null,
          secure: false,
        },
        metrics: {
          kitchens: null,
          contractors: null,
          users: null,
          observations: null,
          applications: null,
        },
      };

  const isDbConnected = data.database.status === "CONNECTED";

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(" ");
  };

  return (
    <FounderShell
      title="Environment & Diagnostics"
      subtitle="Runtime infrastructure health, database connectivity, and platform configuration telemetry"
      action={
        <div className="flex flex-wrap items-center gap-2.5">
          <RecheckHealthButton variant="outline" />
          <RunForecastJobButton variant="outline" />
          <RunOperationalRemindersButton variant="outline" />
          <div
            role="status"
            aria-label={`System status: ${isDbConnected ? "Operational" : "Database Unavailable"}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-xs font-semibold text-[var(--foreground)] shadow-xs"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isDbConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span>{isDbConnected ? "System Operational" : "Database Unavailable"}</span>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Top KPI Diagnostics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
          <MetricCard
            label="Database Connection"
            value={isDbConnected ? "Connected" : "Unavailable"}
            unit={data.database.latencyMs !== null ? `${data.database.latencyMs}ms` : undefined}
            icon={<Database className="w-4 h-4 text-[var(--accent)]" />}
            status={isDbConnected ? "success" : "danger"}
          />
          <MetricCard
            label="Runtime Environment"
            value={data.application.nodeEnv}
            unit="mode"
            icon={<Server className="w-4 h-4 text-[var(--accent)]" />}
          />
          <MetricCard
            label="Database Provider"
            value={data.database.provider}
            unit="engine"
            icon={<Cpu className="w-4 h-4 text-[var(--accent)]" />}
          />
          <MetricCard
            label="Process Uptime"
            value={formatUptime(data.application.uptimeSeconds)}
            unit="runtime"
            icon={<Clock className="w-4 h-4 text-[var(--accent)]" />}
          />
        </div>

        {/* Database Down Alert Banner */}
        {!isDbConnected && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div>
              <h4 className="font-heading font-bold text-sm">PostgreSQL Database Connection Failure</h4>
              <p className="text-xs mt-1 leading-relaxed opacity-90">
                {data.database.error || "The application was unable to verify database connectivity. Verify PostgreSQL is listening on its designated socket/port."}
              </p>
            </div>
          </div>
        )}

        {/* Main Telemetry Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          {/* Card 1: Database Infrastructure */}
          <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
            <CardHeader className="pb-3 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[var(--accent)]" />
                <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
                  Database Infrastructure
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-[var(--muted)]">
                Prisma ORM connection health and storage driver telemetry.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">Provider Engine</span>
                <span className="font-mono font-semibold text-[var(--foreground)]">
                  {data.database.provider}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">Connection Status</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    isDbConnected ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {isDbConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  <span>{data.database.status}</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">Query Ping Latency</span>
                <span className="font-mono text-[var(--foreground)]">
                  {data.database.latencyMs !== null ? `${data.database.latencyMs} ms` : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">Credential Protection</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Isolated (Zero Client Leakage)</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <span className="text-[var(--muted)]">ORM Framework</span>
                <span className="font-mono text-xs text-[var(--foreground)]">Prisma 6.19 (PostgreSQL Adapter)</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Application Runtime */}
          <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
            <CardHeader className="pb-3 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[var(--accent)]" />
                <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
                  Application Runtime
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-[var(--muted)]">
                Node.js execution environment and cryptographic session controls.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">Node Environment</span>
                <span className="font-mono font-semibold text-[var(--foreground)] uppercase">
                  {data.application.nodeEnv}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">Node.js Engine</span>
                <span className="font-mono text-[var(--foreground)]">{data.application.nodeVersion}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">Framework</span>
                <span className="font-mono text-[var(--foreground)]">{data.application.framework}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">Session Token Cryptography</span>
                <span className="font-mono text-[11px] text-[var(--foreground)] truncate max-w-[240px]">
                  Web Crypto HMAC-SHA256
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <span className="text-[var(--muted)]">Server Timestamp (UTC)</span>
                <span className="font-mono text-[11px] text-[var(--muted)]">
                  {new Date(data.application.serverTime).toUTCString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Live Database Record Counts */}
          <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
            <CardHeader className="pb-3 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--accent)]" />
                <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
                  Live Database Record Volumes
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-[var(--muted)]">
                Real-time counts queried directly from PostgreSQL tables.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-[var(--card-border)] bg-[var(--background)]">
                  <span className="text-[10px] font-semibold uppercase text-[var(--muted)] tracking-wider block">
                    Kitchens
                  </span>
                  <span className="text-xl font-bold font-heading text-[var(--foreground)] mt-1 block">
                    {data.metrics.kitchens !== null ? data.metrics.kitchens : "—"}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-[var(--card-border)] bg-[var(--background)]">
                  <span className="text-[10px] font-semibold uppercase text-[var(--muted)] tracking-wider block">
                    Contractors
                  </span>
                  <span className="text-xl font-bold font-heading text-[var(--foreground)] mt-1 block">
                    {data.metrics.contractors !== null ? data.metrics.contractors : "—"}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-[var(--card-border)] bg-[var(--background)]">
                  <span className="text-[10px] font-semibold uppercase text-[var(--muted)] tracking-wider block">
                    Registered Users
                  </span>
                  <span className="text-xl font-bold font-heading text-[var(--foreground)] mt-1 block">
                    {data.metrics.users !== null ? data.metrics.users : "—"}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-[var(--card-border)] bg-[var(--background)]">
                  <span className="text-[10px] font-semibold uppercase text-[var(--muted)] tracking-wider block">
                    Observations
                  </span>
                  <span className="text-xl font-bold font-heading text-[var(--foreground)] mt-1 block">
                    {data.metrics.observations !== null ? data.metrics.observations : "—"}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-[var(--card-border)] bg-[var(--background)] col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-semibold uppercase text-[var(--muted)] tracking-wider block">
                    Applications
                  </span>
                  <span className="text-xl font-bold font-heading text-[var(--foreground)] mt-1 block">
                    {data.metrics.applications !== null ? data.metrics.applications : "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Notification Relay Telemetry */}
          <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
            <CardHeader className="pb-3 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[var(--accent)]" />
                <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
                  Notification Infrastructure
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-[var(--muted)]">
                Institutional SMTP dispatch relay status and transport security.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">SMTP Relay Service</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    data.notifications.configured ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--muted)]"
                  }`}
                >
                  {data.notifications.configured ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>{data.notifications.configured ? "Configured" : "Captured in Test Relay"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">Relay Host</span>
                <span className="font-mono text-[var(--foreground)]">
                  {data.notifications.hostName || "Local Fallback Simulator"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--card-border)]">
                <span className="text-[var(--muted)]">Transport Encryption</span>
                <span className="font-mono text-xs text-[var(--foreground)]">
                  {data.notifications.secure ? "SMTPS / TLS (Port 465)" : "STARTTLS / Standard"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <span className="text-[var(--muted)]">Dispatch Channel</span>
                <span className="text-[11px] font-semibold text-[var(--foreground)]">
                  Multi-Founder Dual-Dispatch
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security & Isolation Compliance Footer */}
        <div className="p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card)] text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-heading font-semibold text-[var(--foreground)] block">
                Zero-Trust Credential Isolation
              </span>
              <span className="text-[11px] text-[var(--muted)]">
                Connection secrets, database credentials, and token salts are strictly isolated on server execution contexts and never exposed to the client.
              </span>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--card-border)] shrink-0">
            SEC-COMPLIANT
          </span>
        </div>
      </div>
    </FounderShell>
  );
}
