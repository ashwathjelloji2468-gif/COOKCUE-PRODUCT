"use client";

import React from "react";
import { useFloorMode } from "@/context/FloorModeContext";
import { Smartphone, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloorModeToggleProps {
  className?: string;
  variant?: "pill" | "compact";
}

export function FloorModeToggle({ className, variant = "pill" }: FloorModeToggleProps) {
  const { floorMode, toggleFloorMode } = useFloorMode();

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={toggleFloorMode}
        aria-pressed={floorMode}
        title={
          floorMode
            ? "Floor mode is ON (Simplified high-contrast mobile view). Click to switch to normal Ops density."
            : "Floor mode is OFF. Click to enable large touch targets and simplified view for phone/station use."
        }
        className={cn(
          "h-9 px-2.5 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all",
          floorMode
            ? "bg-primary text-primary-foreground border-primary shadow-xs"
            : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/40",
          className
        )}
      >
        <Smartphone className={cn("w-3.5 h-3.5", floorMode ? "text-accent-soft" : "text-primary")} />
        <span className="hidden sm:inline">Floor</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleFloorMode}
      aria-pressed={floorMode}
      title={
        floorMode
          ? "Floor mode is ON (High legibility, larger buttons, simplified copy). Click to return to standard Ops density."
          : "Enable Floor mode for phone and kitchen station use (larger type, ≥44px buttons, minimal chrome)."
      }
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
        floorMode
          ? "bg-primary text-primary-foreground border-primary shadow-xs"
          : "bg-card text-muted-foreground border-border/80 hover:text-foreground hover:bg-muted/30",
        className
      )}
    >
      <Smartphone className={cn("w-3.5 h-3.5", floorMode ? "text-accent-soft" : "text-muted-foreground")} />
      <span>Floor mode</span>
      <span
        className={cn(
          "text-[10px] uppercase font-bold px-1.5 py-0.2 rounded font-mono ml-0.5",
          floorMode
            ? "bg-primary/20 text-accent-soft border border-accent-soft/30"
            : "bg-muted text-muted-foreground"
        )}
      >
        {floorMode ? "ON" : "OFF"}
      </span>
    </button>
  );
}
