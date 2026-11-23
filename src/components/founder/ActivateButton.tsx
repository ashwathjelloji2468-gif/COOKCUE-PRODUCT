"use client";

import { useState } from "react";
import { activateContractor } from "@/server/actions/contractor";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ActivateButton({ contractorId }: { contractorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate() {
    setLoading(true);
    setError(null);
    const res = await activateContractor(contractorId);
    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <Button
        onClick={handleActivate}
        disabled={loading}
        className="gap-2 shadow-xs bg-emerald-700 hover:bg-emerald-800 text-white"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>{loading ? "Activating..." : "Activate Contractor"}</span>
      </Button>
      {error && (
        <p className="text-red-700 text-xs mt-2 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
