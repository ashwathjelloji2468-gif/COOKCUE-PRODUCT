"use client";

import { useState, useEffect, useCallback } from "react";
import { getDishes, createDish, updateDish, deleteDish, type DishRecord } from "@/server/actions/dishes";
import { COMMON_ALLERGENS, formatAllergenLabel } from "@/lib/kitchen/allergens";
import { AllergenChips } from "@/components/kitchen/AllergenChips";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Utensils, Plus, Trash2, Edit2, AlertCircle, CheckCircle2, Lock, Tag, Calendar } from "lucide-react";

export function DishCatalog({ kitchenId }: { kitchenId: string }) {
  const [dishes, setDishes] = useState<DishRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("kg");
  const [unit, setUnit] = useState("kg");
  const [customUnit, setCustomUnit] = useState("");
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [menuCycleLabel, setMenuCycleLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit dish modal state
  const [editingDish, setEditingDish] = useState<DishRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("kg");
  const [editAllergens, setEditAllergens] = useState<string[]>([]);
  const [editMenuCycle, setEditMenuCycle] = useState("");
  const [updating, setUpdating] = useState(false);

  const loadDishes = useCallback(async () => {
    setLoading(true);
    const res = await getDishes(kitchenId);
    setLoading(false);
    if (res.success) {
      setDishes(res.data);
    }
  }, [kitchenId]);

  useEffect(() => {
    loadDishes();
  }, [loadDishes]);

  function toggleAllergen(tag: string, list: string[], setList: (l: string[]) => void) {
    if (list.includes(tag)) {
      setList(list.filter((t) => t !== tag));
    } else {
      setList([...list, tag]);
    }
  }

  async function handleCreateDish(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError(null);
    setSuccess(null);

    const finalUnit = (selectedPreset === "custom" ? customUnit.trim() : selectedPreset) || "kg";
    const res = await createDish(
      kitchenId,
      name.trim(),
      finalUnit,
      selectedAllergens,
      menuCycleLabel.trim() || null
    );
    setCreating(false);

    if (!res.success) {
      setError(res.error);
    } else {
      setSuccess(`Dish "${name.trim()}" added to catalog`);
      setName("");
      setSelectedPreset("kg");
      setUnit("kg");
      setCustomUnit("");
      setSelectedAllergens([]);
      setMenuCycleLabel("");
      loadDishes();
    }
  }

  function openEditModal(dish: DishRecord) {
    setEditingDish(dish);
    setEditName(dish.name);
    setEditUnit(dish.unit);
    setEditAllergens(dish.allergenTags || []);
    setEditMenuCycle(dish.menuCycleLabel || "");
    setError(null);
  }

  async function handleUpdateDish(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDish || !editName.trim()) return;

    setUpdating(true);
    setError(null);

    const res = await updateDish(kitchenId, editingDish.id, {
      name: editName.trim(),
      unit: editUnit.trim() || "kg",
      allergenTags: editAllergens,
      menuCycleLabel: editMenuCycle.trim() || null,
    });

    setUpdating(false);

    if (!res.success) {
      setError(res.error);
    } else {
      setSuccess(`Dish "${editName.trim()}" updated`);
      setEditingDish(null);
      loadDishes();
    }
  }

  async function handleDeleteDish(dishId: string, dishName: string) {
    if (!confirm(`Are you sure you want to delete "${dishName}"?`)) return;

    setError(null);
    setSuccess(null);

    const res = await deleteDish(kitchenId, dishId);
    if (!res.success) {
      setError(res.error);
    } else {
      setSuccess(`Dish "${dishName}" removed`);
      loadDishes();
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 flex items-center gap-2.5 font-medium shadow-2xs">
          <AlertCircle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-2.5 font-semibold shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Add New Dish Card */}
      <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Add New Menu Item
          </CardTitle>
          <CardDescription className="text-xs">
            Create an institutional recipe item with optional allergen tags and menu-cycle schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleCreateDish} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <Input
                  placeholder="e.g. Sambar, Steamed Rice, Dal Makhani"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={creating}
                  aria-label="New dish name"
                  className="h-10 text-xs font-medium"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPreset}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedPreset(val);
                    if (val !== "custom") {
                      setUnit(val);
                    } else {
                      setUnit(customUnit || "");
                    }
                  }}
                  disabled={creating}
                  className="h-10 px-3 text-xs rounded-lg border border-input bg-card text-foreground font-medium outline-none focus:ring-1 focus:ring-primary shadow-xs"
                  aria-label="Preset unit of measurement"
                >
                  <option value="kg">kg (weight)</option>
                  <option value="liters">liters (volume)</option>
                  <option value="portions">portions (count)</option>
                  <option value="trays">trays (bulk)</option>
                  <option value="custom">custom...</option>
                </select>

                {selectedPreset === "custom" && (
                  <Input
                    placeholder="Custom unit"
                    value={customUnit}
                    onChange={(e) => {
                      setCustomUnit(e.target.value);
                      setUnit(e.target.value);
                    }}
                    disabled={creating}
                    aria-label="Custom measurement unit"
                    className="w-28 h-10 text-xs font-mono font-medium"
                    required
                  />
                )}
              </div>
              <div className="w-48">
                <Input
                  placeholder="Menu cycle (e.g. Week A - Mon)"
                  value={menuCycleLabel}
                  onChange={(e) => setMenuCycleLabel(e.target.value)}
                  disabled={creating}
                  aria-label="Menu cycle label"
                  className="h-10 text-xs font-medium"
                />
              </div>
              <Button
                type="submit"
                disabled={creating || !name.trim()}
                className="h-10 px-5 text-xs font-semibold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#D9EF79]" />
                <span>{creating ? "Adding..." : "Add Dish"}</span>
              </Button>
            </div>

            {/* Allergen Chips Selector */}
            <div className="space-y-1.5 pt-1 border-t border-border/40">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Flag Common Allergens (Optional awareness):
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {COMMON_ALLERGENS.map((tag) => {
                  const selected = selectedAllergens.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleAllergen(tag, selectedAllergens, setSelectedAllergens)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        selected
                          ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/50 font-bold shadow-2xs"
                          : "bg-muted/40 text-muted-foreground border border-border/60 hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {selected ? `✓ ${formatAllergenLabel(tag)}` : `+ ${formatAllergenLabel(tag)}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Dish Catalog Table */}
      {dishes.length === 0 ? (
        <EmptyState
          icon={<Utensils className="w-10 h-10 text-muted-foreground" />}
          title="No menu items registered"
          description="Add your first dish above to start planning morning preparation and evening closeout."
        />
      ) : (
        <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden p-0">
          <div className="px-5 py-3.5 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-primary" />
              <span className="font-heading font-bold text-sm text-foreground">Registered Recipes</span>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60 tabular-nums">
              {dishes.length} items
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border">
                  <TableHead className="py-3 px-4 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Dish &amp; Allergens</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Unit</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground text-right">Historical Services</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60">
                {dishes.map((dish) => (
                  <TableRow key={dish.id} className="hover:bg-muted/25 transition-colors">
                    <TableCell className="py-3.5 px-4">
                      <div className="font-heading font-bold text-foreground text-sm">
                        {dish.name}
                      </div>
                      <AllergenChips
                        allergenTags={dish.allergenTags}
                        menuCycleLabel={dish.menuCycleLabel}
                        className="mt-1.5"
                      />
                    </TableCell>
                    <TableCell className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded bg-muted border border-border/60 font-semibold">
                        {dish.unit}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                      {dish.observationCount > 0 ? (
                        <span className="text-emerald-800 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                          {dish.observationCount} services recorded
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">No records yet</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditModal(dish)}
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                          title="Edit recipe details, allergens, or menu cycle"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" />
                          <span>Edit</span>
                        </Button>

                        {dish.observationCount === 0 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteDish(dish.id, dish.name)}
                            className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/40 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            <span>Delete</span>
                          </Button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded border border-border/60"
                            title="Dishes with completed historical service observations are locked against hard deletion to preserve audit history"
                          >
                            <Lock className="w-3 h-3 text-muted-foreground/70" />
                            <span>Locked</span>
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Edit Dish Modal */}
      {editingDish && (
        <Dialog open={Boolean(editingDish)} onOpenChange={(open) => !open && setEditingDish(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold text-base">
                Edit Recipe: {editingDish.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update measurement unit, operational allergen flags, or menu-cycle schedule.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpdateDish} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Dish Name</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={updating}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Measurement Unit</label>
                  <Input
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    disabled={updating}
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Menu Cycle</label>
                  <Input
                    placeholder="e.g. Week B - Tue"
                    value={editMenuCycle}
                    onChange={(e) => setEditMenuCycle(e.target.value)}
                    disabled={updating}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Edit Allergens */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <label className="text-xs font-semibold text-foreground block">
                  Allergen Flags:
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {COMMON_ALLERGENS.map((tag) => {
                    const selected = editAllergens.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleAllergen(tag, editAllergens, setEditAllergens)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                          selected
                            ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/50 font-bold"
                            : "bg-muted/40 text-muted-foreground border border-border/60 hover:text-foreground"
                        }`}
                      >
                        {selected ? `✓ ${formatAllergenLabel(tag)}` : `+ ${formatAllergenLabel(tag)}`}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground italic mt-1">
                  Caution: Flagged for staff board awareness only. Not a medical guarantee.
                </p>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingDish(null)}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updating || !editName.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {updating ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
