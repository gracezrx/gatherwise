import ConfirmationView from "@/components/ConfirmationView";

export default async function ConfirmationPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConfirmationView requestId={id} />;
}
