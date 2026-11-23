"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveApplicationAsFounder,
  rejectApplicationAsFounder,
  retryNotificationAsFounder,
} from "@/server/actions/onboarding";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Building2,
  ChefHat,
  Users,
  ShieldAlert,
  Sparkles,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ApplicationReviewClientProps {
  application: any;
  availableContractors: Array<{
    id: string;
    name: string;
    kitchens: Array<{ id: string; name: string; location: string | null }>;
  }>;
}

export function ApplicationReviewClient({
  application: app,
  availableContractors,
}: ApplicationReviewClientProps) {
  const router = useRouter();

  const [selectedContractorId, setSelectedContractorId] = useState(
    app.assignedContractorId || availableContractors[0]?.id || ""
  );
  const selectedContractor = availableContractors.find((c) => c.id === selectedContractorId);

  const [selectedKitchenId, setSelectedKitchenId] = useState(
    app.assignedKitchenId || selectedContractor?.kitchens[0]?.id || ""
  );

  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const res = await approveApplicationAsFounder({
      applicationId: app.id,
      contractorId: app.type !== "CONTRACTOR" ? selectedContractorId : undefined,
      kitchenId: app.type !== "CONTRACTOR" ? selectedKitchenId : undefined,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Approval failed.");
    } else {
      setSuccessMessage("Application approved! Approval email with activation link has been dispatched.");
      router.refresh();
    }
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      setError("Please provide a rejection reason.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const res = await rejectApplicationAsFounder({
      applicationId: app.id,
      reason: rejectionReason,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Rejection failed.");
    } else {
      setSuccessMessage("Application rejected and notice email sent to applicant.");
      router.refresh();
    }
  }

  async function handleRetryNotification(logId: string) {
    setRetryingLogId(logId);
    setError(null);
    setSuccessMessage(null);

    const res = await retryNotificationAsFounder(logId);
    setRetryingLogId(null);

    if (!res.success) {
      setError(res.error || "Retry delivery failed.");
    } else {
      setSuccessMessage("Notification email resent successfully.");
      router.refresh();
    }
  }

  const isVerified = !!app.emailVerifiedAt;
  const canDecide = app.status === "PENDING_FOUNDER_REVIEW" || app.status === "APPROVED_PENDING_ACTIVATION";

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Decision Actions Card */}
      <Card className="border-border/80 shadow-xs bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-accent" />
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-heading font-bold text-foreground">
            Founder Review &amp; Tenancy Assignment
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Verify institutional affiliation and record your administrative decision.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {!isVerified ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 dark:border-amber-700/60 text-xs flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Email Verification Required:</strong> The applicant has not clicked their verification link yet. For security and tenant safety, founder approval is disabled until the applicant verifies their email address.
              </div>
            </div>
          ) : !canDecide ? (
            <div className="p-4 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground">
              This application has already reached decision state: <strong>{app.status}</strong>.
              {app.rejectionReason && (
                <div className="mt-2 text-destructive">
                  <strong>Rejection Note:</strong> {app.rejectionReason}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* If Head Cook or Staff: Require Contractor & Kitchen Mapping (Requirement 6) */}
              {app.type !== "CONTRACTOR" && (
                <div className="p-4 rounded-xl bg-muted/50 border border-border/80 space-y-3">
                  <div className="text-xs font-heading font-bold text-foreground flex items-center gap-1.5">
                    {app.type === "HEAD_COOK" ? <ChefHat className="w-4 h-4 text-primary" /> : <Users className="w-4 h-4 text-primary" />}
                    <span>Assign to Existing Contractor &amp; Kitchen Facility</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Requested Org: <strong>{app.contractorName || "None"}</strong> • Requested Kitchen: <strong>{app.kitchenName || "None"}</strong>
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-foreground uppercase tracking-wider block">
                        Select Registered Contractor
                      </label>
                      <select
                        value={selectedContractorId}
                        onChange={(e) => {
                          const cId = e.target.value;
                          setSelectedContractorId(cId);
                          const c = availableContractors.find((x) => x.id === cId);
                          setSelectedKitchenId(c?.kitchens[0]?.id || "");
                        }}
                        disabled={loading}
                        className="w-full h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                      >
                        {availableContractors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-foreground uppercase tracking-wider block">
                        Select Authorized Kitchen Facility
                      </label>
                      <select
                        value={selectedKitchenId}
                        onChange={(e) => setSelectedKitchenId(e.target.value)}
                        disabled={loading || !selectedContractor}
                        className="w-full h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                      >
                        {selectedContractor?.kitchens.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name} {k.location ? `(${k.location})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* If Contractor: Explains organization creation (Requirement 5) */}
              {app.type === "CONTRACTOR" && (
                <div className="p-4 rounded-xl bg-muted/50 border border-border/80 text-xs text-muted-foreground space-y-1.5">
                  <div className="font-heading font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span>Contractor Organization Provisioning</span>
                  </div>
                  <p>
                    Approval will create the Contractor organization <strong>&ldquo;{app.contractorName}&rdquo;</strong> and provision its initial kitchen <strong>&ldquo;{app.kitchenName || "Central Kitchen"}&rdquo;</strong>.
                  </p>
                  <p>
                    The applicant will receive an activation email for a scoped <strong>CONTRACTOR_ADMIN</strong> account.
                  </p>
                </div>
              )}

              {/* Decision Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={loading || !isVerified}
                  className="w-full sm:w-auto h-10 text-xs font-semibold bg-primary text-primary-foreground gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span>
                    {loading ? "Processing..." : app.type === "CONTRACTOR" ? "Approve & Provision Contractor Org" : "Approve & Map to Facility"}
                  </span>
                </Button>
              </div>

              {/* Rejection Form */}
              <div className="pt-4 border-t border-border/70 space-y-2">
                <label className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                  Reject Application
                </label>
                <textarea
                  placeholder="Provide feedback or reason for rejection (this will be sent to the applicant)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  disabled={loading}
                  rows={2}
                  className="w-full rounded-md border border-input bg-card p-2 text-xs text-foreground focus:ring-1 focus:ring-destructive outline-none resize-none"
                />
                <Button
                  onClick={handleReject}
                  disabled={loading || !rejectionReason.trim()}
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject Application</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Delivery Logs & Safe Retry Card (Requirement 14.2) */}
      <Card className="border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-heading font-bold text-foreground">
              Notification &amp; Email Delivery Audit
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Delivery logs, attempt counts, and safe notification retries.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {app.notificationLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground italic">
              No email notifications logged for this application yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border/70 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Template</th>
                    <th className="py-2.5 px-4">Recipient</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Attempts</th>
                    <th className="py-2.5 px-4 text-right">Last Attempt</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {app.notificationLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-[11px] text-foreground">
                        {log.template}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground">
                        {log.recipient}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            log.status === "ACCEPTED_BY_SMTP" || log.status === "SENT"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : log.status === "CAPTURED"
                              ? "bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60"
                              : log.status === "FAILED"
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {log.status === "ACCEPTED_BY_SMTP"
                            ? "Accepted by SMTP"
                            : log.status === "CAPTURED"
                            ? "Captured (Local)"
                            : log.status}
                        </span>
                        {log.errorMessage && (
                          <div
                            className={cn(
                              "text-[10px] mt-0.5 max-w-xs truncate mx-auto",
                              log.status === "FAILED" ? "text-destructive" : "text-muted-foreground"
                            )}
                            title={log.errorMessage}
                          >
                            {log.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {log.attemptCount}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
                        {log.lastAttemptAt ? new Date(log.lastAttemptAt).toLocaleTimeString() : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {(log.status === "FAILED" || log.status === "CAPTURED") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetryNotification(log.id)}
                            disabled={retryingLogId === log.id}
                            className="text-[11px] h-7 gap-1 border-primary/30 text-primary hover:bg-primary/5"
                          >
                            <RefreshCw className={cn("w-3 h-3", retryingLogId === log.id && "animate-spin")} />
                            <span>Retry</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
