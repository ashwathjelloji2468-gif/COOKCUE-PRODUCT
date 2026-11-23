"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Loader2 } from "lucide-react";
import { createIndentFromApprovedPlan } from "@/server/actions/indents";

interface CreateIndentButtonProps {
  kitchenId: string;
  mealId: string;
  isApproved: boolean;
  existingIndentId?: string | null;
  existingStatus?: string | null;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function CreateIndentButton({
  kitchenId,
  mealId,
  isApproved,
  existingIndentId,
  existingStatus,
  className,
  variant = "outline",
  size = "sm",
}: CreateIndentButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isApproved) return null;

  if (existingIndentId) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => router.push(`/kitchen/${kitchenId}/indents/${existingIndentId}`)}
      >
        <ShoppingBag className="w-3.5 h-3.5 mr-1.5 text-primary" />
        <span>View purchase indent {existingStatus ? `(${existingStatus})` : ""}</span>
      </Button>
    );
  }

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await createIndentFromApprovedPlan(kitchenId, mealId);
      if (res.success) {
        router.push(`/kitchen/${kitchenId}/indents/${res.indentId}`);
      } else {
        if (res.indentId) {
          router.push(`/kitchen/${kitchenId}/indents/${res.indentId}`);
        } else {
          setError(res.error);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to create indent");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={loading}
        onClick={handleCreate}
        className={className}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
        ) : (
          <ShoppingBag className="w-3.5 h-3.5 mr-1.5 text-primary" />
        )}
        <span>Create purchase indent</span>
      </Button>
      {error && <span className="text-[11px] text-destructive">{error}</span>}
    </div>
  );
}
