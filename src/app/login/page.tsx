"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCredentials } from "@/server/actions/auth";
import { setClientSession } from "@/lib/auth/useCurrentUser";
import { getPostLoginRedirect } from "@/lib/auth/redirect";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AmbientBackground, FadeIn } from "@/components/motion";
import {
  ArrowRight,
  AlertCircle,
  Lock,
  Mail,
  UtensilsCrossed,
  Sparkles,
  KeyRound,
  ShieldCheck,
  Building2,
  ChefHat,
  Users,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  type RoleOption,
  type RoleMetadata,
  PUBLIC_ROLES,
  ALL_ROLES,
} from "@/lib/auth/login-roles";



function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize initial role from query parameter if provided
  useEffect(() => {
    const roleParam = searchParams.get("role")?.toUpperCase();
    const isDirect = searchParams.get("direct") === "true";
    const redirectParam = searchParams.get("redirect");

    if (roleParam === "FOUNDER" || isDirect || redirectParam?.startsWith("/founder")) {
      setSelectedRole("FOUNDER");
    } else if (
      roleParam === "CONTRACTOR_MANAGER" ||
      roleParam === "HEAD_COOK" ||
      roleParam === "KITCHEN_STAFF"
    ) {
      setSelectedRole(roleParam as RoleOption);
    }

    const errorParam = searchParams.get("error");
    if (errorParam === "missing_assignment") {
      setError(
        "Your account is verified and active, but no operational facility or catering organization is assigned yet. Please contact your contractor administrator or platform support."
      );
    } else if (errorParam === "session_expired") {
      setError("Your operational session has expired. Please sign in again.");
    } else if (errorParam === "invalid_session") {
      setError("Your session was invalid or signed out. Please sign in again.");
    }
  }, [searchParams]);

  const activeRoleMeta = selectedRole ? ALL_ROLES.find((r) => r.id === selectedRole) : null;

  async function handleCredentialLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);
    const res = await signInWithCredentials(email, password);
    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    // Update client session state immediately
    setClientSession({
      id: res.user.id,
      code: res.user.code,
      name: res.user.name || res.user.email.split("@")[0],
      role: res.user.role,
      email: res.user.email,
      kitchenId: res.user.kitchenId,
      contractorId: res.user.contractorId,
    });

    // Real DB role determines the redirection route, regardless of chooser selection
    const targetUrl = getPostLoginRedirect(res.user);
    window.location.href = targetUrl;
  }

  return (
    <FadeIn direction="up" distance={16} duration={0.4} className="w-full max-w-md space-y-6 relative z-10">
      {/* Editorial Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/20 text-accent text-xs font-semibold tracking-wide">
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>INSTITUTIONAL FOOD INTELLIGENCE</span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-center">
            <Link
              href="/"
              title="Go to CookCue Dashboard"
              className="p-2 rounded-2xl bg-primary/10 border border-primary/20 shadow-sm inline-flex items-center justify-center transition-all duration-150 hover:shadow-md cursor-pointer"
            >
              <Image
                src="/cookcue-logo.png"
                alt="CookCue"
                width={140}
                height={40}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>
          </div>
          <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
            <h1 className="text-xl font-bold text-foreground font-heading">
              CookCue Workspace
            </h1>
          </Link>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            The right amount. At the right time. Intelligence in every meal.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-center gap-3 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Unified Credential Sign In Card */}
      <Card className="border-border shadow-md bg-card overflow-hidden transition-colors">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-accent-soft" />
        <CardHeader className="pb-3 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-heading font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                <span>Sign In with Credentials</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {activeRoleMeta
                  ? `Enter verified credentials for ${activeRoleMeta.title}.`
                  : "Enter your authorized credentials to access your station or console."}
              </CardDescription>
            </div>
            {activeRoleMeta ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-muted text-foreground border border-border">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span>{activeRoleMeta.badgeLabel}</span>
              </span>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary bg-accent-soft px-2.5 py-1 rounded-full border border-primary/20">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span>Verified Access</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCredentialLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder={activeRoleMeta?.emailPlaceholder || "headcook@central-kitchen-a.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  aria-invalid={Boolean(error)}
                  className="h-10 text-xs pl-9"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block">
                  Password
                </label>
                <span className="text-[10px] text-muted-foreground">Authorized personnel</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  aria-invalid={Boolean(error)}
                  className="h-10 text-xs pl-9 pr-10"
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
            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-10 text-xs font-semibold mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  Verifying Credentials...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>Sign In with Credentials</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Role Station Directory */}
      <div className="space-y-2 pt-1">
        <div className="text-[11px] font-semibold text-muted-foreground text-center">
          Role Station Directory
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PUBLIC_ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  setSelectedRole(isSelected ? null : role.id);
                  if (!email) setEmail(role.emailPlaceholder);
                }}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center group ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-xs"
                    : "border-border bg-card/60 hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <Icon className={`w-4 h-4 mb-1 ${role.accentColor}`} />
                <span className="text-[11px] font-bold text-foreground block truncate w-full">
                  {role.title}
                </span>
                <span className="text-[9px] text-muted-foreground block truncate w-full">
                  {role.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Onboarding Applicant Direct Paths */}
      <div className="pt-2 border-t border-border/60">
        <div className="text-[11px] font-semibold text-muted-foreground text-center mb-2">
          New to CookCue? Apply for facility access:
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Link
            href="/onboard?type=contractor"
            className="flex flex-col items-center justify-center p-2 rounded-lg border border-border bg-card/60 hover:bg-muted text-center transition-colors group"
          >
            <Building2 className="w-4 h-4 mb-1 text-amber-500 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-foreground">Register Contractor</span>
            <span className="text-[9px] text-muted-foreground">New organization</span>
          </Link>
          <Link
            href="/onboard?type=head_cook"
            className="flex flex-col items-center justify-center p-2 rounded-lg border border-border bg-card/60 hover:bg-muted text-center transition-colors group"
          >
            <ChefHat className="w-4 h-4 mb-1 text-[#D9EF79] group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-foreground">Apply as Head Cook</span>
            <span className="text-[9px] text-muted-foreground">Recipe station</span>
          </Link>
          <Link
            href="/onboard?type=staff"
            className="flex flex-col items-center justify-center p-2 rounded-lg border border-border bg-card/60 hover:bg-muted text-center transition-colors group"
          >
            <Users className="w-4 h-4 mb-1 text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-foreground">Apply as Staff</span>
            <span className="text-[9px] text-muted-foreground">Kitchen floor</span>
          </Link>
        </div>
      </div>

      {/* Footer reassurance & legal links */}
      <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground font-medium pt-2">
        <span>Deterministic Baselines</span>
        <span>•</span>
        <span>Zero Black Boxes</span>
        <span>•</span>
        <span>Audited Snapshots</span>
      </div>
      <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground pt-1">
        <Link href="/faq" className="hover:text-foreground underline underline-offset-2 transition-colors">
          FAQ
        </Link>
        <Link href="/terms" className="hover:text-foreground underline underline-offset-2 transition-colors">
          Terms &amp; Disclaimers
        </Link>
        <a href="mailto:cookcue149@gmail.com" className="hover:text-foreground underline underline-offset-2 transition-colors">
          cookcue149@gmail.com
        </a>
      </div>
    </FadeIn>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen text-foreground bg-background flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden transition-colors">
      {/* Top-Right Theme Toggle */}
      <div className="absolute top-5 right-5 sm:top-6 sm:right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Decorative ambient subtle background glows */}
      <AmbientBackground variant="auth" />

      <Suspense fallback={<div className="text-xs text-muted-foreground">Loading workspace...</div>}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}
