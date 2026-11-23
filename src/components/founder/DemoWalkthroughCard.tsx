"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getDemoKitchenIdAsFounder,
  runSeedDemoAsFounder,
  runPurgeDemoAsFounder,
} from "@/server/actions/demo-walkthrough";
import {
  Compass,
  Play,
  Database,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function DemoWalkthroughCard() {
  const router = useRouter();
  const [demoKitchen, setDemoKitchen] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [purging, setPurging] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    getDemoKitchenIdAsFounder().then((res) => {
      if (res.success && res.data) {
        setDemoKitchen(res.data);
      }
      setLoading(false);
    });
  }, []);

  function startTour(kitchenId: string) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "cookcue_demo_tour",
        JSON.stringify({
          active: true,
          currentStep: 1,
          kitchenId,
        })
      );
      window.dispatchEvent(new Event("cookcue_tour_update"));
    }
    router.push("/founder");
  }

  async function handleLoadAndStart() {
    setSeeding(true);
    setFeedback(null);
    const res = await runSeedDemoAsFounder();
    setSeeding(false);

    if (!res.success) {
      setFeedback(res.error);
      return;
    }

    setDemoKitchen({ id: res.data.demoKitchenId, name: "Central Kitchen A" });
    startTour(res.data.demoKitchenId);
  }

  async function handlePurgeDemo() {
    setPurging(true);
    setFeedback(null);
    const res = await runPurgeDemoAsFounder();
    setPurging(false);

    if (!res.success) {
      setFeedback(res.error);
      return;
    }

    setDemoKitchen(null);
    setFeedback("Demo dataset purged successfully.");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("cookcue_demo_tour");
      window.dispatchEvent(new Event("cookcue_tour_update"));
    }
    router.refresh();
  }

  return (
    <Card className="border-[var(--card-border)] shadow-xs bg-gradient-to-br from-card via-card to-primary/5 rounded-xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-[var(--card-border)] bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
              Demo walkthrough
            </CardTitle>
            <CardDescription className="text-xs text-[var(--muted)]">
              Guided tour of the daily kitchen loop
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3.5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Walk partners through platform operations, contractor oversight, Head Cook morning planning, staff execution, and evening closeout in one seamless flow.
        </p>

        {feedback && (
          <div className="text-[11px] p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-medium">
            {feedback}
          </div>
        )}

        <div className="pt-1 flex flex-col gap-2">
          {demoKitchen ? (
            <>
              <Button
                onClick={() => startTour(demoKitchen.id)}
                className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs"
              >
                <Play className="w-3.5 h-3.5 text-accent-soft" />
                <span>Start Walkthrough</span>
              </Button>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground truncate">
                  Target: <strong>{demoKitchen.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={handlePurgeDemo}
                  disabled={purging}
                  className="text-[11px] text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{purging ? "Purging..." : "Purge Demo"}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <Button
                onClick={handleLoadAndStart}
                disabled={seeding || loading}
                className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs"
              >
                <Database className="w-3.5 h-3.5 text-accent-soft" />
                <span>{seeding ? "Provisioning Demo..." : "Load Demo Data & Start"}</span>
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                Seeds demo facilities, dishes &amp; sample staff. Wipe anytime with Purge Demo.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
