"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { DEMO_TOUR_STEPS, type TourStep } from "@/lib/domain/demo-tour";
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Trash2,
  Sparkles,
  ChevronRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { runPurgeDemoAsFounder } from "@/server/actions/demo-walkthrough";

interface TourState {
  active: boolean;
  currentStep: number;
  kitchenId?: string;
}

export function DemoTourPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const [tourState, setTourState] = useState<TourState | null>(null);
  const [purging, setPurging] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Sync state from localStorage
  const syncTourState = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("cookcue_demo_tour");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.active) {
          setTourState(parsed);
          return;
        }
      }
      setTourState(null);
    } catch {
      setTourState(null);
    }
  };

  useEffect(() => {
    syncTourState();

    const handleUpdate = () => syncTourState();
    window.addEventListener("cookcue_tour_update", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("cookcue_tour_update", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  if (!tourState || !tourState.active) {
    return null;
  }

  const currentStepIndex = Math.max(0, Math.min(tourState.currentStep - 1, DEMO_TOUR_STEPS.length - 1));
  const step = DEMO_TOUR_STEPS[currentStepIndex];
  const isFirst = tourState.currentStep === 1;
  const isLast = tourState.currentStep === DEMO_TOUR_STEPS.length;
  const progressPercent = (tourState.currentStep / DEMO_TOUR_STEPS.length) * 100;

  function updateStep(nextStepNumber: number) {
    const updated: TourState = {
      ...tourState!,
      currentStep: nextStepNumber,
    };
    setTourState(updated);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("cookcue_demo_tour", JSON.stringify(updated));
    }
    const targetStep = DEMO_TOUR_STEPS[nextStepNumber - 1];
    if (targetStep) {
      router.push(targetStep.getPath(tourState?.kitchenId));
    }
  }

  function endTour() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("cookcue_demo_tour");
      window.dispatchEvent(new Event("cookcue_tour_update"));
    }
    setTourState(null);
  }

  async function handleEndAndPurge() {
    setPurging(true);
    await runPurgeDemoAsFounder();
    setPurging(false);
    endTour();
    router.push("/founder");
    router.refresh();
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-96 select-none">
      <AnimatePresence mode="wait">
        {minimized ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border-2 border-primary/40 shadow-xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-heading font-bold text-foreground">
                Demo Walkthrough ({tourState.currentStep}/6)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMinimized(false)}
                className="h-7 text-xs px-2"
              >
                Expand
              </Button>
              <button
                type="button"
                onClick={endTour}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
                title="End tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="rounded-2xl bg-card border-2 border-primary/30 shadow-2xl overflow-hidden backdrop-blur-md"
          >
            {/* Header */}
            <div className="p-3.5 bg-muted/40 border-b border-border/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs">
                  <Compass className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-heading font-bold text-foreground">
                    Partner Walkthrough
                  </h4>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Step {tourState.currentStep} of {DEMO_TOUR_STEPS.length}: {step.badge}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
                  title="Minimize tour"
                >
                  Min
                </button>
                <button
                  type="button"
                  onClick={endTour}
                  className="p-1 rounded text-muted-foreground hover:text-foreground"
                  title="Close tour"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 w-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Coach Content */}
            <div className="p-4 space-y-3">
              <div>
                <h5 className="font-heading font-bold text-xs text-foreground mb-1">
                  {step.title}
                </h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.coach}
                </p>
              </div>

              {/* Step checklist indicators */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/50">
                {DEMO_TOUR_STEPS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updateStep(s.id)}
                    title={`Step ${s.id}: ${s.title}`}
                    className={`h-6 flex-1 rounded text-[10px] font-bold transition-all flex items-center justify-center ${
                      s.id === tourState.currentStep
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : s.id < tourState.currentStep
                        ? "bg-success-soft text-success"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {s.id < tourState.currentStep ? <Check className="w-3 h-3" /> : s.id}
                  </button>
                ))}
              </div>

              {/* Controls */}
              <div className="pt-2 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateStep(tourState.currentStep - 1)}
                  disabled={isFirst}
                  className="h-8 gap-1 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </Button>

                {isLast ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={endTour}
                    className="h-8 gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-soft" />
                    <span>Complete Tour</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => updateStep(tourState.currentStep + 1)}
                    className="h-8 gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5 text-accent-soft" />
                  </Button>
                )}
              </div>

              {/* End & Purge prompt */}
              <div className="pt-1 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <button
                  type="button"
                  onClick={endTour}
                  className="hover:underline"
                >
                  Dismiss tour
                </button>
                <button
                  type="button"
                  onClick={handleEndAndPurge}
                  disabled={purging}
                  className="text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{purging ? "Purging..." : "End & purge demo"}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
