import PlanReview from "@/components/PlanReview";

export default async function PlansPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlanReview requestId={id} />;
}
