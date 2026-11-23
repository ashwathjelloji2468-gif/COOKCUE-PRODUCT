import { getKitchenById } from "@/server/actions/kitchen";
import { getKitchenOnboardingProgress } from "@/server/actions/kitchen-onboarding";
import { MorningPlanForm } from "@/components/kitchen/MorningPlanForm";
import { KitchenOnboardingWizard } from "@/components/kitchen/KitchenOnboardingWizard";
import { notFound } from "next/navigation";
import { KitchenShell } from "@/components/layout/KitchenShell";

type Props = {
  params: Promise<{ kitchenId: string }>;
};

export default async function MorningPlanPage({ params }: Props) {
  const { kitchenId } = await params;
  const [res, onboardingRes] = await Promise.all([
    getKitchenById(kitchenId),
    getKitchenOnboardingProgress(kitchenId),
  ]);

  if (!res.success) {
    notFound();
  }

  const kitchen = res.data;
  const onboardingProgress = onboardingRes.success ? onboardingRes.data : null;

  return (
    <KitchenShell
      kitchenId={kitchenId}
      kitchenName={kitchen.name}
      title="Morning Cooking Plan"
      subtitle={`Generate data-driven baseline recommendations and approve today's production for ${kitchen.name}`}
    >
      {onboardingProgress && (
        <KitchenOnboardingWizard progress={onboardingProgress} kitchenId={kitchenId} />
      )}
      <MorningPlanForm kitchenId={kitchenId} />
    </KitchenShell>
  );
}
