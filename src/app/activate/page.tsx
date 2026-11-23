"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { activateApplicantAccount } from "@/server/actions/onboarding";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, ArrowRight, ArrowLeft, AlertCircle, Sparkles, KeyRound, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AmbientBackground, FadeIn } from "@/components/motion";

function ActivateAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("No activation token was provided.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await activateApplicantAccount({
      token,
      password,
      confirmPassword,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Failed to activate account.");
      return;
    }

    // Redirect to station or console based on provisioned role
    if (res.kitchenId) {
      router.push(`/kitchen/${res.kitchenId}/morning`);
    } else {
      router.push("/founder");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <AmbientBackground variant="auth" />
      <FadeIn direction="up" distance={16} className="w-full max-w-md space-y-6 relative z-10">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">Account Activation</span>
            <ThemeToggle />
          </div>
        </div>

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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/30 text-primary border border-primary/20 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>APPROVED APPLICATION</span>
          </div>

          <h1 className="font-heading text-3xl font-bold tracking-tight text-primary">
            Activate Your Account
          </h1>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Set a secure password for your verified institutional station account.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-center gap-3 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <Card className="cc-card border-border/80 shadow-md bg-card">
          <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-accent" />
          <CardHeader className="pb-4 pt-5">
            <CardTitle className="text-sm font-heading font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              Credentials Setup
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Your password will be salted and hashed with PBKDF2 before storage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="activate-password" className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <Input
                    id="activate-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="h-10 text-xs pl-9 pr-10 bg-background/60 border-border"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-2.5 p-1 text-muted-foreground hover:text-foreground rounded transition-colors focus:outline-hidden focus:ring-1 focus:ring-primary"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="activate-confirm-password" className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <Input
                    id="activate-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="h-10 text-xs pl-9 pr-10 bg-background/60 border-border"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    title={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    className="absolute right-3 top-2.5 p-1 text-muted-foreground hover:text-foreground rounded transition-colors focus:outline-hidden focus:ring-1 focus:ring-primary"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !password || password.length < 8}
                className="w-full h-10 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Activating Account...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Activate CookCue Account
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground font-medium underline underline-offset-4"
          >
            Already have an active account? Sign In
          </Link>
        </div>
      </FadeIn>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-xs">Loading activation...</div>}>
      <ActivateAccountContent />
    </Suspense>
  );
}
