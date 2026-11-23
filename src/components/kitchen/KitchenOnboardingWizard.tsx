"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Compass,
  UtensilsCrossed,
  BookTemplate,
  ClipboardCheck,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFloorMode } from "@/context/FloorModeContext";
import type { KitchenOnboardingProgress, KitchenOnboardingStep } from "@/lib/domain/kitchen-onboarding";
import { cn } from "@/lib/utils";

interface KitchenOnboardingWizardProps {
  progress: KitchenOnboardingProgress;
  kitchenId: string;
}

const STEP_ICONS = {
  ADD_DISHES: UtensilsCrossed,
  SAVE_TEMPLATE: BookTemplate,
  APPROVE_PLAN: ClipboardCheck,
  SUBMIT_CLOSEOUT: CalendarDays,
  BUILD_BASELINE: TrendingUp,
};

export function KitchenOnboardingWizard({ progress, kitchenId }: KitchenOnboardingWizardProps) {
  const { floorMode } = useFloorMode();
  const storageKey = `cookcue-onboarding-dismissed-${kitchenId}`;

  const [isDismissed, setIsDismissed] = useState<boolean>(true); // default true until client checks localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const dismissed = localStorage.getItem(storageKey) === "true";
    setIsDismissed(dismissed);
  }, [storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setIsDismissed(true);
  };

  const handleRestore = () => {
    localStorage.removeItem(storageKey);
    setIsDismissed(false);
  };

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  // If dismissed or all steps completed and user opted out
  if (isDismissed) {
    if (progress.isComplete) return null;

    return (
      <div className="mb-6 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRestore}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-7 px-2.5"
        >
          <Compass className="w-3.5 h-3.5 text-primary" />
          <span>Show Kitchen Setup Wizard ({progress.completedCount}/{progress.total})</span>
        </Button>
      </div>
    );
  }

  const pct = Math.round((progress.completedCount / progress.total) * 100);

  return (
    <Card
      className={cn(
        "mb-6 border-primary/20 bg-card shadow-xs transition-all overflow-hidden",
        floorMode && "p-1"
      )}
    >
      {/* Card Header & Progress Bar */}
      <CardHeader className="pb-3 border-b border-border/60 bg-accent-soft/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Compass className="w-4 h-4" />
              </div>
              <CardTitle className={cn("font-heading font-bold text-foreground", floorMode ? "text-xl" : "text-base")}>
                {progress.isComplete ? "Kitchen Setup Complete!" : "Kitchen Setup & First Service Wizard"}
              </CardTitle>
            </div>
            <CardDescription className={cn("text-muted-foreground", floorMode ? "text-sm" : "text-xs")}>
              {progress.isComplete
                ? "All initial operational milestones achieved. Verified baseline recommendations are active."
                : `Complete essential steps to activate data-driven morning forecasts for ${progress.kitchenName}.`}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
              aria-label={isCollapsed ? "Expand wizard" : "Collapse wizard"}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground gap-1"
              title="Hide this wizard for this kitchen"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">I’m experienced — hide wizard</span>
            </Button>
          </div>
        </div>

        {/* Progress Bar & Counter */}
        <div className="pt-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-semibold text-foreground">
              {progress.completedCount} of {progress.total} milestones completed
            </span>
            <span className="font-bold text-primary">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2 bg-muted/30" />
        </div>
      </CardHeader>

      {/* Checklist Content */}
      {!isCollapsed && (
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="grid gap-2.5">
            {progress.steps.map((step, idx) => {
              const Icon = STEP_ICONS[step.id] || Compass;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-start sm:items-center justify-between gap-3 p-3 rounded-lg border transition-all",
                    step.done
                      ? "bg-muted/10 border-border/50 text-muted-foreground"
                      : "bg-card border-border hover:border-primary/40 shadow-2xs text-foreground",
                    floorMode && "p-4 min-h-[52px]"
                  )}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    {/* Status Checkmark */}
                    <div className="shrink-0 mt-0.5 sm:mt-0">
                      {step.done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center text-[10px] font-mono font-bold text-muted-foreground">
                          {idx + 1}
                        </div>
                      )}
                    </div>

                    {/* Step Info */}
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("w-3.5 h-3.5", step.done ? "text-muted-foreground" : "text-primary")} />
                        <span
                          className={cn(
                            "font-medium",
                            step.done && "line-through opacity-80",
                            floorMode ? "text-base font-semibold" : "text-xs font-semibold"
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                      {!floorMode && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {step.description}
                        </p>
                      )}
                      {step.detail && (
                        <p
                          className={cn(
                            "font-mono text-[10px]",
                            step.done ? "text-emerald-700 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400 font-semibold"
                          )}
                        >
                          • {step.detail}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Step Action Button */}
                  <div className="shrink-0 self-center">
                    <Button
                      asChild
                      size={floorMode ? "default" : "sm"}
                      variant={step.done ? "ghost" : "outline"}
                      className={cn(
                        "text-xs gap-1.5",
                        floorMode ? "min-h-[44px] px-4 font-semibold text-sm" : "h-7 px-2.5",
                        !step.done && "border-primary/40 hover:bg-accent-soft"
                      )}
                    >
                      <Link href={step.href}>
                        <span>{step.done ? "View" : step.actionText}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Primary Action Callout */}
          {progress.primaryCta && (
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60">
              <span className="text-xs text-muted-foreground font-mono">
                Recommended next step: <strong className="text-foreground">{progress.primaryCta.label.replace("Next: ", "")}</strong>
              </span>
              <Button
                asChild
                className={cn(
                  "bg-primary hover:bg-accent-hover text-primary-foreground font-semibold shadow-xs gap-1.5",
                  floorMode ? "min-h-[48px] text-base px-6" : "h-9 text-xs px-4"
                )}
              >
                <Link href={progress.primaryCta.href}>
                  <span>{progress.primaryCta.label}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
