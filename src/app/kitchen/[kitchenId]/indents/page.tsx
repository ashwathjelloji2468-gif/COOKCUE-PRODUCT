import { getKitchenById } from "@/server/actions/kitchen";
import { listIndents } from "@/server/actions/indents";
import { IndentListClient } from "@/components/kitchen/IndentListClient";
import { notFound, redirect } from "next/navigation";
import { KitchenShell } from "@/components/layout/KitchenShell";

type Props = {
  params: Promise<{ kitchenId: string }>;
  searchParams?: Promise<{ date?: string }>;
};

export default async function KitchenIndentsPage({ params, searchParams }: Props) {
  const { kitchenId } = await params;
  const sParams = searchParams ? await searchParams : {};

  const kitchenRes = await getKitchenById(kitchenId);
  if (!kitchenRes.success) {
    notFound();
  }

  const indentsRes = await listIndents(kitchenId, sParams.date);
  if (!indentsRes.success) {
    redirect("/login");
  }

  return (
    <KitchenShell
      kitchenId={kitchenId}
      kitchenName={kitchenRes.data.name}
      title="Purchase Indents"
      subtitle={`Procurement and store material request lists derived from approved cooking plans for ${kitchenRes.data.name}`}
    >
      <IndentListClient kitchenId={kitchenId} indents={indentsRes.data} />
    </KitchenShell>
  );
}
