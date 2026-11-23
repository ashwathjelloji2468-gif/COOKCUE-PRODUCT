import { FounderShell } from "@/components/layout/FounderShell";
import { getPlatformAuditEvents } from "@/server/actions/audit";
import { AuditLogClient } from "./AuditLogClient";
import { ScrollText } from "lucide-react";

export default async function FounderAuditLogPage() {
  const res = await getPlatformAuditEvents();
  const events = res.success ? res.data : [];

  return (
    <FounderShell
      title="System Audit Log"
      subtitle="Immutable chronological trail of meal closeouts, recommendation overrides, and administrative events"
      action={
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-xs font-semibold text-[var(--foreground)] shadow-xs">
          <ScrollText className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{events.length} {events.length === 1 ? "Event" : "Events"} Logged</span>
        </div>
      }
    >
      <AuditLogClient initialEvents={events} />
    </FounderShell>
  );
}
