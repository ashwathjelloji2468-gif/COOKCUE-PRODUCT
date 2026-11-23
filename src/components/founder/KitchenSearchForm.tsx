"use client";

import { useState } from "react";
import { searchKitchensAsFounder } from "@/server/actions/kitchen";
import type { KitchenSearchResult } from "@/lib/domain/types";
import Link from "next/link";
import { Search, MapPin, Building2, ChevronRight, AlertCircle, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";

export function KitchenSearchForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KitchenSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setSearched(true);

    const res = await searchKitchensAsFounder(query);
    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }
    setResults(res.data);
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search kitchens by name or facility ID"
            placeholder="Search kitchen name or unique facility ID..."
            className="pl-10 h-11 text-sm bg-background border-input"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="gap-2 shadow-xs shrink-0"
        >
          <Search className="w-4 h-4" />
          <span>{loading ? "Searching..." : "Search Kitchens"}</span>
        </Button>
      </form>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-mono text-muted-foreground tabular-nums block mb-1">
            Found {results.length} kitchen facilities
          </span>
          {results.map((k) => (
            <Card
              key={k.id}
              className="border-border hover:border-foreground/30 hover:bg-muted/30 transition-all p-0"
            >
              <Link
                href={`/founder/kitchens/${k.id}`}
                className="flex items-center justify-between p-4 sm:p-5 group"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="w-5 h-5 text-emerald-800 dark:text-emerald-300" />
                  </div>
                  <div>
                    <h4 className="font-heading font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                      {k.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{k.location || "Location: Not provided"}</span>
                      </span>
                      <span>•</span>
                      <span>Contractor: <strong className="text-foreground">{k.contractorName}</strong></span>
                      <span>•</span>
                      <StatusBadge
                        status={k.status === "ACTIVE" ? "active" : "inactive"}
                        label={k.status}
                      />
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>
            </Card>
          ))}
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <EmptyState
          icon={<Search className="w-10 h-10 text-muted-foreground" />}
          title="No kitchens found"
          description={`No kitchen matching "${query}" was found. Try searching by contractor organization or kitchen name.`}
        />
      )}

      {!searched && !loading && (
        <div className="py-8 px-4 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center mx-auto text-muted-foreground">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-heading font-semibold text-foreground text-sm">
              Search Kitchen Facilities Directory
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Find production kitchens and dining stations by name, location, or contractor code to inspect morning plans, service closeouts, and learning telemetry.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Search tips:</span>
            <span className="px-2 py-0.5 rounded bg-muted border border-border">e.g. Central</span>
            <span className="px-2 py-0.5 rounded bg-muted border border-border">e.g. Hostel</span>
            <span className="px-2 py-0.5 rounded bg-muted border border-border">e.g. CTR-000001</span>
          </div>
        </div>
      )}
    </div>
  );
}
