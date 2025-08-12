import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

type Issue = {
  id: string;
  slug: string;
  title: string;
  published_at: string | null;
  pdf_url: string | null;         // you kept full URLs
  cover_img_url: string | null;   // you kept full URLs
};

export default async function IssuePage({ params }: { params: { slug: string } }) {
  // 1) Issue
  const { data: issue, error } = await supabase
    .from("issues")
    .select("id,slug,title,published_at,pdf_url,cover_img_url")
    .eq("slug", params.slug)
    .single();

  if (error || !issue) return <div className="p-6">Issue not found.</div>;

  // 2) Links + features count
  const [{ data: links }, { data: features }] = await Promise.all([
    supabase.from("issue_links").select("label,url,sort_order").eq("issue_id", issue.id).order("sort_order"),
    supabase.from("features").select("id").eq("issue_id", issue.id),
  ]);

  const featuresCount = features?.length ?? 0;

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-6 md:grid-cols-[220px_1fr]">
      {/* Sidebar */}
      <aside className="sticky top-6 h-fit space-y-2 rounded-xl border p-3 text-sm">
        <div className="font-medium mb-2">{issue.title}</div>
        <nav className="grid gap-1">
          <a href="#read" className="underline">Digital copy</a>
          <a href="#links" className="underline">Links</a>
          <a href="#locate" className="underline">Find on map</a>
        </nav>
        <hr className="my-2" />
        <Link
          href="/past-issues"
          className="inline-block rounded-md border px-3 py-1 text-sm hover:bg-neutral-800 transition-colors"
        >
          ← Back to all issues
        </Link>
      </aside>

      {/* Content */}
      <section className="space-y-10">
        {/* Read */}
        <div id="read" className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Digital copy</h2>
          {issue.pdf_url ? (
            <>
              <object
                data={issue.pdf_url}
                type="application/pdf"
                className="h-[70vh] w-full rounded-md"
              >
                <a href={issue.pdf_url} target="_blank" className="underline">Open PDF</a>
              </object>
              <div className="mt-2 text-sm opacity-60">
                Published: {issue.published_at ? issue.published_at.slice(0,10) : "—"}
              </div>
            </>
          ) : (
            <p className="text-sm opacity-70">PDF not available.</p>
          )}
        </div>

        {/* Links */}
        <div id="links" className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Links</h2>
          {links?.length ? (
            <div className="flex flex-wrap gap-2">
              {links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" className="rounded-full border px-3 py-1 text-sm">
                  {l.label}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm opacity-70">No links yet.</p>
          )}
        </div>

        {/* Locate */}
        <div id="locate" className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Find on map</h2>
          <p className="mb-3 text-sm opacity-70">{featuresCount} feature pin{featuresCount===1?"":"s"} in this issue.</p>
          <div className="flex gap-2">
            <Link
              href={{ pathname: "/map", query: { view: "features", issue: issue.slug } }}
              className="rounded-md border px-3 py-1 text-sm"
            >
              View this issue’s features
            </Link>
            <Link
              href={{ pathname: "/map", query: { view: "distributors" } }}
              className="rounded-md border px-3 py-1 text-sm"
            >
              Where can I find a copy?
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
