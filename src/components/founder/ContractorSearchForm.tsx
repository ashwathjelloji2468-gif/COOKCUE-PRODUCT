"use client";

import React, { useState } from "react";
import Link from "next/link";
import { searchContractorsAsFounder } from "@/server/actions/contractor";
import { Search, Building2, ChevronRight, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";

interface ContractorSearchFormProps {
  initialContractors?: {
    id: string;
    code?: string | null;
    name: string;
    status: string;
    primaryContactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    address?: string | null;
    createdAt: string | Date;
  }[];
}

export function ContractorSearchForm({ initialContractors = [] }: ContractorSearchFormProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [results, setResults] = useState(initialContractors);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setHasSearched(true);

    const res = await searchContractorsAsFounder(query);
    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setResults(
      res.data.map((c) => ({
        ...c,
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      }))
    );
  }

  async function handleClearFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setError(null);
    setHasSearched(false);
    setLoading(true);

    const res = await searchContractorsAsFounder("");
    setLoading(false);

    if (res.success) {
      setResults(
        res.data.map((c) => ({
          ...c,
          createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
        }))
      );
    }
  }

  const displayedContractors = results.filter((c) => {
    if (statusFilter === "ALL") return true;
    return c.status.toUpperCase() === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search contractors"
            placeholder="Search by exact contractor code (e.g. CTR-000001) or organization name..."
            className="pl-10 pr-9 h-11 text-xs bg-background border-input shadow-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
              title="Clear text query"
              aria-label="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 px-3 text-xs rounded-lg border border-input bg-card text-foreground outline-none focus:ring-1 focus:ring-primary shadow-xs"
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <Button
            type="submit"
            disabled={loading}
            className="h-11 px-5 text-xs font-semibold shadow-xs"
          >
            {loading ? "Searching..." : "Search"}
          </Button>

          {(hasSearched || query || statusFilter !== "ALL") && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClearFilters}
              className="h-11 px-4 text-xs font-medium border-border"
            >
              Clear filters
            </Button>
          )}
        </div>
      </form>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results or Empty State */}
      {displayedContractors.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-10 h-10 text-muted-foreground" />}
          title="No contractors found"
          description={
            hasSearched || statusFilter !== "ALL"
              ? `No contractor organization matching your filters was found in the database.`
              : "No contractor organizations currently exist in the database."
          }
        />
      ) : (
        <div className="grid gap-3">
          {displayedContractors.map((c) => {
            const createdDateStr =
              typeof c.createdAt === "string"
                ? c.createdAt.slice(0, 10)
                : c.createdAt instanceof Date
                ? c.createdAt.toISOString().slice(0, 10)
                : "";

            return (
              <Card key={c.id} className="cc-card border-border hover:border-foreground/30 transition-all p-0">
                <Link
                  href={`/founder/contractors/${c.id}`}
                  className="flex items-center justify-between p-5 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-muted border border-border/70 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-heading font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                          {c.name}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">
                          Contractor ID: {c.code || "Not provided"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <StatusBadge
                          status={c.status === "ACTIVE" ? "active" : "inactive"}
                          label={c.status}
                        />
                        <span className="text-xs text-muted-foreground">
                          Contact: {c.primaryContactName || "Not provided"}
                        </span>
                        {createdDateStr && (
                          <span className="text-xs text-muted-foreground font-mono tabular-nums">
                            • Created {createdDateStr}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
