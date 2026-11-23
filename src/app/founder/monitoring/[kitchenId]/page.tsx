import { getKitchenMonitoringDetail } from "@/server/actions/monitoring";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FounderShell } from "@/components/layout/FounderShell";
import { ArrowLeft, History } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  params: Promise<{ kitchenId: string }>;
};

export default async function KitchenMonitoringDetailPage({ params }: Props) {
  const { kitchenId } = await params;
  const res = await getKitchenMonitoringDetail(kitchenId);

  if (!res.success) {
    notFound();
  }

  const { kitchen, observations } = res.data;

  function renderStatus(obs: (typeof observations)[0]) {
    if (obs.eligibilityStatus === "ELIGIBLE") {
      return <StatusBadge status="eligible" label="ELIGIBLE" />;
    }
    if (obs.eligibilityStatus === "INCOMPLETE") {
      return <StatusBadge status="missing" label="INCOMPLETE" />;
    }
    if (obs.eligibilityStatus === "NEEDS_REVIEW") {
      return <StatusBadge status="abnormal" label="NEEDS REVIEW" />;
    }
    if (obs.eligibilityStatus === "PENDING") {
      return <StatusBadge status="missing" label="PENDING" />;
    }
    return (
      <StatusBadge
        status={obs.isStockout ? "stockout" : "abnormal"}
        label={
          obs.isStockout
            ? "EXCLUDED (Stockout)"
            : obs.isAbnormal
            ? "EXCLUDED (Abnormal)"
            : "EXCLUDED"
        }
      />
    );
  }

  return (
    <FounderShell
      title={kitchen.name}
      subtitle="Chronological closeout observation audits and baseline learning eligibility"
    >
      <Link
        href="/founder/monitoring"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to monitoring</span>
      </Link>

      {observations.length === 0 ? (
        <EmptyState
          icon={<History className="w-10 h-10 text-muted-foreground" />}
          title="No observations recorded yet"
          description="Observations will appear here in chronological order once evening closeouts are submitted for this kitchen."
        />
      ) : (
        <div className="space-y-4">
          {/* Mobile Stacked Cards (below sm) */}
          <div className="sm:hidden space-y-3">
            {observations.map((obs) => (
              <Card key={obs.id} className="border-border shadow-xs p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-heading font-semibold text-foreground text-sm truncate" title={obs.dishName}>
                      {obs.dishName}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {obs.date}
                      </span>
                      <span>•</span>
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
                        {obs.mealType}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">{renderStatus(obs)}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
                  <div className="p-1.5 rounded bg-muted/40">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Cooked
                    </span>
                    <span className="font-mono text-xs font-bold text-foreground">
                      {obs.totalCookedKg !== null ? `${obs.totalCookedKg.toFixed(2)} kg` : "—"}
                    </span>
                  </div>
                  <div className="p-1.5 rounded bg-muted/40">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Leftover
                    </span>
                    <span className="font-mono text-xs font-bold text-foreground">
                      {obs.unservedLeftoverKg !== null ? `${obs.unservedLeftoverKg.toFixed(2)} kg` : "—"}
                    </span>
                  </div>
                  <div className="p-1.5 rounded bg-muted/40">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Diners
                    </span>
                    <span className="font-mono text-xs font-bold text-foreground">
                      {obs.actualDiners !== null ? obs.actualDiners : "—"}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop / Tablet Table (sm and above) */}
          <Card className="hidden sm:block border-border shadow-xs overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Dish</TableHead>
                  <TableHead className="text-right">Cooked (kg)</TableHead>
                  <TableHead className="text-right">Leftover (kg)</TableHead>
                  <TableHead className="text-right">Actual Diners</TableHead>
                  <TableHead>Learning Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {observations.map((obs) => (
                  <TableRow key={obs.id}>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {obs.date}
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                        {obs.mealType}
                      </span>
                    </TableCell>
                    <TableCell className="font-heading font-semibold text-foreground text-sm">
                      {obs.dishName}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground font-medium">
                      {obs.totalCookedKg !== null ? obs.totalCookedKg.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground font-medium">
                      {obs.unservedLeftoverKg !== null ? obs.unservedLeftoverKg.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground">
                      {obs.actualDiners !== null ? obs.actualDiners : "—"}
                    </TableCell>
                    <TableCell>{renderStatus(obs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </FounderShell>
  );
}
