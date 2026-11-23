"use client";

import React, { useState } from "react";
import {
  sendOperationalReminders,
  type OperationalReminderResult,
  type ReminderCandidate,
} from "@/server/actions/reminders";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Send,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface RunOperationalRemindersButtonProps {
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function RunOperationalRemindersButton({
  className = "",
  variant = "outline",
  size = "sm",
}: RunOperationalRemindersButtonProps) {
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<"dry" | "send" | null>(null);
  const [result, setResult] = useState<OperationalReminderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function handleExecute(dryRun: boolean) {
    setLoading(true);
    setActiveMode(dryRun ? "dry" : "send");
    setError(null);

    try {
      const res = await sendOperationalReminders({ dryRun });
      if (!res.success) {
        setError(res.error);
      } else {
        setResult(res.data);
        setExpanded(true);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to execute reminders check");
    } finally {
      setLoading(false);
      setActiveMode(null);
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Dry run button */}
        <Button
          onClick={() => handleExecute(true)}
          disabled={loading}
          variant={variant}
          size={size}
          className="gap-1.5 font-semibold shadow-xs text-xs"
          title="Inspect pending operational reminders without sending emails"
        >
          {loading && activeMode === "dry" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Eye className="w-3.5 h-3.5 text-[var(--accent)]" />
          )}
          <span>{loading && activeMode === "dry" ? "Inspecting..." : "Check reminders (Dry Run)"}</span>
        </Button>

        {/* Live send button */}
        <Button
          onClick={() => handleExecute(false)}
          disabled={loading}
          variant="default"
          size={size}
          className="gap-1.5 font-semibold shadow-xs text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
          title="Dispatch operational reminder emails to Head Cooks / Contacts"
        >
          {loading && activeMode === "send" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5 text-accent-soft" />
          )}
          <span>{loading && activeMode === "send" ? "Dispatching..." : "Send reminders now"}</span>
        </Button>

        {result && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] h-8 px-2"
          >
            <span>{expanded ? "Hide details" : "View summary"}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
          </Button>
        )}
      </div>

      {/* Error state banner */}
      {error && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result summary panel */}
      {result && expanded && (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-3 text-xs shadow-xs space-y-3 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--card-border)]">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                result.dryRun
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
              }`}>
                {result.dryRun ? "Dry Run (Simulated)" : "Live Dispatched"}
              </span>
              <span className="text-[var(--muted)] text-[11px]">
                Channels: <strong className="text-[var(--foreground)] font-mono">{result.channel}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span>Candidates: <strong className="text-[var(--foreground)] font-mono">{result.totalCandidates}</strong></span>
              {!result.dryRun && (
                <span>Sent: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{result.sentCount}</strong></span>
              )}
              <span>Skipped (&lt;6h dedup): <strong className="text-amber-600 dark:text-amber-400 font-mono">{result.skippedCount}</strong></span>
              {result.failedCount > 0 && (
                <span>Failed: <strong className="text-destructive font-mono">{result.failedCount}</strong></span>
              )}
            </div>
          </div>

          {result.candidates.length === 0 ? (
            <p className="text-[var(--muted)] italic text-xs py-1">
              No unapproved plans or missing closeouts found. All active kitchens are compliant!
            </p>
          ) : (
            <div className="overflow-x-auto max-h-56 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[var(--background)] text-[var(--muted)] border-b border-[var(--card-border)] font-semibold">
                  <tr>
                    <th className="py-1.5 px-2">Kitchen Facility</th>
                    <th className="py-1.5 px-2">Issue Type</th>
                    <th className="py-1.5 px-2">Service</th>
                    <th className="py-1.5 px-2">Recipients</th>
                    <th className="py-1.5 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]/50">
                  {result.candidates.map((c, i) => (
                    <tr key={i} className="hover:bg-[var(--accent-soft)] transition-colors">
                      <td className="py-1.5 px-2 font-semibold text-[var(--foreground)]">
                        {c.kitchenName}
                      </td>
                      <td className="py-1.5 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          c.type === "PLAN_NOT_APPROVED"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                        }`}>
                          {c.type === "PLAN_NOT_APPROVED" ? "Plan Unapproved" : "Closeout Missing"}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[var(--muted)]">
                        {c.mealType} ({c.date})
                      </td>
                      <td className="py-1.5 px-2 text-[var(--foreground)]">
                        <span title={`Resolved via ${c.recipientType}`}>
                          {c.recipientEmails.join(", ")}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {c.isDeduplicated ? (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-0.5" title={c.skipReason}>
                            <Clock className="w-3 h-3" /> Skipped (&lt;6h)
                          </span>
                        ) : result.dryRun ? (
                          <span className="text-[10px] text-[var(--muted)] font-medium">
                            Ready to send
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Sent
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
