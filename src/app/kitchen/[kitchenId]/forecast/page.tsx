import { getKitchenById } from "@/server/actions/kitchen";
import { ForecastPanel } from "@/components/kitchen/ForecastPanel";
import { notFound } from "next/navigation";
import { KitchenShell } from "@/components/layout/KitchenShell";

type Props = {
  params: Promise<{ kitchenId: string }>;
};

export default async function ForecastPage({ params }: Props) {
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
      title="Forecast & Model Learning"
      subtitle={`Analyze historical service data quality and preview pure baseline projections for ${kitchen.name}`}
    >
      <ForecastPanel kitchenId={kitchenId} />
    </KitchenShell>
  );
}
