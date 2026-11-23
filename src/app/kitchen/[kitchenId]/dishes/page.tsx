import { getKitchenById } from "@/server/actions/kitchen";
import { DishCatalog } from "@/components/kitchen/DishCatalog";
import { notFound } from "next/navigation";
import { KitchenShell } from "@/components/layout/KitchenShell";

type Props = {
  params: Promise<{ kitchenId: string }>;
};

export default async function DishesPage({ params }: Props) {
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
      title="Station Dish Catalog"
      subtitle={`Configure, maintain, and review active menu items for ${kitchen.name}`}
    >
      <DishCatalog kitchenId={kitchenId} />
    </KitchenShell>
  );
}
