import React from "react";
import { formatAllergenLabel } from "@/lib/kitchen/allergens";
import { AlertCircle, Calendar } from "lucide-react";

interface AllergenChipsProps {
  allergenTags?: string[];
  menuCycleLabel?: string | null;
  className?: string;
  showCautionNote?: boolean;
}

export function AllergenChips({
  allergenTags = [],
  menuCycleLabel = null,
  className = "",
  showCautionNote = false,
}: AllergenChipsProps) {
  const hasAllergens = allergenTags && allergenTags.length > 0;
  const hasCycle = Boolean(menuCycleLabel && menuCycleLabel.trim());

  if (!hasAllergens && !hasCycle) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {/* Menu Cycle Label */}
      {hasCycle && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border/70 print:border-black print:text-black"
          title={`Menu Cycle: ${menuCycleLabel}`}
        >
          <Calendar className="w-2.5 h-2.5 opacity-70 print:hidden" />
          <span>{menuCycleLabel}</span>
        </span>
      )}

      {/* Allergen Tags */}
      {hasAllergens &&
        allergenTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 print:border-black print:text-black print:bg-transparent"
            title={`May contain ${formatAllergenLabel(tag)} (Operational awareness only)`}
          >
            <AlertCircle className="w-2.5 h-2.5 opacity-80 print:hidden" />
            <span>{formatAllergenLabel(tag)}</span>
          </span>
        ))}

      {showCautionNote && hasAllergens && (
        <span className="text-[10px] text-muted-foreground italic print:hidden">
          (Caution: may contain flagged ingredients)
        </span>
      )}
    </div>
  );
}
