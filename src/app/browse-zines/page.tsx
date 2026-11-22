import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import ZineCover from "@/components/ZineCover";
import ZineIcon from "@/components/ZineIcon";
import MakeZineButton from "./MakeZineButton";
import styles from "./BrowseZines.module.css";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);
const button = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium";

export default async function BrowseZines() {
  const { data: issues, error } = await supabase
    .from("issues").select("id, slug, title, cover_img_url").eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <main className={`${styles.page} mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Browse zines</h1>
        <MakeZineButton />
      </div>
      {error && <p role="alert" className="text-red-700">Couldn’t load zines.</p>}
      {issues?.length ? (
        <div className={`${styles.issues} grid gap-6 sm:grid-cols-2 md:grid-cols-3`} role="region" aria-label="Published zines" tabIndex={0}>
          {issues.map(issue => {
            const path = `/issues/${encodeURIComponent(issue.slug)}`;
            return (
              <article key={issue.id} className={`${styles.issue} flex flex-col overflow-hidden rounded-xl border bg-white`}>
                <Link href={path} className={`${styles.coverLink} flex-1 hover:underline`}>
                  <ZineCover src={issue.cover_img_url} title={issue.title} className={styles.cover} />
                  <h2 className="p-3 font-medium max-sm:line-clamp-2 max-sm:shrink-0 max-sm:[overflow-wrap:anywhere]">{issue.title || "Untitled zine"}</h2>
                </Link>
                <div className="flex flex-wrap gap-2 border-t border-neutral-200 p-3">
                  <Link href={path} className={`${button} border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800`}>View issue</Link>
                  <Link href={`${path}#locate`} className={`${button} border-neutral-300 hover:bg-neutral-100`}><ZineIcon name="printer" />Find a print copy</Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : !error && <p className="text-neutral-600">No published issues yet.</p>}
    </main>
  );
}
