import { getKitchenById } from "@/server/actions/kitchen";
import { CloseoutForm } from "@/components/kitchen/CloseoutForm";
import { notFound } from "next/navigation";
import { KitchenShell } from "@/components/layout/KitchenShell";

type Props = {
  params: Promise<{ kitchenId: string }>;
};

export default async function CloseoutPage({ params }: Props) {
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
      title="Evening Meal Closeout"
      subtitle={`Record actual production, unserved leftovers, and service exceptions for ${kitchen.name}`}
    >
      <CloseoutForm kitchenId={kitchenId} />
    </KitchenShell>
  );
}
