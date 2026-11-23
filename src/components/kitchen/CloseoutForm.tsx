"use client";

import { useState, useEffect } from "react";
import {
  getApprovedPlanForMeal,
  submitCloseout,
  getRecentCloseoutsForKitchen,
  createUnplannedMealCloseout,
  getLastCloseoutPrefill,
} from "@/server/actions/closeout";
import { listDishesForKitchen } from "@/server/actions/morning-plan";
import {
  ArrowDownToLine,
  CheckCircle2,
  Calendar,
  Users,
  AlertTriangle,
  AlertCircle,
  PlusCircle,
  History,
  ClipboardList,
  X,
  Sliders,
  Sparkles,
  Save,
  HardDrive,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { motion, AnimatePresence } from "motion/react";
import {
  applyCloseoutMode,
  applyWholeMealAsPlanned,
  applyWholeMealRanOut,
  canApplyWholeMealCloseout,
  type CloseoutMode,
} from "@/lib/domain/closeout-modes";
import {
  saveCloseoutDraft,
  loadCloseoutDraft,
  clearCloseoutDraft,
  getCloseoutDraftKey,
  type CloseoutDraftPayload,
} from "@/lib/kitchen/closeout-draft";
import { CloseoutVarianceCard } from "@/components/kitchen/CloseoutVarianceCard";
import type { CloseoutVarianceSummary } from "@/lib/domain/closeout-variance";
import { useFloorMode } from "@/context/FloorModeContext";
import { cn } from "@/lib/utils";
import { KITCHEN_LABELS } from "@/lib/kitchen/labels";

type CloseoutItem = {
  dishId: string;
  dishName: string;
  approvedKg: number | null;
  totalCookedKg: string;
  unservedLeftoverKg: string;
  isStockout: boolean;
  isAbnormal: boolean;
  notes?: string;
};

function getLocalCalendarDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CloseoutForm({ kitchenId }: { kitchenId: string }) {
  const [mealType, setMealType] = useState("LUNCH");
  const { floorMode } = useFloorMode();
  const [date, setDate] = useState(getLocalCalendarDate);
  const [mealId, setMealId] = useState<string | null>(null);
  const [actualDiners, setActualDiners] = useState(100);
  const [planExpectedDiners, setPlanExpectedDiners] = useState<number | null>(null);
  const [items, setItems] = useState<CloseoutItem[]>([]);
  const [isUnplanned, setIsUnplanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPrefill, setLoadingPrefill] = useState(false);
  const [prefillBanner, setPrefillBanner] = useState<{ date: string } | null>(null);
  const [selectedMode, setSelectedMode] = useState<CloseoutMode>("CUSTOM");
  const [modeBanner, setModeBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [variance, setVariance] = useState<CloseoutVarianceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentRecords, setRecentRecords] = useState<
    {
      id: string;
      date: string;
      mealType: string;
      actualDiners: number | null;
      dishName: string;
      cookedKg: number | null;
      leftoverKg: number | null;
      isStockout: boolean;
      isAbnormal: boolean;
    }[]
  >([]);

  // Device-local draft states (offline capability)
  const [pendingDraft, setPendingDraft] = useState<CloseoutDraftPayload | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const draftKey = getCloseoutDraftKey({ kitchenId, date, mealType, mealId });

  // Monitor network online/offline state
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const onOnline = () => setIsOnline(true);
      const onOffline = () => setIsOnline(false);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      };
    }
  }, []);

  // Check for device draft when service selection changes
  useEffect(() => {
    const existing = loadCloseoutDraft(draftKey);
    if (existing && existing.items && existing.items.length > 0) {
      setPendingDraft(existing);
    } else {
      setPendingDraft(null);
    }
  }, [draftKey]);

  // Debounced auto-save to device (800ms) while user is editing items
  useEffect(() => {
    if (items.length === 0) return;
    const timer = setTimeout(() => {
      const payload: CloseoutDraftPayload = {
        kitchenId,
        date,
        mealType,
        mealId,
        actualDiners,
        planExpectedDiners,
        isUnplanned,
        selectedMode,
        items,
        savedAt: new Date().toISOString(),
      };
      saveCloseoutDraft(draftKey, payload);
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setDraftSavedAt(timeStr);
    }, 800);

    return () => clearTimeout(timer);
  }, [items, actualDiners, draftKey, kitchenId, date, mealType, mealId, planExpectedDiners, isUnplanned, selectedMode]);

  function handleExplicitSaveDraft() {
    if (items.length === 0) return;
    const payload: CloseoutDraftPayload = {
      kitchenId,
      date,
      mealType,
      mealId,
      actualDiners,
      planExpectedDiners,
      isUnplanned,
      selectedMode,
      items,
      savedAt: new Date().toISOString(),
    };
    saveCloseoutDraft(draftKey, payload);
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setDraftSavedAt(timeStr);
  }

  function handleRestoreDraft() {
    if (!pendingDraft) return;
    setMealId(pendingDraft.mealId || null);
    setActualDiners(pendingDraft.actualDiners);
    if (pendingDraft.planExpectedDiners !== undefined) {
      setPlanExpectedDiners(pendingDraft.planExpectedDiners);
    }
    setIsUnplanned(!!pendingDraft.isUnplanned);
    if (pendingDraft.selectedMode) {
      setSelectedMode(pendingDraft.selectedMode as CloseoutMode);
    }
    setItems(pendingDraft.items as CloseoutItem[]);
    setPendingDraft(null);
    setModeBanner("Draft restored from this device · Edit anything · Submit still required");
  }

  function handleDiscardDraft() {
    clearCloseoutDraft(draftKey);
    setPendingDraft(null);
  }

  useEffect(() => {
    getRecentCloseoutsForKitchen(kitchenId).then((res) => {
      if (res.success) setRecentRecords(res.data);
    });
  }, [kitchenId]);

  async function handleLoadPlan() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setVariance(null);
    setItems([]);
    setMealId(null);
    setIsUnplanned(false);

    const res = await getApprovedPlanForMeal(kitchenId, mealType, date);
    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setMealId(res.data.mealId);
    setPlanExpectedDiners(res.data.expectedDiners);
    setActualDiners(res.data.expectedDiners);
    setItems(
      res.data.items.map((i) => ({
        dishId: i.dishId,
        dishName: i.dishName,
        approvedKg: i.approvedKg,
        totalCookedKg: i.approvedKg !== null ? String(i.approvedKg) : "",
        unservedLeftoverKg: "0",
        isStockout: false,
        isAbnormal: false,
        notes: "",
      }))
    );
  }

  async function handleStartUnplanned() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setVariance(null);
    setMealId(null);
    setPlanExpectedDiners(null);
    setIsUnplanned(true);

    const res = await listDishesForKitchen(kitchenId);
    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setItems(
      res.data.map((d) => ({
        dishId: d.id,
        dishName: d.name,
        approvedKg: null,
        totalCookedKg: "",
        unservedLeftoverKg: "0",
        isStockout: false,
        isAbnormal: false,
        notes: "",
      }))
    );
  }

  async function handlePrefillFromLastService() {
    setLoadingPrefill(true);
    setError(null);
    setMessage(null);

    const res = await getLastCloseoutPrefill(kitchenId, mealType, date);
    setLoadingPrefill(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    if (!res.data || res.data.items.length === 0) {
      setError(`No previous service history found for ${mealType.toLowerCase()} to prefill from.`);
      return;
    }

    const prefill = res.data;

    if (items.length === 0) {
      // Check if an approved morning plan exists for this date/mealType
      const planRes = await getApprovedPlanForMeal(kitchenId, mealType, date);
      if (planRes.success) {
        setMealId(planRes.data.mealId);
        setPlanExpectedDiners(planRes.data.expectedDiners);
        setIsUnplanned(false);
        setItems(
          planRes.data.items.map((pi) => {
            const match = prefill.items.find((p) => p.dishId === pi.dishId);
            return {
              dishId: pi.dishId,
              dishName: pi.dishName,
              approvedKg: pi.approvedKg,
              totalCookedKg:
                match && match.cookedKg !== null
                  ? String(match.cookedKg)
                  : pi.approvedKg !== null
                  ? String(pi.approvedKg)
                  : "",
              unservedLeftoverKg:
                match && match.leftoverKg !== null ? String(match.leftoverKg) : "0",
              isStockout: match ? match.isStockout : false,
              isAbnormal: match ? match.isAbnormal : false,
              notes: "",
            };
          })
        );
      } else {
        // No approved plan found; populate as unplanned service
        setIsUnplanned(true);
        setMealId(null);
        setItems(
          prefill.items.map((pi) => ({
            dishId: pi.dishId,
            dishName: pi.dishName,
            approvedKg: null,
            totalCookedKg: pi.cookedKg !== null ? String(pi.cookedKg) : "",
            unservedLeftoverKg: pi.leftoverKg !== null ? String(pi.leftoverKg) : "0",
            isStockout: pi.isStockout,
            isAbnormal: pi.isAbnormal,
            notes: "",
          }))
        );
      }
    } else {
      // Overlay matching dishes from prefill
      setItems((prev) =>
        prev.map((item) => {
          const match = prefill.items.find((p) => p.dishId === item.dishId);
          if (!match) return item;
          return {
            ...item,
            totalCookedKg:
              match.cookedKg !== null ? String(match.cookedKg) : item.totalCookedKg,
            unservedLeftoverKg:
              match.leftoverKg !== null ? String(match.leftoverKg) : item.unservedLeftoverKg,
            isStockout: match.isStockout,
            isAbnormal: match.isAbnormal,
          };
        })
      );
    }

    setActualDiners(prefill.actualDiners);
    setSelectedMode("CUSTOM");
    setModeBanner(null);
    setPrefillBanner({ date: prefill.date });
  }

  function handleWholeMealAsPlanned() {
    const check = canApplyWholeMealCloseout(isUnplanned, mealId, items);
    if (!check.allowed) {
      setError(check.reason || 'Cannot apply "Whole meal as planned" without an approved morning plan.');
      return;
    }

    setError(null);
    setPrefillBanner(null);

    const result = applyWholeMealAsPlanned(items, actualDiners, planExpectedDiners);
    setItems(result.items);
    setActualDiners(result.actualDiners);
    setSelectedMode("AS_PLANNED");
    setModeBanner("Whole meal filled · Edit anything · Submit still required");
  }

  function handleWholeMealRanOut() {
    const check = canApplyWholeMealCloseout(isUnplanned, mealId, items);
    if (!check.allowed) {
      setError(check.reason || 'Cannot apply "Whole meal ran out" without an approved morning plan.');
      return;
    }

    setError(null);
    setPrefillBanner(null);

    const result = applyWholeMealRanOut(items, actualDiners, planExpectedDiners);
    setItems(result.items);
    setActualDiners(result.actualDiners);
    setSelectedMode("RAN_OUT");
    setModeBanner("Whole meal filled · Edit anything · Submit still required");
  }

  function handleSelectMode(mode: CloseoutMode) {
    setSelectedMode(mode);
    if (mode === "CUSTOM") {
      setModeBanner(null);
      return;
    }

    const hasApprovedPlan = !isUnplanned && mealId && items.some((i) => i.approvedKg !== null);
    if (!hasApprovedPlan && mode === "AS_PLANNED") {
      setError('Cannot apply "As planned" preset without an approved morning plan.');
      return;
    }

    setError(null);
    setPrefillBanner(null);
    const updated = applyCloseoutMode(mode, items);
    setItems(updated);
    setModeBanner("Values set from mode · Edit anything · Submit still required");
  }

  async function handleSubmit() {
    if (!isUnplanned && !mealId) {
      setError("No plan loaded for closeout.");
      return;
    }

    // Client-side validation: leftovers cannot exceed cooked
    for (const item of items) {
      const cooked = item.totalCookedKg === "" ? null : parseFloat(item.totalCookedKg);
      const leftover = item.unservedLeftoverKg === "" ? null : parseFloat(item.unservedLeftoverKg);
      if (cooked !== null && leftover !== null && leftover > cooked) {
        setError(`Leftovers cannot exceed total cooked production for "${item.dishName}".`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    setVariance(null);

    const payload = items.map((i) => ({
      dishId: i.dishId,
      totalCookedKg: i.totalCookedKg === "" ? null : parseFloat(i.totalCookedKg),
      unservedLeftoverKg:
        i.unservedLeftoverKg === "" ? null : parseFloat(i.unservedLeftoverKg),
      isStockout: i.isStockout,
      isAbnormal: i.isAbnormal,
    }));

    let res;
    if (isUnplanned) {
      res = await createUnplannedMealCloseout({
        kitchenId,
        mealType,
        date,
        actualDiners,
        items: payload,
      });
      if (res.success) {
        setMealId(res.mealId);
      }
    } else {
      res = await submitCloseout({
        kitchenId,
        mealId: mealId!,
        actualDiners,
        items: payload,
      });
    }
    setSubmitting(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    // Clear device draft upon successful server commitment
    clearCloseoutDraft(draftKey);
    setDraftSavedAt(null);
    setPendingDraft(null);

    setPrefillBanner(null);
    setMessage("Meal closeout submitted successfully. Historical observation logs updated.");
    if (res.variance) {
      setVariance(res.variance);
    }
    getRecentCloseoutsForKitchen(kitchenId).then((res) => {
      if (res.success) setRecentRecords(res.data);
    });
  }

  return (
    <div className="space-y-8">
      {/* Step 1: Select service & load plan */}
      <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-base font-bold font-heading">1. Retrieve Morning Approved Plan</CardTitle>
          <CardDescription className="text-xs">
            Select the service and date to load the morning approved targets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="closeout-meal-type" className="block text-[11px] font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                Meal Service
              </label>
              <select
                id="closeout-meal-type"
                value={mealType}
                onChange={(e) => {
                  setMealType(e.target.value);
                  setPrefillBanner(null);
                  setError(null);
                }}
                className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-colors font-medium"
              >
                <option value="BREAKFAST">Breakfast</option>
                <option value="LUNCH">Lunch</option>
                <option value="DINNER">Dinner</option>
              </select>
            </div>
            <div>
              <label htmlFor="closeout-date" className="block text-[11px] font-semibold text-foreground mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Service Date</span>
              </label>
              <input
                id="closeout-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPrefillBanner(null);
                  setError(null);
                }}
                className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-colors tabular-nums font-medium"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              onClick={handleLoadPlan}
              disabled={loading || loadingPrefill}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5"
            >
              <ArrowDownToLine className="w-4 h-4 text-accent-soft" />
              <span>{loading ? "Locating Approved Plan..." : "Load Approved Plan"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handlePrefillFromLastService}
              disabled={loading || loadingPrefill}
              className="gap-2 border-emerald-600/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-medium"
            >
              <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{loadingPrefill ? "Loading last service..." : "Prefill from last service"}</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleStartUnplanned}
              disabled={loading || loadingPrefill}
              className="gap-2 border-border/80 hover:bg-muted/40 font-medium"
            >
              <PlusCircle className="w-4 h-4 text-primary" />
              <span>Record Meal Without Prior Plan</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Offline Alert Strip */}
      {!isOnline && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-medium">
          <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>You’re offline.</strong> Entries are saved on this device only and will not sync to the server until you tap Submit when back online.
          </span>
        </div>
      )}

      {/* Device Draft Restore Banner */}
      {pendingDraft && items.length === 0 && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-900 dark:text-blue-200 text-xs shadow-xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5">
              <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="font-semibold text-sm">
                  Unsubmitted Device Draft Available
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Saved on this device only at {new Date(pendingDraft.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ({pendingDraft.items.length} dishes, {pendingDraft.actualDiners} diners). Not synced to server until Submit.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <Button
                type="button"
                onClick={handleRestoreDraft}
                className={cn(
                  "gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs",
                  floorMode ? "h-11 px-4 text-sm font-bold" : "h-8 px-3"
                )}
              >
                <span>Restore Draft</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDiscardDraft}
                className={cn(
                  "text-xs text-muted-foreground hover:text-foreground",
                  floorMode ? "h-11 px-3 text-sm" : "h-8 px-2.5"
                )}
              >
                <span>Discard</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Prefill Notification Banner */}
      <AnimatePresence>
        {prefillBanner && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 text-xs font-medium shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Prefill from <strong>{prefillBanner.date}</strong> · Edit anything · Submit still required
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPrefillBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-100 p-1 rounded transition-colors"
              title="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {modeBanner && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200 text-xs font-medium shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{modeBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setModeBanner(null)}
              className="text-blue-700 hover:text-blue-950 dark:text-blue-400 dark:hover:text-blue-100 p-1 rounded transition-colors"
              title="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 2: Closeout Entry Form */}
      {items.length > 0 && (
        <div className="space-y-6">
          <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/70 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold font-heading">2. Service Actuals & Exceptions</CardTitle>
                  <CardDescription className="text-xs">
                    Input actual production and unserved leftovers. Flag any stockouts or unusual service disruptions.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePrefillFromLastService}
                    disabled={loadingPrefill || submitting}
                    className="h-8 gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{loadingPrefill ? "Prefilling..." : "Prefill from last service"}</span>
                  </Button>
                  <div className="flex items-center gap-2">
                    <label htmlFor="closeout-actual-diners" className="text-[11px] font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span>{KITCHEN_LABELS.actualDiners}:</span>
                    </label>
                    <input
                      id="closeout-actual-diners"
                      type="number"
                      min={0}
                      value={actualDiners}
                      onChange={(e) => setActualDiners(Number(e.target.value))}
                      className="w-24 h-9 text-right font-mono font-bold rounded-lg border border-input bg-card px-3 text-sm tabular-nums shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* 3-Tap Whole-Meal Quick Actions & Mode Control Bar */}
            {(() => {
              const wholeMealCheck = canApplyWholeMealCloseout(isUnplanned, mealId, items);
              const isWholeMealAllowed = wholeMealCheck.allowed;

              return (
                <div className="px-5 py-3.5 bg-muted/20 border-b border-border/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* 1-Click Whole-Meal Fast Fill Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleWholeMealAsPlanned}
                        disabled={!isWholeMealAllowed}
                        className={cn(
                          "gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed floor-primary-btn",
                          floorMode ? "h-11 px-4 text-sm font-bold shadow-sm" : "h-8"
                        )}
                        title={
                          isWholeMealAllowed
                            ? "1-click fill all items from morning targets with 0 kg leftovers"
                            : wholeMealCheck.reason
                        }
                      >
                        <Sparkles className="w-3.5 h-3.5 text-accent-soft" />
                        <span>{KITCHEN_LABELS.wholeMealAsPlanned}</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleWholeMealRanOut}
                        disabled={!isWholeMealAllowed}
                        className={cn(
                          "gap-1.5 text-xs border-amber-600/30 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-semibold disabled:opacity-40 disabled:cursor-not-allowed floor-primary-btn",
                          floorMode ? "h-11 px-4 text-sm font-bold shadow-sm" : "h-8"
                        )}
                        title={
                          isWholeMealAllowed
                            ? "1-click fill all items as stockouts with 0 kg leftovers"
                            : wholeMealCheck.reason
                        }
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>{KITCHEN_LABELS.wholeMealRanOut}</span>
                      </Button>
                    </div>

                    <div className="h-4 w-px bg-border/80 hidden sm:block" />

                    {/* Per-row refinement segmented control */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 shrink-0">
                        <Sliders className="w-3.5 h-3.5 text-primary" />
                        Mode:
                      </span>
                      <div className="inline-flex rounded-lg border border-border/80 bg-background p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleSelectMode("CUSTOM")}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                            selectedMode === "CUSTOM"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Custom
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectMode("AS_PLANNED")}
                          disabled={!isWholeMealAllowed}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                            selectedMode === "AS_PLANNED"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                          }`}
                          title={
                            !isWholeMealAllowed
                              ? wholeMealCheck.reason
                              : "Set cooked production to approved target and zero leftovers"
                          }
                        >
                          As planned
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectMode("RAN_OUT")}
                          disabled={isUnplanned || !mealId}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                            selectedMode === "RAN_OUT"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                          }`}
                          title={
                            isUnplanned || !mealId
                              ? "Requires an approved morning plan"
                              : "Report stockout across items and zero leftovers"
                          }
                        >
                          Ran out
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground font-medium">
                    {!isWholeMealAllowed ? (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        ⚠️ {wholeMealCheck.reason}
                      </span>
                    ) : (
                      <>
                        {selectedMode === "CUSTOM" && "Custom: Manual entry · Type actual quantities and report flags."}
                        {selectedMode === "AS_PLANNED" && "As planned: Cooked set from morning targets · 0 kg leftovers · Stockouts cleared."}
                        {selectedMode === "RAN_OUT" && "Ran out: Stockout reported on each dish · 0 kg leftovers · Cooked filled from targets."}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            <CardContent className="p-0 divide-y divide-border/70">
              {items.map((item, idx) => (
                <div key={item.dishId} className="p-5 sm:p-6 space-y-4 hover:bg-muted/15 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-heading font-bold text-foreground text-base floor-dish-title">
                        {item.dishName}
                      </span>
                      {item.approvedKg !== null && (
                        <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full border border-border/60 floor-target-weight">
                          Morning target: <strong className="tabular-nums font-heading cc-num font-semibold text-foreground">{item.approvedKg.toFixed(2)} kg</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {item.isStockout && <StatusBadge status="stockout" label={KITCHEN_LABELS.isStockout} />}
                      {item.isAbnormal && <StatusBadge status="abnormal" label={KITCHEN_LABELS.isAbnormal} />}
                      {!item.isStockout && !item.isAbnormal && <StatusBadge status="eligible" label={KITCHEN_LABELS.eligibleFloorFacing} />}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                    <div>
                      <label htmlFor={`closeout-cooked-${item.dishId}`} className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        {KITCHEN_LABELS.totalCookedKg}
                      </label>
                      <input
                        id={`closeout-cooked-${item.dishId}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.totalCookedKg}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...next[idx], totalCookedKg: e.target.value };
                          setItems(next);
                        }}
                        placeholder="0.00"
                        className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm font-mono font-bold tabular-nums shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-colors"
                      />
                    </div>

                    <div>
                      <label htmlFor={`closeout-leftover-${item.dishId}`} className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        {KITCHEN_LABELS.unservedLeftoverKg}
                      </label>
                      <input
                        id={`closeout-leftover-${item.dishId}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unservedLeftoverKg}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = {
                            ...next[idx],
                            unservedLeftoverKg: e.target.value,
                          };
                          setItems(next);
                        }}
                        placeholder="0.00"
                        className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm font-mono font-bold tabular-nums shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-colors"
                      />
                    </div>

                    <div className="flex items-center pt-2 sm:pt-6">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.isStockout}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...next[idx], isStockout: e.target.checked };
                            setItems(next);
                          }}
                          className="rounded border-input text-primary focus:ring-primary w-4 h-4 accent-primary"
                        />
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          {KITCHEN_LABELS.isStockout}
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center pt-2 sm:pt-6">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.isAbnormal}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...next[idx], isAbnormal: e.target.checked };
                            setItems(next);
                          }}
                          className="rounded border-input text-primary focus:ring-primary w-4 h-4 accent-primary"
                        />
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                          {KITCHEN_LABELS.isAbnormal}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Notes / Reason explanation */}
                  <div>
                    <input
                      type="text"
                      placeholder="Optional observation notes (e.g., campus holiday, delayed transport, batch issue)..."
                      value={item.notes || ""}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], notes: e.target.value };
                        setItems(next);
                      }}
                      className="w-full text-xs rounded-lg border border-border/80 bg-background px-3 py-2 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-colors"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="sticky bottom-[68px] md:bottom-4 z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/95 backdrop-blur-md p-4 rounded-xl border border-border shadow-lg cc-card">
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className={cn(
                  "gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs px-6 floor-primary-btn",
                  floorMode ? "w-full sm:w-auto h-12 text-base font-bold shadow-md" : ""
                )}
              >
                <CheckCircle2 className="w-4 h-4 text-accent-soft" />
                <span>{submitting ? "Saving Closeout & Updating Model..." : "Submit Evening Closeout"}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleExplicitSaveDraft}
                className={cn(
                  "gap-1.5 border-border/80 text-muted-foreground hover:text-foreground font-semibold floor-hide",
                  floorMode ? "w-full sm:w-auto h-12 text-base font-bold" : "h-11 px-4 text-xs"
                )}
                title="Explicitly save draft to this browser device"
              >
                <Save className="w-3.5 h-3.5 text-primary" />
                <span>Save Draft</span>
              </Button>
            </div>

            <div className="flex flex-col sm:items-end text-xs text-muted-foreground floor-hide">
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <HardDrive className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Saved on this device only · not synced to server until Submit</span>
              </div>
              {draftSavedAt && (
                <span className="text-[10px] text-muted-foreground/75 font-mono">
                  Last saved locally at {draftSavedAt}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 text-sm flex items-start gap-2.5 font-medium shadow-2xs"
          >
            <AlertCircle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {message && (
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-sm flex items-start gap-2.5 font-semibold shadow-2xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{message}</span>
            </motion.div>

            {variance && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <CloseoutVarianceCard
                  variance={variance}
                  kitchenId={kitchenId}
                  date={date}
                  mealType={mealType}
                />
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Usable Kitchen Records: Recent Service Closeout History */}
      {recentRecords.length > 0 && (
        <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden mt-8">
          <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <CardTitle className="text-base font-bold font-heading">Recent Service Closeout Records</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Review recent operational actuals and eligibility classifications for this kitchen.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile Cards (< sm) */}
            <div className="sm:hidden divide-y divide-border/60">
              {recentRecords.map((rec) => (
                <div key={rec.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-heading font-bold text-foreground text-sm">{rec.dishName}</span>
                    <span className="px-2 py-0.5 rounded bg-muted text-[10px] uppercase font-bold tracking-wider border border-border/60">
                      {rec.mealType}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <span>{rec.date}</span>
                    <div>
                      {rec.isStockout ? (
                        <StatusBadge status="stockout" label={KITCHEN_LABELS.isStockout} />
                      ) : rec.isAbnormal ? (
                        <StatusBadge status="abnormal" label={KITCHEN_LABELS.isAbnormal} />
                      ) : (
                        <StatusBadge status="eligible" label={KITCHEN_LABELS.eligibleFloorFacing} />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">{KITCHEN_LABELS.totalCookedKg}</div>
                      <div className="font-mono font-bold text-foreground mt-0.5">
                        {rec.cookedKg !== null && rec.cookedKg !== undefined ? `${rec.cookedKg.toFixed(1)} kg` : "—"}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">{KITCHEN_LABELS.unservedLeftoverKg}</div>
                      <div className="font-mono text-muted-foreground mt-0.5">
                        {rec.leftoverKg !== null && rec.leftoverKg !== undefined ? `${rec.leftoverKg.toFixed(1)} kg` : "—"}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">{KITCHEN_LABELS.actualDiners}</div>
                      <div className="font-mono font-semibold text-foreground mt-0.5">
                        {rec.actualDiners ?? "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop & Tablet Table (sm+) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase tracking-[0.1em] text-[10px] border-b border-border font-semibold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Dish</th>
                    <th className="py-3 px-4 text-right">{KITCHEN_LABELS.actualDiners}</th>
                    <th className="py-3 px-4 text-right">{KITCHEN_LABELS.totalCookedKg}</th>
                    <th className="py-3 px-4 text-right">{KITCHEN_LABELS.unservedLeftoverKg}</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {recentRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-muted/25 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground tabular-nums">{rec.date}</td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-muted text-[10px] uppercase font-bold tracking-wider border border-border/60">
                          {rec.mealType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-foreground font-bold">{rec.dishName}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">{rec.actualDiners ?? "—"}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-foreground">{rec.cookedKg?.toFixed(2) ?? "—"}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-muted-foreground">{rec.leftoverKg?.toFixed(2) ?? "—"}</td>
                      <td className="py-3 px-4 text-center">
                        {rec.isStockout ? (
                          <StatusBadge status="stockout" label={KITCHEN_LABELS.isStockout} />
                        ) : rec.isAbnormal ? (
                          <StatusBadge status="abnormal" label={KITCHEN_LABELS.isAbnormal} />
                        ) : (
                          <StatusBadge status="eligible" label={KITCHEN_LABELS.eligibleFloorFacing} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
