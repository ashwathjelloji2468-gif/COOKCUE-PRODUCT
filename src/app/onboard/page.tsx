"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { submitOnboardingApplication, resendVerificationEmail, ApplicationType } from "@/server/actions/onboarding";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  ChefHat,
  Users,
  ArrowRight,
  ArrowLeft,
  Mail,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MapPin,
  UtensilsCrossed,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AmbientBackground, FadeIn } from "@/components/motion";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type");

  const [type, setType] = useState<ApplicationType>(
    initialType === "contractor" ? "CONTRACTOR" : initialType === "staff" ? "KITCHEN_STAFF" : "HEAD_COOK"
  );

  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [contractorName, setContractorName] = useState("");
  const [kitchenName, setKitchenName] = useState("");
  const [location, setLocation] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null);

  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [devVerificationUrl, setDevVerificationUrl] = useState<string | null>(null);

  useEffect(() => {
    if (initialType === "contractor") setType("CONTRACTOR");
    else if (initialType === "staff") setType("KITCHEN_STAFF");
    else if (initialType === "head_cook") setType("HEAD_COOK");
  }, [initialType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await submitOnboardingApplication({
      type,
      applicantName,
      applicantEmail,
      contractorName,
      kitchenName,
      location,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error);
    } else {
      setSubmittedAppId(res.applicationId);
      if (res.devVerificationUrl) {
        setDevVerificationUrl(res.devVerificationUrl);
      }
    }
  }

  async function handleResendVerification() {
    if (!submittedAppId) return;
    setResending(true);
    setResendMessage(null);
    const res = await resendVerificationEmail(submittedAppId);
    setResending(false);

    if (res.success) {
      setResendMessage(res.message || "A fresh verification link has been sent to your email.");
      if (res.devVerificationUrl) {
        setDevVerificationUrl(res.devVerificationUrl);
      }
    } else {
      setError(res.error || "Failed to resend verification email.");
    }
  }

  if (submittedAppId) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
        <AmbientBackground variant="auth" />
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>
        <FadeIn direction="up" distance={16} className="w-full max-w-lg space-y-6 relative z-10">
          <Card className="border-border/80 shadow-md bg-card p-6 sm:p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-accent/30 text-primary mx-auto flex items-center justify-center border border-primary/20">
              <Mail className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                Verify Your Email Address
              </h1>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                We have dispatched a secure verification link to:
              </p>
              <div className="font-mono text-sm font-bold text-primary bg-primary/5 py-1.5 px-3 rounded-lg border border-primary/15 inline-block">
                {applicantEmail}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/60 border border-border/80 text-left text-xs text-muted-foreground space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Step 1:</strong> Click the verification link sent to your inbox to confirm this email.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Step 2:</strong> The Platform Founder will review your organizational affiliation.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Step 3:</strong> Once approved, you will receive an account activation link to set your password.
                </span>
              </div>
            </div>

            {resendMessage && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs text-primary font-medium">
                {resendMessage}
              </div>
            )}

            {devVerificationUrl && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left text-xs space-y-2">
                <div className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>Dev Mode: Direct Verification Link</span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Real SMTP delivery failed or is not configured. Click below to verify this email address directly:
                </p>
                <div className="pt-1">
                  <a
                    href={devVerificationUrl}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-200 font-mono text-xs font-semibold hover:bg-amber-500/30 transition-colors"
                  >
                    <span>Verify Email Now &rarr;</span>
                  </a>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive font-medium">
                {error}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full sm:w-auto text-xs gap-1.5"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", resending && "animate-spin")} />
                <span>{resending ? "Sending..." : "Resend Verification Email"}</span>
              </Button>
              <Button asChild size="sm" className="w-full sm:w-auto text-xs bg-primary text-primary-foreground">
                <Link href="/login">Return to Sign In</Link>
              </Button>
            </div>
          </Card>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Decorative ambient subtle background glows */}
      <AmbientBackground variant="auth" />

      <FadeIn direction="up" distance={16} className="w-full max-w-xl space-y-6 relative z-10">
        {/* Navigation Link back */}
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">CookCue Onboarding</span>
            <ThemeToggle />
          </div>
        </div>

        {/* Editorial Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <Link
              href="/"
              title="Go to CookCue Dashboard"
              className="p-1.5 rounded-xl bg-primary/10 border border-primary/20 shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              <Image
                src="/cookcue-logo.png"
                alt="CookCue"
                width={100}
                height={28}
                className="h-6 w-auto object-contain"
                priority
              />
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium tracking-wide">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>ORGANIZATIONAL &amp; OPERATOR ACCESS</span>
          </div>

          <h1 className="font-heading text-3xl font-bold tracking-tight text-primary">
            Join the CookCue Network
          </h1>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Choose your onboarding path below. Applications are cryptographically verified and reviewed by the Platform Founder.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-center gap-3 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Path Selection Tabs */}
        <div role="tablist" aria-label="Select onboarding role" className="grid grid-cols-3 gap-2 p-1.5 rounded-xl bg-card border border-border/80 shadow-xs">
          <button
            type="button"
            role="tab"
            aria-selected={type === "CONTRACTOR"}
            onClick={() => setType("CONTRACTOR")}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-lg text-xs font-medium transition-all text-center gap-1.5",
              type === "CONTRACTOR"
                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Building2 className="w-4 h-4" />
            <span>Contractor</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={type === "HEAD_COOK"}
            onClick={() => setType("HEAD_COOK")}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-lg text-xs font-medium transition-all text-center gap-1.5",
              type === "HEAD_COOK"
                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <ChefHat className="w-4 h-4" />
            <span>Head Cook</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={type === "KITCHEN_STAFF"}
            onClick={() => setType("KITCHEN_STAFF")}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-lg text-xs font-medium transition-all text-center gap-1.5",
              type === "KITCHEN_STAFF"
                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Users className="w-4 h-4" />
            <span>Kitchen Staff</span>
          </button>
        </div>

        {/* Dynamic Form Card */}
        <Card className="cc-card border-border/80 shadow-md bg-card/95 backdrop-blur-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-accent" />
          <CardHeader className="pb-4 pt-5">
            <CardTitle className="text-sm font-heading font-bold uppercase tracking-wider text-primary">
              {type === "CONTRACTOR" && "1. Register a Contractor Organization"}
              {type === "HEAD_COOK" && "2. Apply as Head Cook / Kitchen Manager"}
              {type === "KITCHEN_STAFF" && "3. Apply as Kitchen Staff / Prep Operator"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {type === "CONTRACTOR" &&
                "Establish a catering contractor organization, set up an initial kitchen, and provision an administrator."}
              {type === "HEAD_COOK" &&
                "Request operational management access to an existing college mess, hostel dining hall, or catering kitchen."}
              {type === "KITCHEN_STAFF" &&
                "Request station logging and closeout data-entry permissions for an existing kitchen team."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Common Fields: Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label htmlFor="onboard-name" className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                    Applicant Full Name
                  </label>
                  <Input
                    id="onboard-name"
                    type="text"
                    placeholder="e.g. Chef Rajesh Kumar"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    disabled={loading}
                    className="h-10 text-xs bg-background/60 border-border"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="onboard-email" className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                    Institutional Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                    <Input
                      id="onboard-email"
                      type="email"
                      placeholder="operator@organization.com"
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      disabled={loading}
                      className="h-10 text-xs pl-9 bg-background/60 border-border"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Conditional Path Specific Fields */}
              {type === "CONTRACTOR" ? (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="onboard-contractor-name" className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                      Contractor Organization Name
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                      <Input
                        id="onboard-contractor-name"
                        type="text"
                        placeholder="e.g. Apex Catering Pvt Ltd / National Food Services"
                        value={contractorName}
                        onChange={(e) => setContractorName(e.target.value)}
                        disabled={loading}
                        className="h-10 text-xs pl-9 bg-background/60 border-border"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label htmlFor="onboard-kitchen-name" className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                        Initial Kitchen Facility Name
                      </label>
                      <Input
                        id="onboard-kitchen-name"
                        type="text"
                        placeholder="e.g. Central Kitchen A"
                        value={kitchenName}
                        onChange={(e) => setKitchenName(e.target.value)}
                        disabled={loading}
                        className="h-10 text-xs bg-background/60 border-border"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="onboard-location" className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                        Facility Location / City
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                        <Input
                          id="onboard-location"
                          type="text"
                          placeholder="e.g. Bangalore Campus"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          disabled={loading}
                          className="h-10 text-xs pl-9 bg-background/60 border-border"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="onboard-target-contractor" className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                      Target Catering Contractor / Institution
                    </label>
                    <Input
                      id="onboard-target-contractor"
                      type="text"
                      placeholder="e.g. National College Hostel Mess / Demo Contractor Pvt Ltd"
                      value={contractorName}
                      onChange={(e) => setContractorName(e.target.value)}
                      disabled={loading}
                      className="h-10 text-xs bg-background/60 border-border"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">
                      The Platform Founder will verify and link your application to the correct registered contractor account during review.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="onboard-target-kitchen" className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                      Target Kitchen Facility Name
                    </label>
                    <Input
                      id="onboard-target-kitchen"
                      type="text"
                      placeholder="e.g. Central Kitchen A / Boys Dining Hall"
                      value={kitchenName}
                      onChange={(e) => setKitchenName(e.target.value)}
                      disabled={loading}
                      className="h-10 text-xs bg-background/60 border-border"
                      required
                    />
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={loading || !applicantName || !applicantEmail}
                className="w-full h-11 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all mt-4"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Submitting Application...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Submit Application &amp; Send Verification Link
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer Notice */}
        <div className="text-center text-[11px] text-muted-foreground space-y-1">
          <p>
            Applicants must verify their email address before applications are reviewed.
          </p>
          <p>
            Platform Founder approval is required for all role assignments and tenant provisioning.
          </p>
        </div>
      </FadeIn>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-xs">Loading onboarding...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
