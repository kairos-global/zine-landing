import { redirect } from "next/navigation";

export default async function LegacyFlipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/issues/${encodeURIComponent(slug)}`);
}
