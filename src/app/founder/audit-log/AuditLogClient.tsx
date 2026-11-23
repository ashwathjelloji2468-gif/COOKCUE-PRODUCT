"use client";

import React, { useState, useMemo } from "react";
import type { AuditEvent } from "@/server/actions/audit";
import {
  Search,
  ScrollText,
  UtensilsCrossed,
  Edit3,
  CalendarCheck,
  Building2,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  User,
  ArrowRight,
  Layers,
  FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";

interface AuditLogClientProps {
  initialEvents: AuditEvent[];
}

export function AuditLogClient({ initialEvents }: AuditLogClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  // Default to expanding all events with diffs or snapshots so Before/After diffs are immediately visible
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(initialEvents.map((e) => e.id))
  );

  const filteredEvents = useMemo(() => {
    return initialEvents.filter((e) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.eventType.toLowerCase().includes(q) ||
        (e.kitchenName && e.kitchenName.toLowerCase().includes(q)) ||
        (e.contractorName && e.contractorName.toLowerCase().includes(q)) ||
        (e.actor?.name && e.actor.name.toLowerCase().includes(q)) ||
        (e.actor?.email && e.actor.email.toLowerCase().includes(q));

      const matchesCategory = categoryFilter === "ALL" || e.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [initialEvents, searchQuery, categoryFilter]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (expandedIds.size === filteredEvents.length) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(filteredEvents.map((e) => e.id)));
    }
  }

  if (initialEvents.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText className="w-10 h-10 text-[var(--muted)]" />}
        title="No audit events yet."
        description="As service closeouts, recommendation overrides, and administrative actions occur in the platform, an immutable chronological audit trail will populate here automatically."
      />
    );
  }

  const getEventIcon = (eventType: AuditEvent["eventType"], severity: AuditEvent["severity"]) => {
    switch (eventType) {
      case "SERVICE_CLOSEOUT":
        if (severity === "warning" || severity === "danger") {
          return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
        }
        return <UtensilsCrossed className="w-3.5 h-3.5 text-[var(--accent)]" />;
      case "OBSERVATION_ADJUSTMENT":
        return <Edit3 className="w-3.5 h-3.5 text-amber-500" />;
      case "PLAN_OVERRIDE":
        return <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case "COOKING_PLAN_STATUS":
        return <CalendarCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case "ONBOARDING_APPLICATION":
        return <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />;
      case "CONTRACTOR_STATUS":
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-[var(--muted)]" />;
    }
  };

  const getCategoryBadge = (category: AuditEvent["category"], severity: AuditEvent["severity"]) => {
    let colorClasses = "bg-muted text-muted-foreground border-border";

    if (severity === "danger") {
      colorClasses = "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
    } else if (severity === "warning") {
      colorClasses = "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20";
    } else if (severity === "success") {
      colorClasses = "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20";
    } else if (category === "Planning") {
      colorClasses = "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colorClasses}`}>
        {category}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <Input
            type="text"
            placeholder="Search audit trail by dish, kitchen, or actor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search audit trail"
            className="pl-10 h-10 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleAll}
            className="h-10 text-xs font-semibold"
          >
            {expandedIds.size === filteredEvents.length ? "Collapse All Diffs" : "Expand All Diffs"}
          </Button>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter audit events by category"
            className="h-10 px-3 text-xs rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors font-medium"
          >
            <option value="ALL">All Categories ({initialEvents.length})</option>
            <option value="Closeout">Service Closeouts</option>
            <option value="Adjustment">Record Adjustments (Diff)</option>
            <option value="Planning">Cooking Plans &amp; Overrides (Diff)</option>
            <option value="Onboarding">Onboarding Applications</option>
            <option value="Governance">Contractor Governance</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <Card className="cc-card border-border shadow-xs bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-heading font-bold text-foreground">
              Chronological Audit Trail &amp; Before/After Diff
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Showing {filteredEvents.length} of {initialEvents.length} live database audit events. Expand any event to inspect visual before/after changes or point-in-time snapshots.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[650px] cc-table">
            <table className="w-full text-xs text-left cc-table">
              <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border font-semibold sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-3 px-3 w-8"></th>
                  <th className="py-3 px-4 whitespace-nowrap">Timestamp</th>
                  <th className="py-3 px-4 whitespace-nowrap">Category</th>
                  <th className="py-3 px-4">Event &amp; Description</th>
                  <th className="py-3 px-4 whitespace-nowrap">Facility / Organization</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[var(--muted)] italic">
                      No audit events match your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((event) => {
                    const isExpanded = expandedIds.has(event.id);
                    const hasDiff = Boolean(event.diff && event.diff.length > 0);
                    const hasSnapshot = Boolean(event.snapshot && event.snapshot.length > 0);

                    return (
                      <React.Fragment key={event.id}>
                        {/* Main Event Row */}
                        <tr
                          onClick={() => toggleExpand(event.id)}
                          className={`hover:bg-[var(--accent-soft)] transition-colors cursor-pointer ${
                            isExpanded ? "bg-[var(--accent-soft)]/50" : ""
                          }`}
                        >
                          <td className="py-3.5 pl-3 pr-1 text-center align-top text-[var(--muted)]">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-primary" />
                            ) : (
                              <ChevronRight className="w-4 h-4 opacity-60" />
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-[var(--muted)] align-top">
                            {new Date(event.timestamp).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="p-1 rounded-md bg-[var(--background)] border border-[var(--card-border)]">
                                {getEventIcon(event.eventType, event.severity)}
                              </span>
                              {getCategoryBadge(event.category, event.severity)}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-center gap-2">
                              <span className="font-heading font-bold text-[var(--foreground)] text-xs">
                                {event.title}
                              </span>
                              {hasDiff && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                  Diff ({event.diff?.length} {event.diff?.length === 1 ? "field" : "fields"})
                                </span>
                              )}
                              {!hasDiff && hasSnapshot && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                                  Snapshot
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                              {event.summary}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap align-top">
                            {event.kitchenName || event.contractorName ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--foreground)]">
                                {event.kitchenName || event.contractorName}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[var(--muted)] italic">
                                Platform Wide
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap align-top text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(event.id);
                              }}
                              className="text-xs text-primary hover:underline font-semibold"
                            >
                              {isExpanded ? "Hide Details" : hasDiff ? "View Diff" : hasSnapshot ? "View Snapshot" : "View Detail"}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Visual Diff / Snapshot Details */}
                        {isExpanded && (
                          <tr className="bg-[var(--background)] border-b border-[var(--card-border)]">
                            <td colSpan={6} className="p-4 sm:p-5">
                              <div
                                aria-label={`Audit event detail: ${event.title}`}
                                className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 sm:p-5 space-y-4 shadow-2xs max-h-[70vh] overflow-y-auto"
                              >
                                {/* Metadata Ribbon: Actor, Timestamp, Reason */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--card-border)] text-xs">
                                  <div className="flex flex-wrap items-center gap-3">
                                    {event.actor ? (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground border border-border">
                                        <User className="w-3.5 h-3.5 text-primary" />
                                        <span>
                                          Actor: <strong className="font-semibold">{event.actor.name || event.actor.email || "Authorized User"}</strong>
                                          {event.actor.role ? ` (${event.actor.role})` : ""}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border">
                                        <User className="w-3.5 h-3.5" />
                                        <span>Actor: System Logged</span>
                                      </div>
                                    )}

                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground border border-border">
                                      <Clock className="w-3.5 h-3.5 text-primary" />
                                      <span className="font-mono text-[11px]">
                                        {new Date(event.timestamp).toLocaleString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          second: "2-digit",
                                          timeZoneName: "short",
                                        })}
                                      </span>
                                    </div>
                                  </div>

                                  {event.reason && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 text-xs font-medium">
                                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Reason: <em>&ldquo;{event.reason}&rdquo;</em></span>
                                    </div>
                                  )}
                                </div>

                                {/* Full Event Detail Overview */}
                                <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/60">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="font-heading font-bold text-foreground">{event.title}</span>
                                    <span className="font-mono text-[10px] text-muted-foreground">Event ID: {event.id}</span>
                                  </div>
                                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                    {event.summary}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground font-mono">
                                    <span>Type: {event.eventType}</span>
                                    <span>•</span>
                                    <span>Category: {event.category}</span>
                                    {event.kitchenName && (
                                      <>
                                        <span>•</span>
                                        <span>Kitchen: {event.kitchenName}</span>
                                      </>
                                    )}
                                    {event.contractorName && (
                                      <>
                                        <span>•</span>
                                        <span>Contractor: {event.contractorName}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* CASE 1: Before / After Diff (Where previous vs new values exist) */}
                                {hasDiff && (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-xs font-bold font-heading text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Two-Column Visual Before / After Diff</span>
                                      </h5>
                                      <span className="text-[11px] text-muted-foreground">
                                        Comparing previous stored value against revised state
                                      </span>
                                    </div>

                                    <div className="border border-border/80 rounded-lg overflow-x-auto bg-[var(--card)] shadow-xs">
                                      <table className="w-full text-xs min-w-[500px]">
                                        <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/80">
                                          <tr>
                                            <th className="py-2.5 px-3.5 text-left font-semibold w-1/3">Field Name</th>
                                            <th className="py-2.5 px-3.5 text-left font-bold w-1/3 bg-rose-500/10 text-rose-800 dark:text-rose-200 border-l border-rose-500/20">
                                              Before (Previous Value)
                                            </th>
                                            <th className="py-2.5 px-3.5 text-left font-bold w-1/3 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-l border-emerald-500/20">
                                              After (New Value)
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                          {event.diff!.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                              <td className="py-2.5 px-3.5 font-semibold text-foreground">
                                                {item.field}
                                              </td>
                                              <td className="py-2.5 px-3.5 bg-rose-500/5 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 border-l border-border/60">
                                                <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] bg-rose-500/10 dark:bg-rose-900/30 border border-rose-500/25 line-through opacity-90">
                                                  {String(item.before)}
                                                </span>
                                              </td>
                                              <td className="py-2.5 px-3.5 bg-emerald-500/5 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 border-l border-border/60">
                                                <div className="flex items-center gap-2">
                                                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                  <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] bg-emerald-500/15 dark:bg-emerald-900/30 border border-emerald-500/30 font-bold text-emerald-900 dark:text-emerald-200">
                                                    {String(item.after)}
                                                  </span>
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* CASE 2: Single Point-in-Time Snapshot (No prior state modified) */}
                                {hasSnapshot && (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-xs font-bold font-heading text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-primary" />
                                        <span>
                                          {hasDiff ? "Reference Baseline Snapshot" : "Point-in-Time Event Snapshot (Single State)"}
                                        </span>
                                      </h5>
                                      {!hasDiff && (
                                        <span className="text-[11px] text-muted-foreground italic">
                                          Single snapshot capture — point-in-time record (never invents a prior state)
                                        </span>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                      {event.snapshot!.map((item, idx) => (
                                        <div
                                          key={idx}
                                          className="p-2.5 rounded-lg border border-border/70 bg-muted/20 space-y-1"
                                        >
                                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            {item.field}
                                          </div>
                                          <div className="font-mono text-xs font-bold text-foreground break-words">
                                            {String(item.value)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
