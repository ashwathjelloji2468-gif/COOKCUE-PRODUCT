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
  ArrowLeft,
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
  ChevronRight,
  CheckCircle2,
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

  function handleBackToChooser() {
    setSelectedRole(null);
    setError(null);
    setEmail("");
    setPassword("");
    setShowPassword(false);
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

      {/* STATE A: Initial Role Chooser */}
      {selectedRole === null ? (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground font-heading">
              Select Your Operational Role
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Choose your institutional assignment to access your dedicated station.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {PUBLIC_ROLES.map((role) => {
              const Icon = role.icon;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                  className="w-full p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-accent-soft/30 text-left transition-all duration-200 flex items-start justify-between group shadow-xs hover:shadow-sm"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-card border border-border group-hover:border-primary/40 flex items-center justify-center shrink-0 shadow-2xs transition-colors">
                      <Icon className={`w-5 h-5 ${role.accentColor}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-heading font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                        <span>{role.title}</span>
                      </div>
                      <div className="text-[11px] font-medium text-muted-foreground">
                        {role.subtitle}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                        {role.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-2.5 ml-2" />
                </button>
              );
            })}
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setSelectedRole("FOUNDER")}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 font-medium transition-colors"
            >
              Have universal credentials? Direct Sign In
            </button>
          </div>
        </div>
      ) : (
        /* STATE B: Role-Specific Sign In Form */
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBackToChooser}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to role selection</span>
            </button>

            {activeRoleMeta && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-muted text-foreground border border-border">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span>{activeRoleMeta.badgeLabel}</span>
              </span>
            )}
          </div>

          <Card className="border-border shadow-md bg-card overflow-hidden transition-colors">
            <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-accent-soft" />
            <CardHeader className="pb-4 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-heading font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary" />
                    {activeRoleMeta?.title} Sign In
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Enter your verified {activeRoleMeta?.subtitle.toLowerCase()} credentials.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary bg-accent-soft px-2.5 py-1 rounded-full border border-primary/20">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Verified Access</span>
                </div>
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
                      type="email"
                      placeholder={activeRoleMeta?.emailPlaceholder || "name@organization.com"}
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
                      {activeRoleMeta?.id === "FOUNDER"
                        ? "Sign In with Credentials"
                        : `Sign In as ${activeRoleMeta?.title || "Operator"}`}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Role-Specific Onboarding Link: Only shown for the selected role */}
          {activeRoleMeta?.onboardAction && (
            <div className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between gap-3 transition-colors">
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground font-heading">
                  {activeRoleMeta.onboardAction.label}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {activeRoleMeta.onboardAction.description}
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="text-xs shrink-0 h-8 border-border">
                <Link href={activeRoleMeta.onboardAction.href}>
                  Apply
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}

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
