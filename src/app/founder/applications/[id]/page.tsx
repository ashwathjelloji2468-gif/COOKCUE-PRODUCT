import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApplicationDetailAsFounder } from "@/server/actions/onboarding";
import { FounderShell } from "@/components/layout/FounderShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ApplicationReviewClient } from "./ApplicationReviewClient";
import {
  ArrowLeft,
  Building2,
  ChefHat,
  Users,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({ params }: Props) {
  const { id } = await params;
  const res = await getApplicationDetailAsFounder(id);

  if (!res.success || !res.data) {
    notFound();
  }

  const { application: app, availableContractors } = res.data;

  return (
    <FounderShell
      title={app.applicantName}
      subtitle="Applicant credential verification and organization onboarding"
    >
      <div className="space-y-6">
        {/* Navigation Link back */}
        <Link
          href="/founder/applications"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to all applications</span>
        </Link>

        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/80">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                {app.type} ONBOARDING APPLICATION
              </span>
              {app.emailVerifiedAt ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Email Verified</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning-foreground bg-warning/15 border border-warning/30 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" />
                  <span>Email Unverified</span>
                </span>
              )}
            </div>

            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {app.applicantName}
            </h2>
            <p className="text-xs text-muted-foreground font-mono">
              ID: {app.id} • Submitted {new Date(app.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="shrink-0">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
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
          </div>
        </div>

        {/* Applicant Details Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 border-border/80 bg-card">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Applicant Contact
            </div>
            <div className="font-heading font-bold text-sm text-foreground mt-1">
              {app.applicantName}
            </div>
            <div className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{app.applicantEmail}</span>
            </div>
          </Card>

          <Card className="p-4 border-border/80 bg-card">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Requested Affiliation
            </div>
            <div className="font-heading font-bold text-sm text-foreground mt-1">
              {app.contractorName || "New Contractor Org"}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>Facility: {app.kitchenName || "Initial Kitchen"}</span>
            </div>
          </Card>

          <Card className="p-4 border-border/80 bg-card">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Physical Location &amp; Verification
            </div>
            <div className="font-heading font-bold text-sm text-foreground mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>{app.location || "Not specified"}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {app.emailVerifiedAt
                ? `Verified on ${new Date(app.emailVerifiedAt).toLocaleDateString()}`
                : "Awaiting applicant email verification"}
            </div>
          </Card>
        </div>

        {/* Client Review & Actions Block */}
        <ApplicationReviewClient
          application={app}
          availableContractors={availableContractors}
        />
      </div>
    </FounderShell>
  );
}
