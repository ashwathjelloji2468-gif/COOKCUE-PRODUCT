"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Printer,
  Copy,
  Check,
  ArrowLeft,
  Calendar,
  Users,
  ShieldCheck,
  AlertCircle,
  FileEdit,
  Utensils,
  ChefHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KITCHEN_LABELS } from "@/lib/kitchen/labels";
import { AllergenChips } from "@/components/kitchen/AllergenChips";
import type { StaffBoardPrintData } from "@/server/actions/staff-board";

interface StaffBoardPrintClientProps {
  data: StaffBoardPrintData;
  autoPrint?: boolean;
}

export function StaffBoardPrintClient({
  data,
  autoPrint = false,
}: StaffBoardPrintClientProps) {
  const [copied, setCopied] = useState(false);

  // Trigger print dialog automatically when requested via autoprint=1
  useEffect(() => {
    if (autoPrint && data.isApproved) {
      const timer = setTimeout(() => {
        window.print();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, data.isApproved]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const staffBoardHref = `/kitchen/${data.kitchenId}/staff-board?date=${data.date}&mealType=${data.mealType}`;
  const morningPlanHref = `/kitchen/${data.kitchenId}/morning?date=${data.date}&mealType=${data.mealType}`;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      {/* 1. Screen-Only Action & Control Bar */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-xs border-b border-border/80 px-4 py-3 sm:px-6 shadow-2xs print:hidden">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button asChild variant="ghost" size="sm" className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground">
              <Link href={staffBoardHref}>
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Staff Board</span>
              </Link>
            </Button>
            <div className="h-4 w-px bg-border/70 hidden sm:block" />
            <span className="text-xs font-semibold text-muted-foreground truncate hidden sm:inline">
              Print Target View · {data.kitchenName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1.5 h-8 text-xs font-medium border-border/80"
              title="Copy link to this print view"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Copy Link</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handlePrint}
              disabled={!data.isApproved}
              className="gap-1.5 h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
              title={data.isApproved ? "Open system print dialog" : "Cooking plan must be approved first"}
            >
              <Printer className="w-3.5 h-3.5 text-[#D9EF79]" />
              <span>Print Board</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Printable Document Container */}
      <main className="max-w-4xl mx-auto p-4 sm:p-8 lg:p-10 print:p-0 print:max-w-none">
        {/* Printable Card Container */}
        <div className="bg-card print:bg-white text-card-foreground print:text-black rounded-xl border border-border/80 print:border-none p-6 sm:p-8 shadow-xs print:shadow-none space-y-6">
          {/* Header Block */}
          <div className="border-b border-border/80 print:border-black pb-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider uppercase text-muted-foreground print:text-black">
                  <span>CookCue Kitchen Operations</span>
                  <span>•</span>
                  <span>Production Target Board</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-foreground print:text-black mt-1">
                  {data.kitchenName}
                </h1>
                {data.location && (
                  <p className="text-xs text-muted-foreground print:text-black mt-0.5">
                    Location: {data.location}
                  </p>
                )}
              </div>

              {/* Status Badge */}
              <div className="flex flex-col sm:items-end gap-1">
                {data.isApproved ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 print:border-black print:text-black print:bg-transparent">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 print:text-black" />
                    <span>Approved for Production</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 print:border-black print:text-black print:bg-transparent">
                    <AlertCircle className="w-4 h-4 text-amber-600 print:text-black" />
                    <span>Draft — Needs Approval</span>
                  </span>
                )}
                {data.approvedAt && (
                  <span className="text-[11px] text-muted-foreground print:text-black font-mono">
                    Approved: {new Date(data.approvedAt).toLocaleDateString()} {new Date(data.approvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>

            {/* Key Service Facts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/30 print:bg-transparent print:border print:border-black">
                <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block tracking-wider">
                  Service Meal
                </span>
                <span className="text-sm font-bold font-heading text-foreground print:text-black mt-0.5 block">
                  {data.mealType}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/30 print:bg-transparent print:border print:border-black">
                <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Date
                </span>
                <span className="text-sm font-bold font-mono text-foreground print:text-black mt-0.5 block tabular-nums">
                  {data.date}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/30 print:bg-transparent print:border print:border-black">
                <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {KITCHEN_LABELS.expectedDiners}
                </span>
                <span className="text-sm font-bold font-mono text-foreground print:text-black mt-0.5 block tabular-nums">
                  {data.expectedDiners !== null ? data.expectedDiners : "—"}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/30 print:bg-transparent print:border print:border-black">
                <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black block tracking-wider flex items-center gap-1">
                  <ChefHat className="w-3 h-3" />
                  Approver
                </span>
                <span className="text-sm font-semibold text-foreground print:text-black mt-0.5 block truncate">
                  {data.approverName || "Pending Head Cook"}
                </span>
              </div>
            </div>

            {/* Operational Instructions (if any) */}
            {data.instructions && (
              <div className="p-3 rounded-lg bg-muted/40 print:bg-transparent border border-border/70 print:border-black text-xs space-y-0.5">
                <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground print:text-black block">
                  Head Cook Special Instructions
                </span>
                <p className="text-foreground print:text-black whitespace-pre-wrap leading-relaxed font-medium">
                  {data.instructions}
                </p>
              </div>
            )}
          </div>

          {/* Body Section */}
          {data.isApproved ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold font-heading uppercase tracking-wider text-foreground print:text-black">
                  Approved Production Batch Targets
                </h2>
                <span className="text-xs font-mono text-muted-foreground print:text-black">
                  {data.items.length} {data.items.length === 1 ? "dish" : "dishes"} scheduled
                </span>
              </div>

              {/* High-Contrast Production Targets Table */}
              <div className="border border-border/80 print:border-black rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 print:bg-gray-100 border-b border-border/80 print:border-black text-[11px] font-bold uppercase tracking-wider text-muted-foreground print:text-black">
                      <th className="py-3 px-4 sm:px-6">Dish Name</th>
                      <th className="py-3 px-4 sm:px-6 text-right">{KITCHEN_LABELS.approvedKg}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 print:divide-black">
                    {data.items.map((item, index) => (
                      <tr
                        key={item.dishId || index}
                        className="print:break-inside-avoid hover:bg-muted/15 transition-colors"
                      >
                        <td className="py-4 px-4 sm:px-6 align-middle">
                          <span className="font-heading font-black text-base sm:text-xl text-foreground print:text-black block">
                            {item.dishName}
                          </span>
                          <AllergenChips
                            allergenTags={item.allergenTags}
                            menuCycleLabel={item.menuCycleLabel}
                            className="mt-1"
                          />
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-right align-middle">
                          <span className="font-mono font-black text-xl sm:text-3xl text-foreground print:text-black tabular-nums tracking-tight">
                            {item.approvedKg !== null ? item.approvedKg.toFixed(2) : "—"}
                          </span>
                          <span className="ml-1.5 text-xs font-bold text-muted-foreground print:text-black uppercase">
                            {item.unit}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Case B: Unapproved / Draft Plan Honest Empty State */
            <Card className="border border-dashed border-border/90 print:border-black p-8 sm:p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto print:hidden">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base sm:text-lg font-bold font-heading text-foreground print:text-black">
                  No Approved Cooking Plan for this Service
                </h3>
                <p className="text-xs text-muted-foreground print:text-black leading-relaxed">
                  The cooking plan for <strong>{data.mealType}</strong> on <strong>{data.date}</strong> has not been approved yet. Production targets cannot be printed or released to kitchen line staff until confirmed by the Head Cook.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3 print:hidden">
                <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 shadow-xs">
                  <Link href={morningPlanHref}>
                    <ChefHat className="w-3.5 h-3.5 text-[#D9EF79]" />
                    <span>Open Morning Plan</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="text-xs font-medium">
                  <Link href={staffBoardHref}>Return to Staff Board</Link>
                </Button>
              </div>
            </Card>
          )}

          {/* Footer Receipt / Sign-Off Box */}
          <div className="pt-4 border-t border-border/80 print:border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-muted-foreground print:text-black font-mono">
            <div>
              CookCue Operating System · Clean Arithmetic Targets · Not ML Estimations
            </div>
            <div className="print:block">
              {data.isApproved ? "Station Copy · Post at Prep Table" : "Unapproved Preview · Do Not Distribute"}
            </div>
          </div>
        </div>
      </main>

      {/* Global CSS for Print Media Optimization */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 10mm;
            size: auto;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          header,
          nav,
          button,
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
