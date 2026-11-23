"use client";

import { useState } from "react";
import { updateContractor } from "@/server/actions/contractor";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit3, AlertCircle, Save } from "lucide-react";

interface EditContractorModalProps {
  contractor: {
    id: string;
    code?: string | null;
    name: string;
    status: string;
    primaryContactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    address?: string | null;
  };
}

export function EditContractorModal({ contractor }: EditContractorModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(contractor.name);
  const [primaryContactName, setPrimaryContactName] = useState(contractor.primaryContactName || "");
  const [contactEmail, setContactEmail] = useState(contractor.contactEmail || "");
  const [contactPhone, setContactPhone] = useState(contractor.contactPhone || "");
  const [address, setAddress] = useState(contractor.address || "");
  const [status, setStatus] = useState(contractor.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await updateContractor(contractor.id, {
      name: name.trim(),
      primaryContactName: primaryContactName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      address: address.trim() || null,
      status,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 shadow-xs">
          <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Edit Details</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Edit Contractor Details</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-orgName">Organization Name *</Label>
            <Input
              id="edit-orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-contactName">Primary Contact Person</Label>
            <Input
              id="edit-contactName"
              value={primaryContactName}
              onChange={(e) => setPrimaryContactName(e.target.value)}
              placeholder="e.g. Rajesh Kumar"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-contactEmail">Official Contact Email</Label>
            <Input
              id="edit-contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@contractor.in"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-contactPhone">Contact Phone Number</Label>
            <Input
              id="edit-contactPhone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-address">Official Address</Label>
            <Input
              id="edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, Postal Code"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-status">Status</Label>
            <select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Contractor organization status"
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="PENDING">PENDING</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading || !name.trim()} className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              <span>{loading ? "Saving..." : "Save Changes"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
