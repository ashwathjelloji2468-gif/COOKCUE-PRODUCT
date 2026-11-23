"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Search, Utensils, ArrowRight, X, ChefHat, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getDishes } from "@/server/actions/dishes";
import { cn } from "@/lib/utils";

type DishItem = {
  id: string;
  name: string;
  unit: string;
  observationCount: number;
};

export function KitchenDishSearchModal({ kitchenId }: { kitchenId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch dishes when modal opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      startTransition(async () => {
        const res = await getDishes(kitchenId);
        if (res.success) {
          setDishes(res.data);
        }
        setLoading(false);
      });
    } else {
      setQuery("");
    }
  }, [open, kitchenId]);

  const filtered = dishes.filter((d) =>
    d.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <>
      {/* Trigger Button in Topbar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-xs rounded-lg border border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/50 pl-8 pr-3 py-1.5 text-left text-[var(--muted)] flex items-center justify-between transition-colors shadow-2xs group relative"
      >
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors" />
        <span className="truncate">Search recipes, dish catalog...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-[var(--muted)] bg-[var(--background)] rounded border border-[var(--card-border)]">
          ⌘K
        </kbd>
      </button>

      {/* Modal Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-[var(--card)] border border-[var(--card-border)] shadow-2xl rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Search Station Recipes</DialogTitle>
            <DialogDescription>Quickly search and jump to dishes</DialogDescription>
          </DialogHeader>

          {/* Search Input Bar */}
          <div className="flex items-center px-4 py-3 border-b border-[var(--card-border)] bg-[var(--background)]/40">
            <Search className="w-4 h-4 text-[var(--accent)] shrink-0 mr-3" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search dishes or recipes"
              placeholder="Type recipe or dish name..."
              className="w-full bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none font-medium"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--card-border)]">
            {loading ? (
              <div className="p-8 text-center text-xs text-[var(--muted)] flex items-center justify-center gap-2">
                <span>Loading station catalog...</span>
              </div>
            ) : dishes.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Utensils className="w-8 h-8 text-[var(--muted)] mx-auto" />
                <p className="text-xs font-semibold text-[var(--foreground)]">No recipes registered</p>
                <p className="text-[11px] text-[var(--muted)]">
                  Add items to your catalog to plan morning preparation.
                </p>
                <Link
                  href={`/kitchen/${kitchenId}/dishes`}
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] font-semibold hover:underline mt-2"
                >
                  <span>Go to Dish Catalog</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <p className="text-xs font-semibold text-[var(--foreground)]">No matching recipes</p>
                <p className="text-[11px] text-[var(--muted)]">
                  No registered dishes matching &ldquo;{query}&rdquo;
                </p>
              </div>
            ) : (
              filtered.map((d) => (
                <div
                  key={d.id}
                  className="p-3.5 flex items-center justify-between hover:bg-[var(--accent-soft)] transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--background)] border border-[var(--card-border)] flex items-center justify-center shrink-0">
                      <Utensils className="w-3.5 h-3.5 text-[var(--accent)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading font-semibold text-xs text-[var(--foreground)] truncate">
                        {d.name}
                      </p>
                      <p className="text-[10px] text-[var(--muted)] font-mono">
                        Unit: {d.unit} · {d.observationCount} services recorded
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={`/kitchen/${kitchenId}/morning`}
                      onClick={() => setOpen(false)}
                      className="text-[10px] px-2 py-1 rounded bg-[var(--background)] hover:bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground)] font-medium inline-flex items-center gap-1"
                      title="Include in Morning Cooking Plan"
                    >
                      <ChefHat className="w-3 h-3 text-[var(--accent)]" />
                      <span>Plan</span>
                    </Link>
                    <Link
                      href={`/kitchen/${kitchenId}/dishes`}
                      onClick={() => setOpen(false)}
                      className="text-[10px] px-2 py-1 rounded bg-[var(--background)] hover:bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground)] font-medium inline-flex items-center gap-1"
                      title="Manage Dish in Catalog"
                    >
                      <span>Catalog</span>
                      <ArrowRight className="w-3 h-3 text-[var(--muted)]" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--card-border)] bg-[var(--background)]/40 flex items-center justify-between text-[10px] text-[var(--muted)]">
            <span>{filtered.length} recipe{filtered.length !== 1 ? "s" : ""}</span>
            <Link
              href={`/kitchen/${kitchenId}/dishes`}
              onClick={() => setOpen(false)}
              className="text-[var(--accent)] font-semibold hover:underline inline-flex items-center gap-1"
            >
              <span>Manage Dish Catalog</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
