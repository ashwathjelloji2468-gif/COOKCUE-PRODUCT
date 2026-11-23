"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getOrCreateMeal,
  listDishesForKitchen,
  generatePlanRecommendations,
  getCookingPlanForMeal,
  approveCookingPlan,
  submitDraftPlanToHeadCook,
} from "@/server/actions/morning-plan";
import {
  listTemplates,
  createTemplate,
  deleteTemplate,
  type ServiceTemplate,
} from "@/server/actions/service-template";
import type { CookingPlanDetail } from "@/server/actions/morning-plan-types";
import {
  Sparkles,
  CheckCircle2,
  Calendar,
  Users,
  Utensils,
  AlertCircle,
  Clock,
  FileEdit,
  ShieldCheck,
  UserCheck,
  Lock,
  ArrowRight,
  ShieldAlert,
  Send,
  BookmarkPlus,
  Trash2,
  Layers,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RecommendationCard } from "@/components/ui/RecommendationCard";
import { RecommendationExplanationDialog } from "@/components/kitchen/RecommendationExplanationDialog";
import { motion, AnimatePresence } from "motion/react";
import { OneShotBadge, HoverLift, PageSectionReveal } from "@/components/motion";
import { useFloorMode } from "@/context/FloorModeContext";
import { cn } from "@/lib/utils";
import { KITCHEN_LABELS } from "@/lib/kitchen/labels";
import { CreateIndentButton } from "@/components/kitchen/CreateIndentButton";

type Dish = { id: string; name: string; unit: string };
type RecItem = {
  dishId: string;
  dishName: string;
  recommendedKg: number | null;
  eligibleCount: number;
  exclusionReasons: string[];
  status?: string;
  statusReason?: string;
  approvedKg: string;
  snapshotBasis?: any;
  allergenTags?: string[];
  menuCycleLabel?: string | null;
};

function getLocalCalendarDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function MorningPlanForm({ kitchenId }: { kitchenId: string }) {
  const [mealType, setMealType] = useState("LUNCH");
  const { floorMode } = useFloorMode();
  const [date, setDate] = useState(getLocalCalendarDate);
  const [expectedDiners, setExpectedDiners] = useState(50);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<RecItem[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CookingPlanDetail | null>(null);
  const [currentMealId, setCurrentMealId] = useState<string | null>(null);
  const [canApprove, setCanApprove] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [explainingDish, setExplainingDish] = useState<{ id: string; name: string } | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null);

  // Load templates for kitchen
  useEffect(() => {
    listTemplates(kitchenId).then((res) => {
      if (res.success) setTemplates(res.data);
    });
  }, [kitchenId]);

  function handleApplyTemplate(template: ServiceTemplate) {
    if (isApproved && !canApprove) return;
    setMealType(template.mealType);
    if (template.defaultExpectedDiners && template.defaultExpectedDiners > 0) {
      setExpectedDiners(template.defaultExpectedDiners);
    }
    const validIds = template.dishIds.filter((id) => dishes.some((d) => d.id === id));
    setSelectedDishIds(validIds);
    setTemplateFeedback(
      `Applied template "${template.name}" (${validIds.length} dishes). Click "Generate Recommendations" when ready.`
    );
  }

  async function handleSaveCurrentAsTemplate() {
    if (!newTemplateName.trim()) {
      setError("Please provide a name for the template.");
      return;
    }
    if (selectedDishIds.length === 0) {
      setError("Please select at least one dish before saving a template.");
      return;
    }

    setSavingTemplate(true);
    setError(null);

    const res = await createTemplate(kitchenId, {
      name: newTemplateName.trim(),
      mealType,
      defaultExpectedDiners: expectedDiners > 0 ? expectedDiners : null,
      dishIds: selectedDishIds,
    });

    setSavingTemplate(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setShowSaveTemplateModal(false);
    setNewTemplateName("");
    setTemplateFeedback(`Template "${res.data.name}" saved successfully!`);

    const listRes = await listTemplates(kitchenId);
    if (listRes.success) setTemplates(listRes.data);
  }

  async function handleDeleteTemplate(templateId: string) {
    setDeletingTemplateId(templateId);
    setError(null);

    const res = await deleteTemplate(kitchenId, templateId);
    setDeletingTemplateId(null);
    setConfirmDeleteId(null);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setTemplateFeedback("Service template removed.");
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }

  // Load dishes for kitchen
  useEffect(() => {
    listDishesForKitchen(kitchenId).then((res) => {
      if (res.success) setDishes(res.data);
    });
  }, [kitchenId]);

  // Load existing cooking plan when service parameters change
  const loadPlanForService = useCallback(async () => {
    setPlanLoading(true);
    setError(null);
    try {
      const res = await getCookingPlanForMeal(kitchenId, mealType, date);
      if (res.success) {
        setCurrentMealId(res.mealId);
        if (res.canApprove !== undefined) setCanApprove(res.canApprove);
        if (res.currentUserRole) setCurrentUserRole(res.currentUserRole);

        if (res.data) {
          const plan = res.data;
          setCurrentPlan(plan);
          setCanApprove(plan.canApprove);
          setCurrentUserRole(plan.currentUserRole);
          setExpectedDiners(plan.expectedDiners);
          setSelectedDishIds(plan.items.map((i) => i.dishId));
          setRecommendations(
            plan.items.map((i) => ({
              dishId: i.dishId,
              dishName: i.dishName,
              recommendedKg: i.recommendedKg,
              eligibleCount: 3,
              exclusionReasons: [],
              status: "OK",
              approvedKg: i.approvedKg !== null ? String(i.approvedKg) : "",
              snapshotBasis: i.snapshotBasisJson ? JSON.parse(i.snapshotBasisJson) : undefined,
              allergenTags: i.allergenTags || [],
              menuCycleLabel: i.menuCycleLabel || null,
            }))
          );
        } else {
          setCurrentPlan(null);
          setRecommendations([]);
        }
      }
    } catch {
      // Ignore background load error
    } finally {
      setPlanLoading(false);
    }
  }, [kitchenId, mealType, date]);

  useEffect(() => {
    loadPlanForService();
  }, [loadPlanForService]);

  const approvalStatus = currentPlan ? (currentPlan.approvalStatus || currentPlan.status) : "DRAFT";
  const isApproved = approvalStatus === "APPROVED";
  const approverRecord = currentPlan?.approver || currentPlan?.firstApprover;
  const approverTimestamp = currentPlan?.approvedAt || currentPlan?.firstApprovedAt;

  function toggleDish(id: string) {
    if (isApproved && !canApprove) return;
    setSelectedDishIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  function selectAllDishes() {
    if (isApproved && !canApprove) return;
    if (selectedDishIds.length === dishes.length) {
      setSelectedDishIds([]);
    } else {
      setSelectedDishIds(dishes.map((d) => d.id));
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setRecommendations([]);

    const mealRes = await getOrCreateMeal(kitchenId, mealType, date);
    if (!mealRes.success) {
      setError(mealRes.error);
      setLoading(false);
      return;
    }
    setCurrentMealId(mealRes.mealId);

    const recRes = await generatePlanRecommendations(
      kitchenId,
      mealRes.mealId,
      mealType,
      expectedDiners,
      selectedDishIds
    );

    setLoading(false);

    if (!recRes.success) {
      setError(recRes.error);
      return;
    }

    setRecommendations(
      recRes.data.map((r) => ({
        ...r,
        approvedKg: r.recommendedKg !== null ? String(r.recommendedKg.toFixed(2)) : "",
      }))
    );
  }

  // Single Head Cook approval action
  async function handleApprovePlan() {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const mealRes = await getOrCreateMeal(kitchenId, mealType, date);
    if (!mealRes.success) {
      setError(mealRes.error);
      setSubmitting(false);
      return;
    }

    const items = recommendations.map((r) => ({
      dishId: r.dishId,
      recommendedKg: r.recommendedKg,
      approvedKg: r.approvedKg === "" ? null : parseFloat(r.approvedKg),
      snapshotBasis: r.snapshotBasis,
    }));

    const res = await approveCookingPlan(
      kitchenId,
      mealRes.mealId,
      expectedDiners,
      items
    );

    setSubmitting(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setMessage("Cooking plan approved successfully! Plan is verified and ready for production.");
    await loadPlanForService();
  }

  // Submit draft plan to Head Cook (Contractor Admin / Staff)
  async function handleSubmitToHeadCook() {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const mealRes = await getOrCreateMeal(kitchenId, mealType, date);
    if (!mealRes.success) {
      setError(mealRes.error);
      setSubmitting(false);
      return;
    }

    const items = recommendations.map((r) => ({
      dishId: r.dishId,
      recommendedKg: r.recommendedKg,
      approvedKg: r.approvedKg === "" ? null : parseFloat(r.approvedKg),
      snapshotBasis: r.snapshotBasis,
    }));

    const res = await submitDraftPlanToHeadCook(
      kitchenId,
      mealRes.mealId,
      expectedDiners,
      items
    );

    setSubmitting(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setMessage("Draft plan submitted to Head Cook! The Head Cook can now review and approve it.");
    await loadPlanForService();
  }

  return (
    <div className="space-y-8">
      {/* Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card shadow-xs">
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Plan Approval Status:
          </div>
          {isApproved ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{KITCHEN_LABELS.APPROVED}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
              <FileEdit className="w-3.5 h-3.5" />
              <span>{KITCHEN_LABELS.DRAFT}</span>
            </span>
          )}
        </div>

        <div className="text-xs text-muted-foreground font-medium">
          {isApproved ? (
            <span>
              Approved by {approverRecord?.name || approverRecord?.email || "Head Cook"}{" "}
              ({approverRecord?.role || "HEAD_COOK"})
              {approverTimestamp && ` at ${new Date(approverTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          ) : (
            <span>Unapproved plan. Requires Head Cook approval before production and closeout.</span>
          )}
        </div>
      </div>

      {/* Single Signature Audit Verification Card when APPROVED */}
      {isApproved && approverRecord && (
        <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
          <CardHeader className="py-3 px-5 border-b border-border/60 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <CardTitle className="text-sm font-bold font-heading">
                  Head Cook Plan Verification
                </CardTitle>
              </div>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved for Production
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="p-3.5 rounded-lg border border-border/70 bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-primary" />
                  Authorized Approver
                </span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {approverRecord.name || approverRecord.email}
                </p>
                <span className="font-mono text-[11px] text-muted-foreground">
                  Role: {approverRecord.role}
                </span>
              </div>
              <div className="sm:text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Approval Timestamp
                </span>
                <span className="font-mono text-xs text-foreground font-medium">
                  {approverTimestamp
                    ? new Date(approverTimestamp).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Recorded"}
                </span>
              </div>
            </div>
            {currentMealId && (
              <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                  Material Procurement &amp; Store Request
                </span>
                <CreateIndentButton
                  kitchenId={kitchenId}
                  mealId={currentMealId}
                  isApproved={isApproved}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-semibold"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Service Templates Section */}
      <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="py-4 px-5 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-primary" />
              <div>
                <CardTitle className="text-sm font-bold font-heading">Service Templates</CardTitle>
                <CardDescription className="text-xs">
                  Apply a saved meal configuration to set meal type, diner count, and menu composition instantly.
                </CardDescription>
              </div>
            </div>
            {(!isApproved || canApprove) && selectedDishIds.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSaveTemplateModal(true);
                  setNewTemplateName(`${mealType.charAt(0) + mealType.slice(1).toLowerCase()} Template`);
                }}
                className="gap-1.5 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10 shrink-0"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Save Current as Template</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Template Feedback Banner */}
          <AnimatePresence>
            {templateFeedback && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs font-medium"
              >
                <span>{templateFeedback}</span>
                <button
                  type="button"
                  onClick={() => setTemplateFeedback(null)}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal / Inline Save Dialog */}
          <AnimatePresence>
            {showSaveTemplateModal && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-heading text-foreground flex items-center gap-1.5">
                    <BookmarkPlus className="w-3.5 h-3.5 text-primary" />
                    Save Service Template
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplateModal(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Will save: <strong>{mealType}</strong> · <strong>{expectedDiners} diners</strong> · <strong>{selectedDishIds.length} dishes</strong>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g. Standard Friday Lunch, Festive Dinner"
                    className="flex-1 text-xs font-medium border border-border rounded-lg px-3 py-2 bg-background shadow-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveCurrentAsTemplate}
                      disabled={savingTemplate || !newTemplateName.trim()}
                      className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent-soft" />
                      <span>{savingTemplate ? "Saving..." : "Save Template"}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSaveTemplateModal(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Templates List */}
          {templates.length === 0 ? (
            <div className="text-center py-5 px-4 rounded-lg border border-dashed border-border/80 bg-muted/10 text-xs text-muted-foreground">
              No saved templates yet. Select your menu items below and click <strong className="text-foreground">&ldquo;Save Current as Template&rdquo;</strong> to easily reuse this meal setup.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-3.5 rounded-lg border border-border/80 bg-card hover:border-primary/40 transition-all shadow-2xs space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-heading font-bold text-sm text-foreground truncate">
                        {template.name}
                      </span>
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60 shrink-0">
                        {template.mealType}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      {template.defaultExpectedDiners && (
                        <span>{template.defaultExpectedDiners} diners</span>
                      )}
                      {template.defaultExpectedDiners && <span>•</span>}
                      <span>{template.dishIds.length} dishes</span>
                    </div>

                    {template.dishes && template.dishes.length > 0 && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {template.dishes.map((d) => d.name).join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                    {confirmDeleteId === template.id ? (
                      <div className="flex items-center gap-1.5 w-full justify-end">
                        <span className="text-[11px] text-red-600 dark:text-red-400 font-medium mr-1">Delete?</span>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          disabled={deletingTemplateId === template.id}
                          className="h-7 px-2 text-[11px]"
                        >
                          {deletingTemplateId === template.id ? "..." : "Yes, Delete"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                          className="h-7 px-2 text-[11px]"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyTemplate(template)}
                          disabled={isApproved && !canApprove}
                          className="h-7 gap-1.5 text-xs font-semibold border-emerald-600/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Apply Template</span>
                        </Button>

                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(template.id)}
                          title="Delete template"
                          className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold font-heading">1. Service Parameters</CardTitle>
              <CardDescription className="text-xs">
                Select the upcoming meal service and expected diner count to calculate estimated served quantity per diner.
              </CardDescription>
            </div>
            {isApproved && !canApprove && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Lock className="w-3.5 h-3.5" />
                Read-Only Instructions
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Service Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs font-medium border border-border/80 rounded-lg px-3 py-2 bg-background shadow-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-muted-foreground" />
                Meal Service
              </label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full text-xs font-medium border border-border/80 rounded-lg px-3 py-2 bg-background shadow-xs focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="BREAKFAST">Breakfast</option>
                <option value="LUNCH">Lunch</option>
                <option value="DINNER">Dinner</option>
                <option value="SNACK">Snack</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                {KITCHEN_LABELS.expectedDiners}
              </label>
              <input
                type="number"
                min="1"
                value={expectedDiners}
                onChange={(e) => setExpectedDiners(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isApproved && !canApprove}
                className="w-full text-xs font-medium border border-border/80 rounded-lg px-3 py-2 bg-background shadow-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dish Selection Card */}
      <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold font-heading">2. Menu Composition</CardTitle>
              <CardDescription className="text-xs">
                Check each dish scheduled for this service. Historical consumption will be computed per selected item.
              </CardDescription>
            </div>
            {(!isApproved || canApprove) && dishes.length > 0 && (
              <div className="flex items-center gap-2">
                {selectedDishIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSaveTemplateModal(true);
                      setNewTemplateName(`${mealType.charAt(0) + mealType.slice(1).toLowerCase()} Template`);
                    }}
                    className="text-xs min-h-[44px] sm:min-h-[28px] h-auto py-2 sm:py-1 px-3 text-primary hover:text-primary hover:bg-primary/10 font-semibold gap-1.5"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Save as Template</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllDishes}
                  className="text-xs min-h-[44px] sm:min-h-[28px] h-auto py-2 sm:py-1 px-3 text-muted-foreground hover:text-foreground font-medium"
                >
                  {selectedDishIds.length === dishes.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {dishes.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No dishes found for this kitchen. Please configure menu items first.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {dishes.map((dish) => {
                const isSelected = selectedDishIds.includes(dish.id);
                return (
                  <button
                    key={dish.id}
                    type="button"
                    onClick={() => toggleDish(dish.id)}
                    disabled={isApproved && !canApprove}
                    title={dish.name}
                    className={`flex items-center gap-2.5 p-3 sm:p-2.5 rounded-lg border-2 text-left text-xs font-medium transition-all duration-150 min-w-0 min-h-[44px] overflow-hidden cursor-pointer hover:shadow-xs active:scale-[0.99] ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold shadow-xs"
                        : "border-card-border bg-card hover:border-primary/40 text-foreground"
                    } ${isApproved && !canApprove ? "cursor-default opacity-80" : ""}`}
                  >
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border text-[11px] shrink-0 ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground font-bold"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    >
                      {isSelected && "✓"}
                    </div>
                    <span className="truncate min-w-0 flex-1">{dish.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {(!isApproved || canApprove) && (
            <div className="mt-6 pt-4 border-t border-border/60 flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={loading || selectedDishIds.length === 0}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs min-h-[44px] sm:min-h-[36px] px-4"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent-soft" />
                <span>{loading ? "Computing Quantities..." : "Generate Recommendations"}</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations & Targets */}
      {recommendations.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold font-heading text-foreground">
              3. Recommended Quantities &amp; Targets
            </h3>
            <p className="text-xs text-muted-foreground">
              {isApproved
                ? "Approved baseline targets confirmed by Head Cook."
                : "Pure mathematical recommendations computed from unexcluded observations. Adjust if necessary before approval."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {recommendations.map((rec) => (
              <RecommendationCard
                key={rec.dishId}
                dishName={rec.dishName}
                expectedDiners={expectedDiners}
                recommendedKg={rec.recommendedKg}
                eligibleCount={rec.eligibleCount}
                exclusionReasons={rec.exclusionReasons}
                status={rec.status as any}
                statusReason={rec.statusReason}
                approvedKg={rec.approvedKg}
                disabled={isApproved && !canApprove}
                allergenTags={rec.allergenTags}
                menuCycleLabel={rec.menuCycleLabel}
                onApprovedKgChange={(val) => {
                  if (isApproved && !canApprove) return;
                  setRecommendations((prev) =>
                    prev.map((r) => (r.dishId === rec.dishId ? { ...r, approvedKg: val } : r))
                  );
                }}
                onExplain={() => setExplainingDish({ id: rec.dishId, name: rec.dishName })}
              />
            ))}
          </div>

          {/* Action Footer - Sticky Action Bar */}
          <div className="sticky bottom-[68px] md:bottom-4 z-30 p-4 sm:p-5 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-lg cc-card">
            {/* Case A: Authorized Head Cook / Founder */}
            {canApprove ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  {isApproved ? (
                    <OneShotBadge className="text-sm font-bold text-foreground font-heading gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Plan Approved</span>
                    </OneShotBadge>
                  ) : (
                    <h4 className="text-sm font-bold text-foreground font-heading flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Head Cook Approval</span>
                    </h4>
                  )}
                  <p className="text-xs text-muted-foreground floor-hide">
                    {isApproved
                      ? "Plan is active for production. You can re-approve if targets were updated, or proceed to evening closeout."
                      : "Review recommended baseline quantities and confirm to authorize kitchen production."}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {isApproved && (
                    <Button asChild variant="outline" size="lg" className="gap-2 floor-hide">
                      <Link href={`/kitchen/${kitchenId}/closeout`}>
                        <span>Proceed to Closeout</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  )}

                  <Button
                    onClick={handleApprovePlan}
                    disabled={submitting}
                    size="lg"
                    className={cn(
                      "gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs px-6 floor-primary-btn",
                      floorMode ? "w-full sm:w-auto h-12 text-base font-bold shadow-md" : ""
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4 text-accent-soft" />
                    <span>
                      {submitting
                        ? "Approving Plan..."
                        : isApproved
                        ? "Re-approve plan"
                        : "Approve plan"}
                    </span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Case B: Kitchen Staff (Read-Only) */
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    {isApproved ? (
                      <OneShotBadge className="gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-sm font-bold text-foreground font-heading">
                          Approved Production Instructions
                        </h4>
                      </OneShotBadge>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <h4 className="text-sm font-bold text-foreground font-heading">
                          Draft Plan — Awaiting Head Cook Approval
                        </h4>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground floor-hide">
                    {isApproved
                      ? "Follow approved portion targets during meal preparation. Quantities are read-only for Kitchen Staff."
                      : "This plan is currently in draft state. Only the Head Cook can approve cooking plans."}
                  </p>
                </div>

                {!isApproved && (
                  <Button
                    onClick={handleSubmitToHeadCook}
                    disabled={submitting}
                    size="lg"
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs px-6 shrink-0 floor-primary-btn"
                  >
                    <Send className="w-4 h-4 text-primary-foreground/80" />
                    <span>{submitting ? "Submitting..." : "Submit Plan to Head Cook"}</span>
                  </Button>
                )}

                {isApproved && (
                  <Button asChild size="lg" variant="outline" className="gap-2 shrink-0 floor-hide">
                    <Link href={`/kitchen/${kitchenId}/closeout`}>
                      <span>View in Closeout</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                )}
              </div>
            )}
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
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-sm flex items-start gap-2.5 font-semibold shadow-2xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>{message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Why this kg?" Explanation Dialog */}
      {explainingDish && (
        <RecommendationExplanationDialog
          kitchenId={kitchenId}
          dishId={explainingDish.id}
          dishName={explainingDish.name}
          mealType={mealType}
          expectedDiners={expectedDiners}
          isOpen={!!explainingDish}
          onClose={() => setExplainingDish(null)}
        />
      )}
    </div>
  );
}
