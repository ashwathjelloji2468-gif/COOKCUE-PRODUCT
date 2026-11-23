"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Calendar,
  Clock,
  ArrowRight,
  ChefHat,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type IndentSummary = {
  id: string;
  mealId: string;
  mealType: string;
  date: string;
  status: "DRAFT" | "REQUESTED" | "CANCELLED";
  lineCount: number;
  totalTargetKg: number;
  createdByName: string;
  createdAt: string;
  requestedAt: string | null;
};

interface IndentListClientProps {
  kitchenId: string;
  indents: IndentSummary[];
}

export function IndentListClient({ kitchenId, indents }: IndentListClientProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const filtered = indents.filter((ind) => {
    if (filterStatus === "ALL") return true;
    return ind.status === filterStatus;
  });

  const getStatusBadge = (status: "DRAFT" | "REQUESTED" | "CANCELLED") => {
    switch (status) {
      case "REQUESTED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold text-xs py-0.5">
            <CheckCircle2 className="w-3 h-3" />
            <span>Requested</span>
          </Badge>
        );
      case "DRAFT":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold text-xs py-0.5">
            <AlertCircle className="w-3 h-3" />
            <span>Draft — needs request</span>
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1 text-xs py-0.5">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header controls & filter tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg border border-border/60 text-xs">
          {["ALL", "REQUESTED", "DRAFT", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={cn(
                "px-3 py-1.5 rounded-md font-medium transition-all text-xs",
                filterStatus === st
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {st === "ALL" ? "All Indents" : st.charAt(0) + st.slice(1).toLowerCase()}
              <span className="ml-1.5 text-[10px] opacity-70">
                ({st === "ALL" ? indents.length : indents.filter((i) => i.status === st).length})
              </span>
            </button>
          ))}
        </div>

        <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-medium self-start sm:self-auto">
          <Link href={`/kitchen/${kitchenId}/morning`}>
            <ChefHat className="w-3.5 h-3.5 text-primary" />
            <span>Morning Cooking Plan</span>
          </Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-border p-8 bg-card text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="font-heading font-bold text-base text-foreground">
              No purchase indents found
            </h3>
            <p className="text-xs text-muted-foreground">
              Procurement indents list dish targets created from approved morning cooking plans so store and purchase teams know what to prepare.
            </p>
          </div>
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5">
            <Link href={`/kitchen/${kitchenId}/morning`}>
              <ChefHat className="w-3.5 h-3.5 text-emerald-400" />
              <span>Review Morning Plan &rarr;</span>
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((ind) => (
            <Card
              key={ind.id}
              className="border-border/80 hover:border-primary/40 transition-colors shadow-xs bg-card overflow-hidden"
            >
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-bold text-base text-foreground">
                      {ind.mealType} Service
                    </span>
                    <span className="font-mono text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
                      {ind.date}
                    </span>
                    {getStatusBadge(ind.status)}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <span className="font-semibold text-primary">{ind.lineCount}</span> dishes planned
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      Target: <span className="font-bold text-foreground font-mono">{ind.totalTargetKg} kg</span>
                    </span>
                    <span>&bull;</span>
                    <span>Created by {ind.createdByName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs font-semibold hover:bg-muted">
                    <Link href={`/kitchen/${kitchenId}/indents/${ind.id}`}>
                      <span>View Indent</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
