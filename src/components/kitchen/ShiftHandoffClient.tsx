"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShiftHandoffCard } from "@/components/kitchen/ShiftHandoffCard";
import { useFloorMode } from "@/context/FloorModeContext";
import type { ShiftHandoffSummary } from "@/server/actions/shift-handoff";
import { cn } from "@/lib/utils";

interface ShiftHandoffClientProps {
  initialData: ShiftHandoffSummary;
  kitchenId: string;
}

export function ShiftHandoffClient({ initialData, kitchenId }: ShiftHandoffClientProps) {
  const router = useRouter();
  const { floorMode } = useFloorMode();

  const [date, setDate] = useState(initialData.date);
  const [mealType, setMealType] = useState(initialData.mealType);

  function handleFilterChange(newDate: string, newMeal: string) {
    setDate(newDate);
    setMealType(newMeal);
    router.push(`/kitchen/${kitchenId}/handoff?date=${newDate}&mealType=${newMeal}`);
  }

  function handleResetToday() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    const h = now.getHours();
    const currentMeal = h < 11 ? "BREAKFAST" : h < 16 ? "LUNCH" : "DINNER";
    handleFilterChange(today, currentMeal);
  }

  return (
    <div className="space-y-6">
      {/* Filter / Service Window Bar */}
      <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
        <CardContent className="p-3 sm:px-4 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold font-heading uppercase text-foreground">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Shift Window:</span>
            </div>

            {/* Meal Type Buttons */}
            <div className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-0.5">
              {(["BREAKFAST", "LUNCH", "DINNER"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleFilterChange(date, m)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-all",
                    floorMode && "min-h-[44px] px-3 font-bold",
                    mealType === m
                      ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m.charAt(0) + m.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Date Input */}
            <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="date"
                value={date}
                onChange={(e) => handleFilterChange(e.target.value, mealType)}
                className={cn(
                  "h-8 rounded-md border border-input bg-card px-2 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  floorMode && "h-11 text-sm font-semibold"
                )}
              />
            </div>
          </div>

          {/* Reset to Today's Current Shift */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToday}
            className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Current Shift</span>
          </Button>
        </CardContent>
      </Card>

      {/* Main Shift Handoff Card */}
      <ShiftHandoffCard data={initialData} />
    </div>
  );
}
