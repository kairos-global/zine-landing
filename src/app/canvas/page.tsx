import { redirect } from "next/navigation";

export default async function CanvasPage({ searchParams }: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  redirect(id ? `/zinemat?mode=create&id=${encodeURIComponent(id)}` : "/zinemat?mode=create");
}
