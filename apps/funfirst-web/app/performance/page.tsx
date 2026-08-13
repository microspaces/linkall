import { redirect } from "next/navigation";

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  redirect(
    id
      ? `/locos/comedy-loco/performance?id=${encodeURIComponent(id)}`
      : "/locos/comedy-loco/performance",
  );
}
