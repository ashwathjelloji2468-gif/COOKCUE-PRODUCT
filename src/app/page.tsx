"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  CalendarDays,
  CheckCircle2,
  Building2,
  ChefHat,
  UtensilsCrossed,
  Users2,
  History,
  AlertOctagon,
  ShieldCheck,
  Scale,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  AmbientBackground,
  FadeIn,
  StaggerContainer,
  StaggerItem,
  HoverLift,
  PageSectionReveal,
} from "@/components/motion";

export default function Home() {
  return (
    <div
      className="min-h-screen text-[var(--foreground)] selection:bg-[var(--accent)] selection:text-white flex flex-col font-sans relative overflow-x-hidden transition-colors"
      style={{ background: "var(--background)" }}
    >
      {/* Decorative ambient subtle background glows & grid */}
      <AmbientBackground variant="hero" />

      {/* 1. Sticky Top Navigation */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md border-b transition-colors"
        style={{
          background: "var(--header-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Left: CookCue Logo + Wordmark */}
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
              <span className="text-xl font-bold tracking-tight text-[var(--foreground)] font-heading">
                CookCue
              </span>
              <span className="text-[10px] text-[var(--muted)] font-medium -mt-1 hidden sm:block">
                Intelligence in every meal
              </span>
            </div>
          </Link>

          {/* Right: Sign In + Primary Open app button + ThemeToggle */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/founder"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-accent-foreground bg-accent hover:bg-accent/90 shadow-xs hover:shadow-sm active:scale-[0.98] transition-all"
            >
              <span>Open app</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative z-10">
        {/* 2. Hero Section */}
        <section className="pt-16 sm:pt-24 pb-12 sm:pb-16 px-4 sm:px-6">
          <StaggerContainer
            staggerDelay={0.08}
            initialDelay={0.04}
            className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8"
          >
            {/* Pill Badge */}
            <StaggerItem>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/20 text-[var(--accent)] dark:text-emerald-400 text-xs font-semibold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] dark:text-emerald-400" />
                <span>The right amount. At the right time.</span>
              </div>
            </StaggerItem>

            {/* Big Headline (two lines) */}
            <StaggerItem>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[var(--foreground)] font-heading leading-[1.08]">
                Plan what to cook.
                <span className="block text-[var(--accent)] mt-1 sm:mt-2">
                  Understand what comes back.
                </span>
              </h1>
            </StaggerItem>

            {/* Supporting Paragraph */}
            <StaggerItem>
              <p className="text-base sm:text-xl text-[var(--muted)] max-w-2xl mx-auto font-normal leading-relaxed">
                Turn cooked-food and unserved-leftover records into transparent preparation
                recommendations—with the manager always in full control of final batch sizes.
              </p>
            </StaggerItem>

            {/* Two CTAs Side by Side */}
            <StaggerItem>
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2">
                <Link
                  href="/founder"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-base font-bold text-accent-foreground bg-accent hover:bg-accent/90 shadow-xs hover:shadow-sm active:scale-[0.98] transition-all"
                >
                  <span>Open Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/founder/monitoring"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-base font-semibold text-foreground bg-card hover:bg-muted border border-border shadow-xs active:scale-[0.98] transition-all"
                >
                  <span>View Monitoring</span>
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                </Link>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </section>

        {/* 3. Product Preview Card */}
        <section className="px-4 sm:px-6 pb-20 sm:pb-28">
          <PageSectionReveal yOffset={24}>
            <HoverLift y={-4} scale={1.008}>
              <div className="max-w-3xl mx-auto cc-card rounded-2xl border border-border shadow-sm p-6 sm:p-9 text-left relative overflow-hidden transition-colors">
                {/* Header & Status Label */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-border mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs sm:text-sm font-semibold tracking-wide text-muted-foreground uppercase font-mono">
                      Recommendation Preview · Example · Lunch service
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-accent-soft text-accent text-[11px] font-semibold border border-accent/20">
                    Verified Baseline
                  </span>
                </div>

                {/* Dish Info & Big Emerald Number */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6">
                  <div>
                    <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                      Sample Dish
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-heading mt-1">
                      Steamed Basmati Rice
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Primary lunch service grain · Measured in kilograms (kg)
                    </div>
                  </div>

                  <div className="sm:text-right bg-accent-soft/50 sm:bg-transparent p-4 sm:p-0 rounded-2xl border border-border sm:border-0">
                    <div className="text-xs uppercase font-bold tracking-wider text-primary">
                      Suggested Preparation
                    </div>
                    <div className="text-4xl sm:text-5xl font-black tracking-tight text-primary font-heading cc-num mt-1">
                      24.0 <span className="text-lg font-bold text-muted-foreground">kg</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Target for 120 expected diners
                    </div>
                  </div>
                </div>

                {/* Four Metric Boxes Underneath */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-3.5 transition-colors">
                    <div className="text-[11px] font-medium text-muted-foreground">History served</div>
                    <div className="text-lg font-bold font-heading cc-num text-foreground mt-0.5">90.0 kg</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Cooked − leftovers</div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 p-3.5 transition-colors">
                    <div className="text-[11px] font-medium text-muted-foreground">Eligible diners</div>
                    <div className="text-lg font-bold font-heading cc-num text-foreground mt-0.5">450</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Logged attendance</div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 p-3.5 transition-colors">
                    <div className="text-[11px] font-medium text-muted-foreground">Served/diner</div>
                    <div className="text-lg font-bold font-heading cc-num text-primary mt-0.5">0.200 kg</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">90.0 kg ÷ 450 diners</div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 p-3.5 transition-colors">
                    <div className="text-[11px] font-medium text-muted-foreground">Eligible meals</div>
                    <div className="text-lg font-bold font-heading cc-num text-foreground mt-0.5">3 of 4</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">1 stockout excluded</div>
                  </div>
                </div>

                {/* Tiny Formula Note at Bottom */}
                <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>Formula: 120 projected diners × 0.200 kg served/diner = 24.0 kg recommended target.</span>
                  <span className="font-semibold text-foreground">Manager confirms or overrides before cooking</span>
                </div>
              </div>
            </HoverLift>
          </PageSectionReveal>
        </section>

        {/* 4. Three-Step Operational Loop */}
        <section className="px-4 sm:px-6 py-16 sm:py-24 border-t border-[var(--card-border)] bg-[var(--card)]/40 backdrop-blur-sm transition-colors">
          <div className="max-w-5xl mx-auto">
            <PageSectionReveal yOffset={16}>
              <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-3">
                <div className="text-xs font-bold tracking-widest text-[var(--accent)] uppercase">
                  Daily Kitchen Rhythm
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] font-heading">
                  A structured three-step loop
                </h2>
                <p className="text-[var(--muted)] text-sm sm:text-base leading-relaxed">
                  Designed to integrate directly with morning batch cooking and post-meal closeout audits.
                </p>
              </div>
            </PageSectionReveal>

            <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
              {/* Card 1 */}
              <PageSectionReveal delay={0.05} yOffset={20}>
                <HoverLift y={-4} className="h-full">
                  <div className="cc-card rounded-2xl border border-border p-7 sm:p-8 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all h-full">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono font-bold text-primary">01</span>
                        <div className="w-10 h-10 rounded-xl bg-accent-soft border border-border flex items-center justify-center text-primary shadow-xs">
                          <ClipboardCheck className="w-5 h-5" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-foreground font-heading leading-snug">
                        Record closeout observations
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Log cooked batch quantities, unserved leftovers, headcount, and unusual runout events right after meal service ends.
                      </p>
                    </div>
                    <div className="pt-6 mt-6 border-t border-border flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground text-xs font-medium">
                        Cooked kg
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground text-xs font-medium">
                        Pan leftovers
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground text-xs font-medium">
                        Stockout flags
                      </span>
                    </div>
                  </div>
                </HoverLift>
              </PageSectionReveal>

              {/* Card 2 */}
              <PageSectionReveal delay={0.1} yOffset={20}>
                <HoverLift y={-4} className="h-full">
                  <div className="cc-card rounded-2xl border border-border p-7 sm:p-8 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all h-full">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono font-bold text-primary">02</span>
                        <div className="w-10 h-10 rounded-xl bg-accent-soft border border-border flex items-center justify-center text-primary shadow-xs">
                          <CalendarDays className="w-5 h-5" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-foreground font-heading leading-snug">
                        Enter the next meal’s parameters
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Set up the scheduled menu dishes and expected diner attendance before morning preparation and batch heating begin.
                      </p>
                    </div>
                    <div className="pt-6 mt-6 border-t border-border flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground text-xs font-medium">
                        Menu dishes
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground text-xs font-medium">
                        Meal type
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground text-xs font-medium">
                        Expected diners
                      </span>
                    </div>
                  </div>
                </HoverLift>
              </PageSectionReveal>

              {/* Card 3 */}
              <PageSectionReveal delay={0.15} yOffset={20}>
                <HoverLift y={-4} className="h-full">
                  <div className="cc-card rounded-2xl border border-border p-7 sm:p-8 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all h-full">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono font-bold text-primary">03</span>
                        <div className="w-10 h-10 rounded-xl bg-accent-soft border border-border flex items-center justify-center text-primary shadow-xs">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-foreground font-heading leading-snug">
                        Approve or adjust preparation
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Review the deterministic baseline per diner, then approve or adjust batch targets based on on-the-ground kitchen judgment.
                      </p>
                    </div>
                    <div className="pt-6 mt-6 border-t border-border flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground text-xs font-medium">
                        Suggested target
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground text-xs font-medium">
                        Manager override
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground text-xs font-medium">
                        Committed plan
                      </span>
                    </div>
                  </div>
                </HoverLift>
              </PageSectionReveal>
            </div>
          </div>
        </section>

        {/* 5. Social Proof Block */}
        <section className="px-4 sm:px-6 py-12 sm:py-16">
          <PageSectionReveal yOffset={20}>
            <div className="max-w-5xl mx-auto cc-card rounded-2xl border border-border p-8 sm:p-12 shadow-sm text-center space-y-8 transition-colors">
              {/* Row of Four Items with Icons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-8 border-b border-border">
                <div className="flex items-center justify-center gap-2.5 p-3 rounded-xl bg-muted/50 border border-border transition-colors">
                  <Building2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-foreground">Contractors</span>
                </div>
                <div className="flex items-center justify-center gap-2.5 p-3 rounded-xl bg-muted/50 border border-border transition-colors">
                  <ChefHat className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-foreground">Kitchen teams</span>
                </div>
                <div className="flex items-center justify-center gap-2.5 p-3 rounded-xl bg-muted/50 border border-border transition-colors">
                  <UtensilsCrossed className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-foreground">Head cooks</span>
                </div>
                <div className="flex items-center justify-center gap-2.5 p-3 rounded-xl bg-muted/50 border border-border transition-colors">
                  <Users2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-foreground">Founders &amp; ops</span>
                </div>
              </div>

              {/* Short Quote about Clear Numbers and Manager Control */}
              <blockquote className="max-w-2xl mx-auto text-lg sm:text-xl font-medium text-foreground font-heading leading-relaxed italic">
                “Sustainable food service operations depend on transparent arithmetic, clean historical data, and keeping kitchen managers firmly in control of daily batch decisions.”
              </blockquote>

              {/* Attribution */}
              <div className="text-xs uppercase font-bold tracking-widest text-primary">
                Designed for multi-kitchen food service operations
              </div>
            </div>
          </PageSectionReveal>
        </section>

        {/* 6. Trust / Transparency Section */}
        <section className="px-4 sm:px-6 py-16 sm:py-24 border-t border-border bg-card/40 backdrop-blur-sm transition-colors">
          <div className="max-w-5xl mx-auto space-y-12 sm:space-y-16">
            <PageSectionReveal yOffset={16}>
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <div className="text-xs font-bold tracking-widest text-primary uppercase">
                  Deterministic Integrity
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-heading">
                  Transparency and manager control
                </h2>
                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                  CookCue relies on clear arithmetic, observation quality filtering, and human verification—never opaque estimates.
                </p>
              </div>
            </PageSectionReveal>

            {/* 2×2 Grid */}
            <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
              {/* Card 1 */}
              <PageSectionReveal delay={0.05} yOffset={20}>
                <HoverLift y={-3} className="h-full">
                  <div className="cc-card rounded-2xl border border-border p-7 sm:p-8 shadow-xs flex items-start gap-4 transition-all h-full">
                    <div className="w-12 h-12 rounded-xl bg-accent-soft border border-border text-primary flex items-center justify-center shrink-0 shadow-xs">
                      <History className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-foreground font-heading">
                        Eligible historical services are visible
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        The plan interface explicitly displays the exact count and dates of past services that qualify for the baseline pool, so managers know the data volume behind every figure.
                      </p>
                    </div>
                  </div>
                </HoverLift>
              </PageSectionReveal>

              {/* Card 2 */}
              <PageSectionReveal delay={0.1} yOffset={20}>
                <HoverLift y={-3} className="h-full">
                  <div className="cc-card rounded-2xl border border-border p-7 sm:p-8 shadow-xs flex items-start gap-4 transition-all h-full">
                    <div className="w-12 h-12 rounded-xl bg-accent-soft border border-border text-primary flex items-center justify-center shrink-0 shadow-xs">
                      <AlertOctagon className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-foreground font-heading">
                        Stockouts and abnormal observations are excluded
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Meals flagged with runouts or unusual operational events are systematically excluded with specific documented reasons, preventing artificially low recommendations.
                      </p>
                    </div>
                  </div>
                </HoverLift>
              </PageSectionReveal>

              {/* Card 3 */}
              <PageSectionReveal delay={0.15} yOffset={20}>
                <HoverLift y={-3} className="h-full">
                  <div className="cc-card rounded-2xl border border-border p-7 sm:p-8 shadow-xs flex items-start gap-4 transition-all h-full">
                    <div className="w-12 h-12 rounded-xl bg-accent-soft border border-border text-primary flex items-center justify-center shrink-0 shadow-xs">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-foreground font-heading">
                        No numerical recommendation when history is insufficient
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        New menu dishes or stations lacking adequate eligible past service observations display an explicit insufficient history status rather than an unverified guess.
                      </p>
                    </div>
                  </div>
                </HoverLift>
              </PageSectionReveal>

              {/* Card 4 */}
              <PageSectionReveal delay={0.2} yOffset={20}>
                <HoverLift y={-3} className="h-full">
                  <div className="cc-card rounded-2xl border border-border p-7 sm:p-8 shadow-xs flex items-start gap-4 transition-all h-full">
                    <div className="w-12 h-12 rounded-xl bg-accent-soft border border-border text-primary flex items-center justify-center shrink-0 shadow-xs">
                      <Scale className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-foreground font-heading">
                        Suggested, approved, and actual quantities stay separate
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        System baseline suggestions, manager-approved prep targets, and actual post-service cooked quantities are stored as separate, permanent data points in the database.
                      </p>
                    </div>
                  </div>
                </HoverLift>
              </PageSectionReveal>
            </div>
          </div>
        </section>

        {/* 7. Final CTA */}
        <section className="px-4 sm:px-6 py-16 sm:py-24">
          <PageSectionReveal yOffset={24}>
            <div className="max-w-5xl mx-auto rounded-3xl sm:rounded-[32px] p-8 sm:p-16 text-center space-y-6 relative overflow-hidden shadow-lg border border-[var(--card-border)] bg-[#193227] dark:bg-[#121915] text-[#f5f5f4] transition-colors">
              {/* Subtle decorative inner ambient */}
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[var(--accent)]/15 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-white/5 blur-2xl pointer-events-none" />

              <div className="relative z-10 space-y-6">
                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#f5f5f4] font-heading">
                  Run CookCue for your kitchens
                </h2>
                <p className="max-w-xl mx-auto text-base sm:text-lg text-stone-200 dark:text-stone-200 font-normal leading-relaxed">
                  Deploy multi-kitchen monitoring, verified portion forecasting, and operational accountability across your institutional dining facilities.
                </p>
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-accent-foreground bg-accent hover:bg-accent/90 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                  >
                    <span>Get started</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </PageSectionReveal>
        </section>
      </main>

      {/* 8. Simple Footer */}
      <footer
        className="border-t py-10 px-4 sm:px-6 relative z-10 transition-colors"
        style={{
          background: "var(--background)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity" title="CookCue Home">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center p-1 shadow-xs">
                <Image
                  src="/cookcue-logo.png"
                  alt="CookCue Logo"
                  width={24}
                  height={24}
                  className="h-5 w-auto object-contain"
                />
              </div>
              <span className="font-bold text-[var(--foreground)] text-sm font-heading">CookCue</span>
            </Link>
            <span className="text-[var(--card-border)]">·</span>
            <span>The right amount. At the right time. Intelligence in every meal.</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[var(--muted)]">
            <Link href="/faq" className="hover:text-[var(--foreground)] transition-colors">
              FAQ
            </Link>
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">
              Terms &amp; Disclaimers
            </Link>
            <a href="mailto:cookcue149@gmail.com" className="hover:text-[var(--foreground)] transition-colors font-mono">
              cookcue149@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

