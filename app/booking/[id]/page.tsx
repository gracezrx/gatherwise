import BookingStatus from "@/components/BookingStatus";

export default async function BookingPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingStatus requestId={id} />;
}
