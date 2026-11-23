import { FounderShell } from "@/components/layout/FounderShell";
import { getCurrentUserProfile } from "@/server/actions/profile";
import { AccountNavTabs } from "@/components/layout/AccountNavTabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { User, Mail, Shield, Calendar, Building2, Utensils, AlertTriangle } from "lucide-react";

export default async function FounderProfilePage() {
  const res = await getCurrentUserProfile();

  if (!res.success) {
    return (
      <FounderShell
        title="Account Profile"
        subtitle="Signed-in user identity and account credentials"
      >
        <AccountNavTabs />
        <EmptyState
          icon={<AlertTriangle className="w-10 h-10 text-rose-500" />}
          title="No authenticated profile available"
          description={res.error || "Unable to retrieve account details for the active session. Please sign in again."}
        />
      </FounderShell>
    );
  }

  const profile = res.data;

  return (
    <FounderShell
      title="Account Profile"
      subtitle="Signed-in user identity, institutional role, and active credentials"
      action={
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-xs font-semibold text-[var(--foreground)] shadow-xs">
          <User className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Verified Account</span>
        </div>
      }
    >
      <AccountNavTabs />

      <div className="max-w-3xl space-y-6">
        <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
          <CardHeader className="pb-4 border-b border-[var(--card-border)]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--card-border)] flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
                {(profile.name?.[0] || profile.email[0] || "U").toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-heading font-bold text-[var(--foreground)]">
                    {profile.name || "Not provided"}
                  </CardTitle>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">
                    User ID: {profile.code || profile.id}
                  </span>
                </div>
                <CardDescription className="text-xs text-[var(--muted)] mt-0.5 font-mono">
                  {profile.email}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <div className="p-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--background)]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                  <Mail className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Institutional Email</span>
                </div>
                <div className="mt-1 font-mono text-xs font-bold text-[var(--foreground)] truncate">
                  {profile.email}
                </div>
              </div>

              {/* Role */}
              <div className="p-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--background)]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                  <Shield className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>System Role</span>
                </div>
                <div className="mt-1 text-xs font-bold text-[var(--foreground)] tracking-wide">
                  {profile.role}
                </div>
              </div>

              {/* Status */}
              <div className="p-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--background)]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                  <StatusBadge
                    status={profile.status === "ACTIVE" ? "active" : "inactive"}
                    label="Account Status"
                  />
                </div>
                <div className="mt-1 text-xs font-semibold text-[var(--foreground)]">
                  {profile.status}
                </div>
              </div>

              {/* Created Date */}
              <div className="p-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--background)]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                  <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Member Since</span>
                </div>
                <div className="mt-1 font-mono text-xs text-[var(--foreground)]">
                  {new Date(profile.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>

            {/* System Identifier & Organization Assignment */}
            <div className="pt-2 border-t border-[var(--card-border)] space-y-3">
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[var(--muted)]">User ID</span>
                <span className="font-mono text-xs font-bold text-[var(--foreground)] select-all">
                  {profile.code || profile.id}
                </span>
              </div>

              {profile.code && (
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-[var(--muted)]">Database cuid</span>
                  <span className="font-mono text-[11px] text-[var(--muted)] select-all">
                    {profile.id}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[var(--muted)]">Organization Assignment</span>
                <span className="text-xs font-medium text-[var(--foreground)]">
                  {profile.contractorName || (
                    <span className="text-[var(--muted)] italic">Not provided</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[var(--muted)]">Contractor ID</span>
                <span className="font-mono text-xs font-bold text-[var(--foreground)] select-all">
                  {profile.contractorCode ? `Contractor ID: ${profile.contractorCode}` : (
                    <span className="text-[var(--muted)] italic font-normal">Not provided</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[var(--muted)]">Assigned Kitchen</span>
                <span className="text-xs font-medium text-[var(--foreground)]">
                  {profile.kitchenName || (
                    <span className="text-[var(--muted)] italic">Not provided</span>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </FounderShell>
  );
}
