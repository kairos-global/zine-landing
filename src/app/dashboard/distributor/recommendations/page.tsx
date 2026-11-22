import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { zineDb } from "@/lib/zine-reader-server";

type Recommendation = { issue_id: string; issue: { title: string | null; slug: string | null } };

export default async function RecommendationsPage() {
  const { userId } = await auth();
  if (!userId) notFound();
  const { data: distributor, error: shopError } = await zineDb.from("distributors").select("id")
    .eq("user_id", userId).eq("status", "approved").maybeSingle();
  if (shopError) throw shopError;
  if (!distributor) notFound();

  const { data, error } = await zineDb.from("zine_recommendations")
    .select("issue_id, issue:issues!inner(title,slug)")
    .eq("distributor_id", distributor.id).eq("issue.status", "published")
    .order("created_at", { ascending: false }).returns<Recommendation[]>();
  if (error) throw error;
  const grouped = new Map<string, { title: string; slug: string; count: number }>();
  for (const { issue_id, issue } of data) {
    if (!issue.slug) continue;
    const current = grouped.get(issue_id);
    if (current) current.count += 1;
    else grouped.set(issue_id, { title: issue.title || "Untitled zine", slug: issue.slug, count: 1 });
  }
  const issues = [...grouped.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/dashboard/distributor" className="mb-4 inline-block underline">Back to Distributor Portal</Link>
      <h1 className="text-2xl font-semibold">Reader recommendations</h1>
      {issues.length ? <ul className="mt-4 divide-y rounded-xl border">
        {issues.map(issue => <li key={issue.slug} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <Link className="font-medium underline" href={`/issues/${encodeURIComponent(issue.slug)}`}>{issue.title}</Link>
          <span className="text-sm text-neutral-600">{issue.count} {issue.count === 1 ? "reader" : "readers"}</span>
        </li>)}
      </ul> : <p className="mt-4 text-neutral-600">No reader recommendations yet.</p>}
    </main>
  );
}
