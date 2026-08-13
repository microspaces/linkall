import { redirect } from "next/navigation";

export default async function PerformanceScreenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/locos/comedy-loco/performance/screens/${id}`);
}
