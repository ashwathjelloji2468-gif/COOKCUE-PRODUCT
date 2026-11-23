"use client";

import { useState } from "react";
import { createKitchen } from "@/server/actions/kitchen-setup";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Plus } from "lucide-react";

export function CreateKitchenForm({ contractorId }: { contractorId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createKitchen({
      contractorId,
      name,
      location: location || undefined,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    router.push(`/founder/kitchens/${res.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="kitchenName">Kitchen Facility Name *</Label>
        <Input
          id="kitchenName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Campus North Dining Kitchen"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="location">Campus / Facility Location</Label>
        <Input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Block 4, Ground Floor"
        />
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="pt-2">
        <Button
          type="submit"
          disabled={loading || !name.trim()}
          size="lg"
          className="w-full gap-2 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>{loading ? "Provisioning Kitchen..." : "Add Kitchen Facility"}</span>
        </Button>
      </div>
    </form>
  );
}
