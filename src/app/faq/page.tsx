import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  HelpCircle,
  Calculator,
  ChefHat,
  ClipboardCheck,
  Smartphone,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Mail,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Frequently Asked Questions — CookCue",
  description:
    "Learn about CookCue's deterministic portion forecasting, Head Cook approval model, closeout discipline, and operational architecture.",
};

const FAQ_ITEMS = [
  {
    id: "what-is-cookcue",
    icon: HelpCircle,
    badge: "Platform Overview",
    question: "What is CookCue?",
    answer: (
      <>
        CookCue is an institutional dining intelligence and portion planning platform engineered for high-volume kitchen operations—such as universities, hostels, corporate dining facilities, and catering contractors. CookCue bridges morning batch forecasting, real-time line execution on the Staff Board, and evening closeout logging into one synchronized daily loop.
      </>
    ),
  },
  {
    id: "not-ml",
    icon: Calculator,
    badge: "Deterministic Math",
    question: "Is CookCue artificial intelligence or machine learning?",
    answer: (
      <>
        <strong>No. CookCue does not use black-box machine learning or opaque neural networks.</strong> Every portion recommendation is computed using transparent, auditable arithmetic derived from your kitchen&apos;s clean, verified historical service baseline. If a dish has fewer than 3 eligible past observations, the system explicitly marks it as <em>insufficient history</em> rather than guessing.
      </>
    ),
  },
  {
    id: "head-cook-approval",
    icon: ChefHat,
    badge: "Human in Control",
    question: "Who approves the cooking targets?",
    answer: (
      <>
        The <strong>Head Cook retains full culinary authority</strong>. CookCue suggests mathematical targets based on expected diners and past per-diner consumption, but cooking never begins automatically. The Head Cook reviews the morning plan, makes any adjustments for weather, holidays, or inventory, and signs off with a single explicit approval.
      </>
    ),
  },
  {
    id: "closeout-discipline",
    icon: ClipboardCheck,
    badge: "Continuous Baseline",
    question: "Why does closeout discipline matter?",
    answer: (
      <>
        The intelligence of the platform depends entirely on accurate feedback. Recording actual diners served, total kilograms cooked, and unserved leftovers at the end of each meal teaches the system your exact dining patterns. This disciplined habit prevents repeated over-cooking and guards against dining hall stockouts during peak rushes.
      </>
    ),
  },
  {
    id: "floor-mode",
    icon: Smartphone,
    badge: "Station Ergonomics",
    question: "What is Floor Mode?",
    answer: (
      <>
        Floor Mode is an opt-in kitchen display mode tailored for phone screens and busy cooking stations. When enabled from the top bar, it enlarges typography, expands primary buttons to touch-friendly heights (&ge; 44px), and collapses secondary explanatory text so staff can focus purely on batch weights and fast closeout entry.
      </>
    ),
  },
  {
    id: "needs-attention",
    icon: AlertTriangle,
    badge: "Operational Exceptions",
    question: "What is the 'Needs attention' exception inbox?",
    answer: (
      <>
        Contractors and platform founders receive an automated operational inbox highlighting facilities that require intervention. It flags missing morning approvals before service windows, unsubmitted closeouts from completed meals, and recent food stockout incidents so directors don&apos;t have to manually inspect every kitchen.
      </>
    ),
  },
  {
    id: "demo-data",
    icon: Sparkles,
    badge: "Partner Walkthrough",
    question: "How do demo data and walkthroughs work?",
    answer: (
      <>
        Platform founders can initialize synthetic demonstration facilities, dishes, and staff accounts in one tap via the Founder dashboard to tour prospective catering partners through the daily loop. When the demonstration concludes, the <strong>Purge Demo</strong> command instantly removes all synthetic test records, returning the platform to a pristine state.
      </>
    ),
  },
  {
    id: "culinary-disclaimer",
    icon: ShieldCheck,
    badge: "Safety & Judgment",
    question: "Does CookCue provide culinary or food safety guarantees?",
    answer: (
      <>
        <strong>No.</strong> CookCue provides operational decision-support calculations and telemetry. All culinary judgment, safe cooking temperatures, allergen separation, hygiene, and hazard control (HACCP) remain strictly under the professional oversight and responsibility of the catering contractor and kitchen personnel.
      </>
    ),
  },
];

export default function FAQPage() {
  return (
    <div
      className="min-h-screen text-[var(--foreground)] selection:bg-[var(--accent)] selection:text-white flex flex-col font-sans relative overflow-x-hidden transition-colors"
      style={{ background: "var(--background)" }}
    >
      {/* 1. Header */}
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
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
        {/* Page Title & Hero */}
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
          <div className="text-xs font-bold tracking-widest text-[var(--accent)] uppercase font-mono">
            Platform Documentation &amp; Knowledge Base
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] font-heading">
            Frequently Asked Questions
          </h1>
          <p className="text-sm sm:text-base text-[var(--muted)] leading-relaxed max-w-2xl">
            Everything you need to know about CookCue&apos;s deterministic portion arithmetic, operator workflows, floor ergonomics, and deployment policies.
          </p>
        </div>

        {/* FAQ Grid / List */}
        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.id}
                id={item.id}
                className="cc-card border-border bg-card shadow-xs transition-colors rounded-2xl overflow-hidden"
              >
                <CardHeader className="pb-3 border-b border-border/60 bg-muted/15">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent-soft border border-border text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider mb-1">
                        {item.badge}
                      </Badge>
                      <CardTitle className="text-base font-bold font-heading text-foreground leading-snug">
                        {item.question}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Contact Banner */}
        <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card cc-card shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading text-foreground">
                Have a question not answered here?
              </h2>
              <p className="text-xs text-muted-foreground">
                Our platform operations and engineering team is available for inquiries and onboarding support.
              </p>
            </div>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Direct platform correspondence:
            </span>
            <a
              href="mailto:cookcue149@gmail.com"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-accent-foreground bg-accent hover:bg-accent/90 transition-all shrink-0"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>cookcue149@gmail.com</span>
            </a>
          </div>
        </div>
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
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">
              Terms &amp; Disclaimers
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
