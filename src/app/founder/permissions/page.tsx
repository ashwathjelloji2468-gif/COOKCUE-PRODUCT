import { FounderShell } from "@/components/layout/FounderShell";
import { getCurrentUserProfile } from "@/server/actions/profile";
import { AccountNavTabs } from "@/components/layout/AccountNavTabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Building2,
  UtensilsCrossed,
  Users,
  ScrollText,
  Server,
  AlertTriangle,
} from "lucide-react";

export default async function FounderPermissionsPage() {
  const res = await getCurrentUserProfile();

  if (!res.success) {
    return (
      <FounderShell
        title="Role & Permissions"
        subtitle="Access control policies and functional authority for your active credential"
      >
        <AccountNavTabs />
        <EmptyState
          icon={<AlertTriangle className="w-10 h-10 text-rose-500" />}
          title="No authenticated role available"
          description={res.error || "Unable to determine permissions for the active session. Please sign in."}
        />
      </FounderShell>
    );
  }

  const user = res.data;
  const isFounder = user.role === "FOUNDER";
  const isContractorAdmin = user.role === "CONTRACTOR_ADMIN" || user.role === "CONTRACTOR_MANAGER";
  const isHeadCook = user.role === "HEAD_COOK";

  // Real capability mapping based strictly on the current user's real DB role
  const permissionsList = isFounder
    ? [
        {
          title: "Full Platform Portfolio Oversight",
          description: "Inspect multi-tenant kitchen telemetry, daily observation data hygiene, and stockout incident rates across all contractors.",
          icon: UtensilsCrossed,
          granted: true,
        },
        {
          title: "Contractor Onboarding & Governance",
          description: "Review, approve, or reject institutional onboarding applications; provision and activate new contractor catering organizations.",
          icon: Building2,
          granted: true,
        },
        {
          title: "User Directory & Identity Oversight",
          description: "Inspect active credentials, roles, and status for all registered operators across the platform.",
          icon: Users,
          granted: true,
        },
        {
          title: "System Audit Log Inspection",
          description: "Read-only access to immutable chronological audit trails covering meal closeouts, recommendation overrides, and administrative actions.",
          icon: ScrollText,
          granted: true,
        },
        {
          title: "Runtime Environment & Diagnostics",
          description: "View PostgreSQL socket connectivity health, query latency, uptime metrics, and non-sensitive SMTP relay configuration.",
          icon: Server,
          granted: true,
        },
        {
          title: "Dual-Dispatch Founder Alerts",
          description: "Receive high-priority administrative notifications whenever a new contractor or head cook submits an onboarding application.",
          icon: ShieldCheck,
          granted: true,
        },
      ]
    : isContractorAdmin
    ? [
        {
          title: "Contractor Organization Governance",
          description: "Manage kitchens, provision facilities, and assign kitchen staff within your assigned organization.",
          icon: Building2,
          granted: true,
        },
        {
          title: "Facility Telemetry Access",
          description: "View observations, meal production records, and closeout summaries for your organization's kitchens.",
          icon: UtensilsCrossed,
          granted: true,
        },
      ]
    : isHeadCook
    ? [
        {
          title: "Kitchen Service & Closeout Logging",
          description: "Record daily cooked weights, leftovers, and actual diner counts for your assigned kitchen facility.",
          icon: UtensilsCrossed,
          granted: true,
        },
        {
          title: "Cooking Plan Management",
          description: "View daily AI-generated dish recommendations and record operational quantity adjustments.",
          icon: ShieldCheck,
          granted: true,
        },
      ]
    : [
        {
          title: "Standard Operational Access",
          description: "Basic kitchen operations assistance and meal view within your assigned facility.",
          icon: Lock,
          granted: true,
        },
      ];

  return (
    <FounderShell
      title="Role & Permissions"
      subtitle="Access control policies and functional authority for your active credential"
      action={
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-xs font-semibold text-[var(--foreground)] shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Active Role: {user.role}</span>
        </div>
      }
    >
      <AccountNavTabs />

      <div className="max-w-3xl space-y-6">
        {/* Role Overview Card */}
        <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
          <CardHeader className="pb-3 border-b border-[var(--card-border)]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
                  Active Access Level
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Cryptographically verified session role for {user.email}
                </CardDescription>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-accent-soft text-accent border border-accent/30">
                {user.role}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Your credentials grant you <strong className="text-[var(--foreground)]">{isFounder ? "full platform administrator authority" : "scoped operational access"}</strong>. Permissions are strictly enforced via cryptographic token validation and live database state checks on every request.
            </p>
          </CardContent>
        </Card>

        {/* Granted Capabilities List */}
        <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)] overflow-hidden">
          <CardHeader className="pb-3 border-b border-[var(--card-border)]">
            <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
              Authorized Capabilities ({permissionsList.length})
            </CardTitle>
            <CardDescription className="text-xs text-[var(--muted)]">
              Operations permitted under your current role in accordance with platform security policy.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--card-border)]">
              {permissionsList.map((perm) => {
                const Icon = perm.icon;
                return (
                  <div key={perm.title} className="p-4 flex items-start gap-3.5 hover:bg-[var(--accent-soft)] transition-colors">
                    <div className="p-2 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--card-border)] shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-semibold text-xs text-[var(--foreground)]">
                          {perm.title}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Granted</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--muted)] mt-1 leading-relaxed">
                        {perm.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </FounderShell>
  );
}
