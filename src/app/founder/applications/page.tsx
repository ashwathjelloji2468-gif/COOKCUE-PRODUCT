import React from "react";
import Link from "next/link";
import { listApplicationsAsFounder } from "@/server/actions/onboarding";
import { FounderShell } from "@/components/layout/FounderShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  Building2,
  ChefHat,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  ShieldCheck,
  Plus,
} from "lucide-react";

export default async function FounderApplicationsPage() {
  const res = await listApplicationsAsFounder();
  const applications = res.success && res.data ? res.data : [];

  const pendingReview = applications.filter((a) => a.status === "PENDING_FOUNDER_REVIEW");
  const pendingVerification = applications.filter((a) => a.status === "PENDING_EMAIL_VERIFICATION");
  const approved = applications.filter((a) => a.status === "APPROVED_PENDING_ACTIVATION" || a.status === "ACTIVATED");
  const rejected = applications.filter((a) => a.status === "REJECTED");

  return (
    <FounderShell
      title="Onboarding Applications"
      subtitle="Review applicant credentials, verify institutional mess affiliation, and map facility tenancy"
    >
      <div className="space-y-6">
        {/* KPI Counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <Card className="p-4 border-border/80 bg-card cc-card">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <Clock className="w-3.5 h-3.5 text-warning-foreground" />
              <span>Pending Review</span>
            </div>
            <div className="text-2xl font-bold font-heading text-foreground mt-1 tabular-nums cc-num">
              {pendingReview.length}
            </div>
          </Card>

          <Card className="p-4 border-border/80 bg-card cc-card">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Unverified Email</span>
            </div>
            <div className="text-2xl font-bold font-heading text-muted-foreground mt-1 tabular-nums cc-num">
              {pendingVerification.length}
            </div>
          </Card>

          <Card className="p-4 border-border/80 bg-card cc-card">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              <span>Approved</span>
            </div>
            <div className="text-2xl font-bold font-heading text-primary mt-1 tabular-nums cc-num">
              {approved.length}
            </div>
          </Card>

          <Card className="p-4 border-border/80 bg-card cc-card">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Total Received</span>
            </div>
            <div className="text-2xl font-bold font-heading text-foreground mt-1 tabular-nums cc-num">
              {applications.length}
            </div>
          </Card>
        </div>

        {applications.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-10 h-10 text-muted-foreground" />}
            title="No onboarding applications yet"
            description="Submitted Contractor registrations, Head Cook requests, and Staff applications will appear here for founder review."
            action={
              <Link
                href="/founder/contractors/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Onboard New Contractor</span>
              </Link>
            }
          />
        ) : (
          <Card className="border-border/80 shadow-xs bg-card overflow-hidden cc-card">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-heading font-bold text-foreground">
                All Applications ({applications.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[600px] cc-table">
                <table className="w-full text-xs text-left cc-table">
                  <thead className="bg-muted/60 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border/70 font-semibold sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      <th className="py-3 px-4">Applicant</th>
                      <th className="py-3 px-4">Application Type</th>
                      <th className="py-3 px-4">Requested Affiliation</th>
                      <th className="py-3 px-4 text-center">Email Verification</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Submitted</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-heading font-bold text-foreground">
                            {app.applicantName}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {app.applicantEmail}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
                            {app.type === "CONTRACTOR" && <Building2 className="w-3 h-3 text-primary" />}
                            {app.type === "HEAD_COOK" && <ChefHat className="w-3 h-3 text-primary" />}
                            {app.type === "KITCHEN_STAFF" && <Users className="w-3 h-3 text-primary" />}
                            <span>
                              {app.type === "CONTRACTOR" ? "Contractor Org" : app.type === "HEAD_COOK" ? "Head Cook" : "Kitchen Staff"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">
                            {app.contractorName || "—"}
                          </div>
                          {app.kitchenName && (
                            <div className="text-[10px] text-muted-foreground">
                              Kitchen: {app.kitchenName}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {app.emailVerifiedAt ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Verified</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning-foreground bg-warning/15 border border-warning/30 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              app.status === "ACTIVATED"
                                ? "bg-accent/40 text-primary border-primary/30"
                                : app.status === "APPROVED_PENDING_ACTIVATION"
                                ? "bg-primary/10 text-primary border-primary/20"
                                : app.status === "PENDING_FOUNDER_REVIEW"
                                ? "bg-amber-100/60 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60"
                                : app.status === "REJECTED"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {app.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
                          {new Date(app.createdAt).toISOString().slice(0, 10)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button asChild size="sm" variant="outline" className="text-xs gap-1 h-8">
                            <Link href={`/founder/applications/${app.id}`}>
                              <span>Review</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </FounderShell>
  );
}
