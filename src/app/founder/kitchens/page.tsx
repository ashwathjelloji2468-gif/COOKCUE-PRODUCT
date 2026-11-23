import { FounderShell } from "@/components/layout/FounderShell";
import { KitchenSearchForm } from "@/components/founder/KitchenSearchForm";
import { Card } from "@/components/ui/card";

export default function KitchensSearchPage() {
  return (
    <FounderShell
      title="Kitchens"
      subtitle="Find a kitchen and review its operational records."
    >
      <Card className="border-border shadow-xs p-6">
        <KitchenSearchForm />
      </Card>
    </FounderShell>
  );
}
