"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  type StaffBoardData,
  type StaffReportType,
  createStaffReport,
  updateHeadCookInstructions,
  resolveStaffReport,
} from "@/server/actions/staff-board";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  Users,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Calendar,
  Utensils,
  Plus,
  Scale,
  Clock,
  ShieldCheck,
  UserCheck,
  Send,
  MessageSquare,
  HelpCircle,
  FileEdit,
  X,
  ArrowRight,
  Printer,
  ExternalLink,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OneShotBadge, HoverLift } from "@/components/motion";
import { useFloorMode } from "@/context/FloorModeContext";
import { cn } from "@/lib/utils";
import { KITCHEN_LABELS } from "@/lib/kitchen/labels";
import { AllergenChips } from "@/components/kitchen/AllergenChips";
import { CreateIndentButton } from "@/components/kitchen/CreateIndentButton";

interface StaffBoardClientProps {
  initialData: StaffBoardData;
  kitchenId: string;
}

export function StaffBoardClient({ initialData, kitchenId }: StaffBoardClientProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const { floorMode } = useFloorMode();

  // New report form state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<StaffReportType>("PROGRESS");
  const [reportTitle, setReportTitle] = useState("");
  const [reportContent, setReportContent] = useState("");
  const [reportDishId, setReportDishId] = useState("");
  const [reportQuantityKg, setReportQuantityKg] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Head Cook instructions state
  const [instructionsModalOpen, setInstructionsModalOpen] = useState(false);
  const [instructionsText, setInstructionsText] = useState(data.approvedPlan?.instructions || "");
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [instructionsError, setInstructionsError] = useState<string | null>(null);

  const { kitchen, currentUser, approvedPlan, staffMembers, reports } = data;
  const effectiveMeal = approvedPlan?.mealType || "LUNCH";
  const printUrl = `/kitchen/${kitchenId}/staff-board/print?date=${data.date}&mealType=${effectiveMeal}`;
  const autoPrintUrl = `${printUrl}&autoprint=1`;

  async function handleCreateReport(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingReport(true);
    setReportError(null);

    const qty = reportQuantityKg ? parseFloat(reportQuantityKg) : undefined;
    const res = await createStaffReport({
      kitchenId,
      date: data.date,
      type: reportType,
      title: reportTitle.trim() || undefined,
      content: reportContent.trim(),
      dishId: reportDishId || undefined,
      quantityKg: qty && !Number.isNaN(qty) ? qty : undefined,
    });

    setSubmittingReport(false);

    if (!res.success) {
      setReportError(res.error);
      return;
    }

    setReportModalOpen(false);
    setReportTitle("");
    setReportContent("");
    setReportDishId("");
    setReportQuantityKg("");
    router.refresh();
  }

  async function handleSaveInstructions(e: React.FormEvent) {
    e.preventDefault();
    if (!approvedPlan?.mealId) return;

    setSavingInstructions(true);
    setInstructionsError(null);

    const res = await updateHeadCookInstructions(kitchenId, approvedPlan.mealId, instructionsText);
    setSavingInstructions(false);

    if (!res.success) {
      setInstructionsError(res.error);
      return;
    }

    setInstructionsModalOpen(false);
    router.refresh();
  }

  async function handleResolve(reportId: string) {
    await resolveStaffReport(kitchenId, reportId);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Top Identity & Role Context Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-sm text-foreground">
                Operational Staff Board
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-muted text-foreground border border-border">
                {kitchen.name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live production schedule, assignments, and service task log
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button asChild variant="outline" size="sm" className="min-h-[44px] sm:min-h-[32px] h-auto py-2 sm:py-1 px-3 text-xs gap-1.5 font-medium">
            <Link href={`/kitchen/${kitchenId}/handoff`}>
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Shift Handoff</span>
            </Link>
          </Button>

          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
              Signed in as
            </span>
            <span className="text-xs font-semibold text-foreground">
              {currentUser.name || "Station Operator"}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground ml-1.5 px-1.5 py-0.5 rounded bg-muted border border-border">
              {currentUser.role}
            </span>
          </div>
        </div>
      </div>

      {/* Head Cook Instructions Banner */}
      <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-bold font-heading">
              Head Cook Station Instructions
            </CardTitle>
          </div>
          {currentUser.isHeadCook && approvedPlan?.mealId && (
            <Dialog open={instructionsModalOpen} onOpenChange={setInstructionsModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-[28px] h-auto py-2 sm:py-1 px-3 text-xs gap-1.5 font-medium">
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>{approvedPlan.instructions ? "Edit Instructions" : "Post Instructions"}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-heading text-base">
                    Head Cook Operational Instructions
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveInstructions} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="inst-text" className="text-xs">
                      Instructions for Kitchen Staff
                    </Label>
                    <Textarea
                      id="inst-text"
                      rows={4}
                      value={instructionsText}
                      onChange={(e) => setInstructionsText(e.target.value)}
                      placeholder="e.g. Focus on Basmati Rice batch consistency; check salt levels on Curry before service."
                      className="text-xs"
                    />
                  </div>
                  {instructionsError && (
                    <p className="text-destructive text-xs">{instructionsError}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setInstructionsModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={savingInstructions}>
                      {savingInstructions ? "Saving..." : "Save Instructions"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="p-5">
          {approvedPlan?.instructions ? (
            <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 text-xs text-foreground leading-relaxed font-medium flex items-start gap-3">
              <MessageSquare className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p>{approvedPlan.instructions}</p>
                <span className="text-[10px] text-muted-foreground block mt-1">
                  Posted by Head Cook for today&apos;s meal preparation
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic py-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-muted-foreground/60" />
              <span>No special operational instructions posted for this service. Follow standard portion guidelines.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's APPROVED Cooking Plan (Read-Only) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold font-heading text-foreground flex items-center gap-2">
              <Utensils className="w-4 h-4 text-primary" />
              <span>Approved Production Targets (Today&apos;s Service)</span>
            </h3>
            <p className="text-xs text-muted-foreground floor-hide">
              Official target batch quantities approved by Head Cook for kitchen preparation
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {approvedPlan?.isApproved && (
              <OneShotBadge className="gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approved by {approvedPlan.approverName}</span>
              </OneShotBadge>
            )}
            {approvedPlan?.isApproved && approvedPlan?.mealId && (
              <CreateIndentButton
                kitchenId={kitchenId}
                mealId={approvedPlan.mealId}
                isApproved={approvedPlan.isApproved}
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold border-border/80 hover:bg-muted/40"
              />
            )}
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold border-border/80 hover:bg-muted/40">
              <Link href={printUrl}>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Open print view</span>
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              disabled={!approvedPlan?.isApproved}
              className={cn(
                "h-8 gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs",
                !approvedPlan?.isApproved && "opacity-50 pointer-events-none"
              )}
            >
              <Link href={autoPrintUrl}>
                <Printer className="w-3.5 h-3.5 text-accent-soft" />
                <span>Print board</span>
              </Link>
            </Button>
          </div>
        </div>

        {!approvedPlan || !approvedPlan.isApproved ? (
          <Card className="border-border p-6 bg-card text-center space-y-4 cc-card">
            <EmptyState
              icon={<ChefHat className="w-10 h-10 text-muted-foreground" />}
              title="No approved cooking plan yet"
              description="The cooking plan for this service is still in draft state. Quantities will appear here once approved by the Head Cook."
              steps={[
                "Head cook reviews plan",
                "Approves on Morning Plan",
                "Board updates here",
              ]}
            />
            <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="default" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 shadow-xs floor-primary-btn">
                <Link href={`/kitchen/${kitchenId}/morning`}>
                  <ChefHat className="w-4 h-4 text-accent-soft" />
                  <span>Review &amp; Approve Morning Plan &rarr;</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="default" className="gap-1.5 text-xs font-medium">
                <Link href={printUrl}>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Open print view</span>
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {approvedPlan.items.map((item) => (
              <HoverLift key={item.dishId} y={-3}>
                <Card className={cn(
                  "border-border/80 bg-card p-4 shadow-xs hover:border-foreground/20 hover:shadow-sm transition-all h-full flex flex-col justify-between cc-card",
                  floorMode && "p-5 border-2 border-primary/30 bg-card/95"
                )}>
                  <div>
                    {/* Large Target (kg) First */}
                    <div className="mb-2.5 p-2.5 rounded-lg cc-well flex items-baseline justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {KITCHEN_LABELS.approvedKg}
                      </span>
                      <span className={cn(
                        "font-heading font-extrabold text-2xl text-foreground floor-target-weight cc-num",
                        floorMode && "text-3xl sm:text-4xl text-primary"
                      )}>
                        {item.approvedKg !== null ? item.approvedKg : "—"} <span className="text-xs font-semibold text-muted-foreground uppercase">{item.unit}</span>
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className={cn(
                        "font-heading font-bold text-sm text-foreground truncate floor-dish-title",
                        floorMode && "text-lg text-foreground"
                      )}>
                        {item.dishName}
                      </h4>
                      <StatusBadge status="eligible" label="Approved" />
                    </div>

                    <AllergenChips
                      allergenTags={item.allergenTags}
                      menuCycleLabel={item.menuCycleLabel}
                      className="mb-2.5"
                    />
                  </div>

                  {item.recommendedKg !== null && item.recommendedKg !== item.approvedKg && (
                    <div className="flex items-baseline justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/50 floor-hide">
                      <span>{KITCHEN_LABELS.recommendedKg}:</span>
                      <span className="font-heading cc-num">{item.recommendedKg} {item.unit}</span>
                    </div>
                  )}
                </Card>
              </HoverLift>
            ))}
          </div>
        )}
      </div>

      {/* Two Column Layout: Staff Assignments (Left) & Progress / Task Reports (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Live Staff Assignments */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold font-heading text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Station Personnel</span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Staff assigned to {kitchen.name} (live database)
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-muted border border-border">
              {staffMembers.length}
            </span>
          </div>

          {staffMembers.length === 0 ? (
            <Card className="border-border p-5 bg-card">
              <EmptyState
                icon={<Users className="w-8 h-8 text-muted-foreground" />}
                title="No staff assigned"
                description="No users are linked to this kitchen facility in the database."
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {staffMembers.map((member) => (
                <Card key={member.id} className="border-border/70 p-3 bg-card shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-foreground truncate">
                        {member.name || "Not provided"}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {member.email}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          member.role === "HEAD_COOK"
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {member.role}
                      </span>
                      {member.code && (
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {member.code}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right: Staff Task Reports & Problem Alerts */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold font-heading text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span>Operational Activity &amp; Task Reports</span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Post batch progress, log intermediate quantities, or alert the Head Cook to station problems
              </p>
            </div>

            {/* Action Buttons to open Report Modal */}
            <div className="flex items-center gap-2 shrink-0">
              <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="min-h-[44px] sm:min-h-[32px] h-auto py-2 sm:py-1 px-3.5 gap-1.5 text-xs shadow-xs font-semibold">
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Report</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading text-base">Submit Station Report</DialogTitle>
                  </DialogHeader>

                  <form onSubmit={handleCreateReport} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="rep-type" className="text-xs">Report Type</Label>
                      <select
                        id="rep-type"
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value as StaffReportType)}
                        className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 shadow-xs focus:ring-1 focus:ring-ring"
                      >
                        <option value="PROGRESS">Progress Note (Prep / Cooking Status)</option>
                        <option value="QUANTITY_REPORT">Quantity Log (Intermediate weight)</option>
                        <option value="PROBLEM">Problem Alert (Flag for Head Cook!)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="rep-title" className="text-xs">Title / Subject (Optional)</Label>
                      <Input
                        id="rep-title"
                        value={reportTitle}
                        onChange={(e) => setReportTitle(e.target.value)}
                        placeholder="e.g. Batch 1 Rice Complete, or Burner Issue"
                        className="text-xs"
                      />
                    </div>

                    {reportType === "QUANTITY_REPORT" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="rep-dish" className="text-xs">Associated Dish</Label>
                          <select
                            id="rep-dish"
                            value={reportDishId}
                            onChange={(e) => setReportDishId(e.target.value)}
                            className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 shadow-xs"
                          >
                            <option value="">Select dish...</option>
                            {approvedPlan?.items.map((i) => (
                              <option key={i.dishId} value={i.dishId}>
                                {i.dishName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="rep-qty" className="text-xs">Quantity (kg)</Label>
                          <Input
                            id="rep-qty"
                            type="number"
                            step="0.1"
                            value={reportQuantityKg}
                            onChange={(e) => setReportQuantityKg(e.target.value)}
                            placeholder="e.g. 15.5"
                            className="text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="rep-content" className="text-xs">
                        {reportType === "PROBLEM" ? "Describe Issue for Head Cook *" : "Report Details *"}
                      </Label>
                      <Textarea
                        id="rep-content"
                        rows={3}
                        value={reportContent}
                        onChange={(e) => setReportContent(e.target.value)}
                        required
                        placeholder={
                          reportType === "PROBLEM"
                            ? "Describe the issue clearly (e.g. equipment failure, ingredient stockout, unexpected surge)..."
                            : "Provide details on progress or station observations..."
                        }
                        className="text-xs"
                      />
                    </div>

                    {reportError && (
                      <p className="text-destructive text-xs">{reportError}</p>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReportModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={submittingReport || reportContent.trim().length < 2}
                        className={
                          reportType === "PROBLEM"
                            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            : ""
                        }
                      >
                        {submittingReport ? "Posting..." : reportType === "PROBLEM" ? "Flag Problem Alert" : "Submit Report"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {reports.length === 0 ? (
            <Card className="border-border p-6 bg-card">
              <EmptyState
                icon={<MessageSquare className="w-8 h-8 text-muted-foreground" />}
                title="No reports logged"
                description="No progress notes or problem alerts have been submitted for today's service."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <Card
                  key={report.id}
                  className={`p-4 shadow-xs transition-all ${
                    report.flagged && !report.resolved
                      ? "border-destructive/60 bg-destructive/5 dark:bg-destructive/10"
                      : "border-border/80 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          report.type === "PROBLEM"
                            ? "bg-destructive/15 text-destructive"
                            : report.type === "QUANTITY_REPORT"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {report.type === "PROBLEM" ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : report.type === "QUANTITY_REPORT" ? (
                          <Scale className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground">
                            {report.title || (report.type === "PROBLEM" ? "Problem Alert" : "Progress Note")}
                          </span>
                          {report.flagged && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                report.resolved
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-destructive text-destructive-foreground animate-pulse"
                              }`}
                            >
                              {report.resolved ? "Resolved" : "Flagged for Head Cook"}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-foreground mt-1 leading-relaxed">
                          {report.content}
                        </p>

                        {report.quantityKg !== null && (
                          <div className="mt-1 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            Logged: {report.quantityKg} kg
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                          <span>By {report.createdBy.name || "Station Staff"} ({report.createdBy.role})</span>
                          <span>•</span>
                          <span>{new Date(report.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>

                    {report.flagged && !report.resolved && currentUser.isHeadCook && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(report.id)}
                        className="text-xs min-h-[44px] sm:min-h-[28px] h-auto py-2 sm:py-1 px-3 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 font-medium"
                      >
                        Mark Resolved
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
