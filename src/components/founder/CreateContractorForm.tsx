"use client";

import { useState } from "react";
import { createContractor } from "@/server/actions/contractor";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Plus } from "lucide-react";

export function CreateContractorForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createContractor({
      name,
      primaryContactName: primaryContactName || undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      address: address || undefined,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    router.push(`/founder/contractors/${res.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="orgName">Organization Name *</Label>
        <Input
          id="orgName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Apex Catering Services Ltd"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contactName">Primary Contact Person</Label>
        <Input
          id="contactName"
          type="text"
          value={primaryContactName}
          onChange={(e) => setPrimaryContactName(e.target.value)}
          placeholder="e.g. Rajesh Kumar"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contactEmail">Official Contact Email</Label>
        <Input
          id="contactEmail"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="contact@apexcatering.in"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contactPhone">Contact Phone Number</Label>
        <Input
          id="contactPhone"
          type="text"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="+91 98765 43210"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Official Address</Label>
        <Input
          id="address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 12 Industrial Area, Phase II, Bengaluru"
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
          <span>{loading ? "Onboarding Contractor..." : "Register Contractor"}</span>
        </Button>
      </div>
    </form>
  );
}
