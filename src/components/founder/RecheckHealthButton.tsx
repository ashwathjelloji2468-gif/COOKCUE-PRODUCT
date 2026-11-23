"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getEnvironmentDiagnostics } from "@/server/actions/environment";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

interface RecheckHealthButtonProps {
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function RecheckHealthButton({
  className = "",
  variant = "outline",
  size = "sm",
}: RecheckHealthButtonProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  async function handleRecheck() {
    setChecking(true);
    setFeedback(null);

    try {
      const res = await getEnvironmentDiagnostics();
      if (!res.success) {
        setFeedback({ success: false, message: res.error });
      } else {
        const latency = res.data.database.latencyMs;
        setFeedback({
          success: true,
          message: `Health check passed (${latency !== null ? `${latency}ms latency` : "operational"})`,
        });
        router.refresh();
      }
    } catch (e: any) {
      setFeedback({
        success: false,
        message: e?.message || "Failed to execute health check",
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleRecheck}
        disabled={checking}
        variant={variant}
        size={size}
        className={`gap-1.5 font-semibold shadow-xs ${className}`}
        title="Run safe database and runtime health checks"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin text-primary" : ""}`} />
        <span>{checking ? "Checking..." : "Run health check"}</span>
      </Button>

      {feedback && (
        <span
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border animate-in fade-in duration-200 ${
            feedback.success
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/25 text-destructive"
          }`}
        >
          {feedback.success ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3 h-3 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </span>
      )}
    </div>
  );
}
