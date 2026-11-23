import { getIndent } from "@/server/actions/indents";
import { IndentDetailClient } from "@/components/kitchen/IndentDetailClient";
import { notFound, redirect } from "next/navigation";
import { KitchenShell } from "@/components/layout/KitchenShell";

type Props = {
  params: Promise<{ kitchenId: string; indentId: string }>;
};

export default async function IndentDetailPage({ params }: Props) {
  const { kitchenId, indentId } = await params;

  const res = await getIndent(kitchenId, indentId);
  if (!res.success) {
    if (res.error.includes("not found")) {
      notFound();
    }
    redirect("/login");
  }

  const indent = res.data;

  return (
    <KitchenShell
      kitchenId={kitchenId}
      kitchenName={indent.kitchenName}
      title={`${indent.mealType} Purchase Indent`}
      subtitle={`Material demand list for service date ${indent.date} at ${indent.kitchenName}`}
    >
      <IndentDetailClient kitchenId={kitchenId} initialIndent={indent} />
    </KitchenShell>
  );
}
