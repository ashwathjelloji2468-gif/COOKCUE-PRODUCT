"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  ArrowLeft,
  Printer,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Calendar,
  Clock,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import { AllergenChips } from "@/components/kitchen/AllergenChips";
import { markIndentRequested, cancelIndent, type ProcurementIndentDetail } from "@/server/actions/indents";
import { cn } from "@/lib/utils";

interface IndentDetailClientProps {
  kitchenId: string;
  initialIndent: ProcurementIndentDetail;
}

export function IndentDetailClient({ kitchenId, initialIndent }: IndentDetailClientProps) {
  const router = useRouter();
  const [indent, setIndent] = useState<ProcurementIndentDetail>(initialIndent);
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalKg = indent.lines.reduce((acc, line) => acc + (line.targetKg || 0), 0);

  const handleMarkRequested = async () => {
    setRequesting(true);
    setError(null);
    try {
      const res = await markIndentRequested(kitchenId, indent.id);
      if (res.success) {
        setIndent((prev) => ({
          ...prev,
          status: "REQUESTED",
          requestedAt: new Date().toISOString(),
        }));
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || "Failed to update indent status");
    } finally {
      setRequesting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this procurement indent?")) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await cancelIndent(kitchenId, indent.id);
      if (res.success) {
        setIndent((prev) => ({
          ...prev,
          status: "CANCELLED",
        }));
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || "Failed to cancel indent");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = () => {
    switch (indent.status) {
      case "REQUESTED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1.5 font-semibold text-xs py-1 px-2.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Requested — Sent to Store</span>
          </Badge>
        );
      case "DRAFT":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1.5 font-semibold text-xs py-1 px-2.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Draft — Needs Store Request</span>
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1.5 text-xs py-1 px-2.5">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar (hidden during print) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
          <Link href={`/kitchen/${kitchenId}/indents`}>
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Indents</span>
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5 text-primary" />
            <span>Print Indent</span>
          </Button>

          {indent.status === "DRAFT" && (
            <Button
              type="button"
              size="sm"
              disabled={requesting}
              onClick={handleMarkRequested}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs font-bold shadow-xs"
            >
              {requesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Mark as requested</span>
            </Button>
          )}

          {indent.status !== "CANCELLED" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={handleCancel}
              className="text-destructive hover:bg-destructive/10 text-xs font-medium"
            >
              {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              <span>Cancel indent</span>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive flex items-center gap-2 print:hidden">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Indent Card */}
      <Card className="border-border shadow-xs bg-card overflow-hidden">
        {/* Header Information */}
        <CardHeader className="p-6 border-b border-border/80 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  CookCue Material Indent
                </span>
                <span className="text-muted-foreground text-xs">&bull;</span>
                <span className="text-xs font-semibold text-foreground font-heading">{indent.kitchenName}</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-foreground">
                {indent.mealType} Purchase Indent
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Service Date: <strong className="font-mono">{indent.date}</strong>
                </span>
                <span>&bull;</span>
                <span>Created by {indent.createdByName} ({indent.createdByRole})</span>
                {indent.requestedAt && (
                  <>
                    <span>&bull;</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Requested: {new Date(indent.requestedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              {getStatusBadge()}
              <div className="text-left sm:text-right font-mono text-xs text-muted-foreground">
                Total Planned: <span className="font-bold text-base text-foreground font-sans">{Math.round(totalKg * 10) / 10} kg</span>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Lines Table */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-6 w-12 text-center">#</th>
                  <th className="py-3 px-6">Dish Name</th>
                  <th className="py-3 px-6 text-right">Target (kg)</th>
                  <th className="py-3 px-6">Unit</th>
                  <th className="py-3 px-6">Operational Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {indent.lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-4 px-6 text-center text-xs font-mono text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-foreground text-base">
                        {line.dishName}
                      </div>
                      {line.menuCycleLabel && (
                        <span className="inline-block text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded mt-1">
                          Cycle: {line.menuCycleLabel}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-lg font-bold text-foreground">
                      {line.targetKg}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-muted-foreground uppercase">
                      {line.unit}
                    </td>
                    <td className="py-4 px-6">
                      <AllergenChips
                        allergenTags={line.allergenTags}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-semibold text-foreground">
                  <td colSpan={2} className="py-4 px-6 text-right text-xs uppercase tracking-wider text-muted-foreground">
                    Total Material Requirement:
                  </td>
                  <td className="py-4 px-6 text-right font-mono text-lg font-bold text-foreground">
                    {Math.round(totalKg * 10) / 10}
                  </td>
                  <td className="py-4 px-6 font-mono text-xs uppercase text-muted-foreground">
                    kg
                  </td>
                  <td className="py-4 px-6 text-xs text-muted-foreground">
                    {indent.lines.length} production items
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Footer / Notes */}
      <div className="text-xs text-muted-foreground space-y-1 print:text-[10px]">
        <p>
          &bull; <strong>Operational notice:</strong> Quantities reflect Head Cook approved morning plan targets for this service. Material indents do not guarantee vendor availability or manage inventory stocks.
        </p>
        <p>
          &bull; Allergen tags are for operational kitchen awareness only. Consult standard safety datasheets for strict allergen control.
        </p>
      </div>
    </div>
  );
}
