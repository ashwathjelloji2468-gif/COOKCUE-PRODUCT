import { listContractors } from "@/server/actions/contractor";
import Link from "next/link";
import { FounderShell } from "@/components/layout/FounderShell";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractorSearchForm } from "@/components/founder/ContractorSearchForm";

export default async function ContractorsPage() {
  const res = await listContractors();
  const contractors = res.success
    ? res.data.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      }))
    : [];

  return (
    <FounderShell
      title="Contractors"
      subtitle="Onboard, search, and manage contractor organizations across the platform"
      action={
        <Button asChild className="gap-2 shadow-xs">
          <Link href="/founder/contractors/new">
            <Plus className="w-4 h-4" />
            <span>Add Contractor</span>
          </Link>
        </Button>
      }
    >
      <ContractorSearchForm initialContractors={contractors} />
    </FounderShell>
  );
}
