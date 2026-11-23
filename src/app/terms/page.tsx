import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  FileText,
  Shield,
  ChefHat,
  Users,
  AlertTriangle,
  Scale,
  Sparkles,
  Mail,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Terms of Service & Operational Disclaimers — CookCue",
  description:
    "Terms of service, operational responsibilities, recognition of kitchen personnel, and culinary disclaimers for the CookCue platform.",
};

export default function TermsPage() {
  return (
    <div
      className="min-h-screen text-[var(--foreground)] selection:bg-[var(--accent)] selection:text-white flex flex-col font-sans relative overflow-x-hidden transition-colors"
      style={{ background: "var(--background)" }}
    >
      {/* 1. Sticky Navigation Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md border-b transition-colors"
        style={{
          background: "var(--header-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 px-2.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-xs">
              <Image
                src="/cookcue-logo.png"
                alt="CookCue"
                width={100}
                height={28}
                className="h-6 w-auto object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-foreground font-heading">
                CookCue
              </span>
              <span className="text-[10px] text-muted-foreground font-medium -mt-1 hidden sm:block">
                Intelligence in every meal
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/founder"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-accent-foreground bg-accent hover:bg-accent/90 shadow-xs transition-all"
            >
              <span>Open app</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10">
        {/* Page Title & Back Link */}
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
          <div className="text-xs font-bold tracking-widest text-[var(--accent)] uppercase font-mono">
            Legal &amp; Operational Governance
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] font-heading">
            Terms of Service &amp; Operational Disclaimers
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-2xl">
            Effective Date: November 12, 2026 &middot; Version 1.2
          </p>
        </div>

        {/* Section 1: Agreement & Description */}
        <Card className="border-[var(--card-border)] bg-[var(--card)] shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[var(--card-border)]/60 bg-muted/15">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              <CardTitle className="text-base font-bold font-heading text-[var(--foreground)]">
                1. Agreement and Service Description
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of the CookCue dining intelligence software platform (&ldquo;CookCue&rdquo;, &ldquo;Service&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;). By accessing the platform, creating an account, or submitting operational telemetry, catering organizations, institutional dining administrators, and kitchen operators agree to be bound by these Terms.
            </p>
            <p>
              CookCue provides multi-kitchen portion calculation, morning prep review, Staff Board execution interfaces, closeout tracking, and historical baseline analytics. CookCue operates on <strong>pure, transparent arithmetic</strong> derived from eligible historical services.
            </p>
          </CardContent>
        </Card>

        {/* Section 2: User Roles & Operational Responsibilities */}
        <Card className="border-[var(--card-border)] bg-[var(--card)] shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[var(--card-border)]/60 bg-muted/15">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-[var(--accent)]" />
              <CardTitle className="text-base font-bold font-heading text-[var(--foreground)]">
                2. User Roles and Operational Responsibilities
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            <p>
              Access to CookCue is divided into role-based authorities to ensure operational separation of duties:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="p-3.5 rounded-xl border border-[var(--card-border)] bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--foreground)]">
                  <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Platform Founder</span>
                </div>
                <p className="text-[11px] leading-normal">
                  Maintains core system integrity, provisions contractor organizations, monitors telemetry across all participating kitchens, and manages demo environments.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-[var(--card-border)] bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--foreground)]">
                  <Scale className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Contractor Director</span>
                </div>
                <p className="text-[11px] leading-normal">
                  Oversees client accounts, provisions kitchen facilities, monitors operational exception inboxes, and audits multi-kitchen closeout discipline.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-[var(--card-border)] bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--foreground)]">
                  <ChefHat className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Head Cook</span>
                </div>
                <p className="text-[11px] leading-normal">
                  Holds single operational approval authority over morning batch targets. Reviews baseline figures, adjusts for on-the-ground conditions, and grants approval before cooking begins.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-[var(--card-border)] bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--foreground)]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Kitchen Line Staff</span>
                </div>
                <p className="text-[11px] leading-normal">
                  Executes approved targets using the live Staff Board and enters accurate closeout observations (diners served, cooked weights, and unserved leftovers).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Recognition of Head Cooks and Staff */}
        <Card className="border-[var(--card-border)] bg-[var(--card)] shadow-xs rounded-2xl overflow-hidden border-l-4 border-l-[var(--accent)]">
          <CardHeader className="pb-3 border-b border-[var(--card-border)]/60 bg-muted/15">
            <div className="flex items-center gap-2.5">
              <ChefHat className="w-4 h-4 text-[var(--accent)]" />
              <CardTitle className="text-base font-bold font-heading text-[var(--foreground)]">
                3. Recognition of Head Cooks and Kitchen Staff
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            <p>
              <strong>Professional Value:</strong> CookCue formally recognizes that daily good-faith morning plan approvals, diligent batch adherence, and honest closeout entries are high-value professional practices. The intelligence and financial stewardship of any dining operation rest entirely upon the discipline of the kitchen team.
            </p>
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-300 text-xs space-y-1.5">
              <p className="font-semibold">
                No Employment or Direct Compensation Relationship:
              </p>
              <p>
                Platform recognition, operational status badges, and software praise are purely ergonomic and educational features of CookCue. <strong>They do NOT create or imply any employment relationship, agency, labor contract, wage claim, overtime right, or bonus entitlement between CookCue and individual kitchen personnel.</strong> All employment contracts, compensation, benefits, and labor obligations remain exclusively between the respective catering contractor or dining institution and its employees.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Culinary & Food Safety Disclaimer */}
        <Card className="border-[var(--card-border)] bg-[var(--card)] shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[var(--card-border)]/60 bg-muted/15">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-base font-bold font-heading text-[var(--foreground)]">
                4. Culinary Judgment and Food Safety Disclaimers
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            <p>
              <strong>Culinary Authority Stays in the Kitchen:</strong> CookCue delivers mathematical planning benchmarks. It does not replace professional culinary training or sensory evaluation. The Head Cook and kitchen staff retain sole responsibility for ingredient inspection, seasoning, recipe execution, and menu balance.
            </p>
            <p>
              <strong>Food Safety &amp; HACCP Compliance:</strong> The user and catering contractor are solely responsible for ensuring food safety, internal cooking temperatures, holding hot and cold tables, hazard analysis critical control points (HACCP), and preventing allergen cross-contamination. CookCue disclaims all liability for foodborne illnesses, spoiled ingredients, or health code infractions.
            </p>
            <p>
              <strong>No Guaranteed Financial Savings:</strong> CookCue assists in identifying historical consumption trends to minimize preventable waste. However, CookCue does NOT warrant or guarantee specific cost reductions, percentage savings, budget outcomes, or dining attendance figures.
            </p>
          </CardContent>
        </Card>

        {/* Section 5: Acceptable Use & Data */}
        <Card className="border-[var(--card-border)] bg-[var(--card)] shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[var(--card-border)]/60 bg-muted/15">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-[var(--accent)]" />
              <CardTitle className="text-base font-bold font-heading text-[var(--foreground)]">
                5. Acceptable Use and Telemetry Data
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            <p>
              Users agree to submit truthful, accurate operational observations. Submitting fabricated closeout records corrupts historical baseline learning for the entire kitchen. Users may not scrape the platform, attempt unauthorized credential escalation, reverse-engineer proprietary schemas, or probe infrastructure outside their authorized organizational scope.
            </p>
            <p>
              Operational telemetry (meal dates, dish quantities, diners served, leftover weights, and audit logs) is stored securely to power forecasting algorithms and multi-kitchen monitoring dashboards.
            </p>
          </CardContent>
        </Card>

        {/* Section 6: Demo Data Policy */}
        <Card className="border-[var(--card-border)] bg-[var(--card)] shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[var(--card-border)]/60 bg-muted/15">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[var(--accent)]" />
              <CardTitle className="text-base font-bold font-heading text-[var(--foreground)]">
                6. Demonstration Data and Purge Policy
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            <p>
              Synthetic demo data generated through the Founder Walkthrough feature is intended exclusively for partner evaluation and instructional tours. CookCue reserves the right to purge synthetic demo records at any time without prior notice.
            </p>
          </CardContent>
        </Card>

        {/* Section 7: Limitation of Liability & Contact */}
        <Card className="border-[var(--card-border)] bg-[var(--card)] shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[var(--card-border)]/60 bg-muted/15">
            <div className="flex items-center gap-2.5">
              <Scale className="w-4 h-4 text-[var(--accent)]" />
              <CardTitle className="text-base font-bold font-heading text-[var(--foreground)]">
                7. Limitation of Liability, Amendments, and Contact
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            <p>
              To the maximum extent permitted by applicable law, CookCue is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any kind. Under no circumstances shall CookCue or its operators be liable for indirect, incidental, punitive, or consequential damages arising from service interruptions or food preparation outcomes.
            </p>
            <p>
              We may revise these Terms periodically. Substantive updates will be published to this page with a revised effective date.
            </p>
            <div className="pt-3 border-t border-[var(--card-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-[var(--muted)]">
                Legal notices, terms inquiries, and official correspondence:
              </span>
              <a
                href="mailto:cookcue149@gmail.com"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>cookcue149@gmail.com</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* 3. Footer */}
      <footer
        className="border-t py-8 px-4 sm:px-6 relative z-10 transition-colors mt-12"
        style={{
          background: "var(--background)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--foreground)]">CookCue</span>
            <span>&middot;</span>
            <span>Deterministic portion intelligence</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-[var(--foreground)] transition-colors">
              Home
            </Link>
            <Link href="/faq" className="hover:text-[var(--foreground)] transition-colors">
              FAQ
            </Link>
            <a href="mailto:cookcue149@gmail.com" className="hover:text-[var(--foreground)] transition-colors">
              cookcue149@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
