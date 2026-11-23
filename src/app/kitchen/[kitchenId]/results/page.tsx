import { getKitchenById } from "@/server/actions/kitchen";
import { KitchenResultsDashboard } from "@/components/kitchen/KitchenResultsDashboard";
import { notFound } from "next/navigation";
import { KitchenShell } from "@/components/layout/KitchenShell";

type Props = {
  params: Promise<{ kitchenId: string }>;
};

export default async function KitchenResultsPage({ params }: Props) {
  const { kitchenId } = await params;
  const res = await getKitchenById(kitchenId);

  if (!res.success) {
    notFound();
  }

  const kitchen = res.data;

  return (
    <KitchenShell
      kitchenId={kitchenId}
      kitchenName={kitchen.name}
      title="Station Results & Metrics"
      subtitle={`Detailed service performance, leftovers, and operational audit trail for ${kitchen.name}`}
    >
      <KitchenResultsDashboard kitchenId={kitchenId} />
    </KitchenShell>
  );
}
