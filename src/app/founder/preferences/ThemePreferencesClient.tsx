"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemePreferencesClient() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)] p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-[var(--card-border)] rounded w-1/3" />
          <div className="h-20 bg-[var(--card-border)] rounded" />
        </div>
      </Card>
    );
  }

  const options = [
    {
      id: "light",
      name: "Light Mode",
      description: "Warm institutional light look with high legibility.",
      icon: Sun,
    },
    {
      id: "dark",
      name: "Dark Mode",
      description: "Executive deep pine & dark palette for low-light environments.",
      icon: Moon,
    },
    {
      id: "system",
      name: "System Default",
      description: "Automatically match your operating system theme settings.",
      icon: Laptop,
    },
  ];

  return (
    <Card className="border-[var(--card-border)] shadow-xs bg-[var(--card)]">
      <CardHeader className="pb-3 border-b border-[var(--card-border)]">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-heading font-bold text-[var(--foreground)]">
              Appearance &amp; Theme
            </CardTitle>
            <CardDescription className="text-xs text-[var(--muted)]">
              Select how CookCue looks on your display. Persisted to your local device under{" "}
              <code className="font-mono text-[10px] bg-[var(--background)] px-1.5 py-0.5 rounded border border-[var(--card-border)]">
                cookcue-theme
              </code>
            </CardDescription>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--card-border)]">
            Active: {resolvedTheme}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div role="radiogroup" aria-label="Theme selection" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setTheme(opt.id)}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between group",
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
                    : "border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--accent)]/50"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                        isSelected
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)] group-hover:text-[var(--foreground)]"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <h4 className="font-heading font-bold text-xs text-[var(--foreground)]">
                    {opt.name}
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
