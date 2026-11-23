"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { verifyApplicantEmail } from "@/server/actions/onboarding";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AmbientBackground, FadeIn } from "@/components/motion";
import { CheckCircle2, AlertCircle, Sparkles, ArrowRight, ShieldCheck, ArrowLeft } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const executedRef = React.useRef(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("No verification token was provided in the URL.");
      return;
    }

    if (executedRef.current) return;
    executedRef.current = true;

    verifyApplicantEmail(token).then((res) => {
      setLoading(false);
      if (res.success) {
        setSuccess(true);
        setMessage(res.message || "Email address verified successfully.");
      } else {
        setError(res.error || "Failed to verify email address.");
      }
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <AmbientBackground variant="auth" />
      <FadeIn direction="up" distance={16} className="w-full max-w-md space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex justify-center mb-2">
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
        <Card className="cc-card border-border/80 shadow-md bg-card p-6 sm:p-8 text-center space-y-5">
          {loading ? (
            <div className="space-y-4 py-8">
              <Sparkles className="w-10 h-10 text-primary mx-auto animate-spin" />
              <div className="space-y-1">
                <h1 className="font-heading text-lg font-bold text-foreground">
                  Verifying Email Address...
                </h1>
                <p className="text-xs text-muted-foreground">
                  Confirming token authenticity and updating application status.
                </p>
              </div>
            </div>
          ) : success ? (
            <div className="space-y-5 animate-in fade-in">
              <div className="w-14 h-14 rounded-full bg-accent/30 text-primary mx-auto flex items-center justify-center border border-primary/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  Email Verified!
                </h1>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {message}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/60 border border-border/80 text-left text-xs text-muted-foreground space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Next Step:</strong> The Platform Founder has been notified and will verify your organizational affiliation.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    Upon approval, you will receive an account activation link to set your password.
                  </span>
                </div>
              </div>

              <Button asChild className="w-full h-10 text-xs font-semibold bg-primary text-primary-foreground">
                <Link href="/login">
                  <span>Return to Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in">
              <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center border border-destructive/20">
                <AlertCircle className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  Verification Failed
                </h1>
                <p className="text-xs text-destructive max-w-sm mx-auto leading-relaxed">
                  {error}
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button asChild variant="outline" className="text-xs">
                  <Link href="/onboard">Submit New Application</Link>
                </Button>
                <Button asChild className="text-xs bg-primary text-primary-foreground">
                  <Link href="/login">Return to Sign In</Link>
                </Button>
              </div>
            </div>
          )}
        </Card>
      </FadeIn>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-xs">Loading verification...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
