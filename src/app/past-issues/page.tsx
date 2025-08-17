// app/past-issues/page.tsx
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

type Issue = {
  slug: string;
  title: string;
  published_at: string | null;
  cover_img_url: string | null; // ⬅️ using full URL now
};

export default async function PastIssues() {
  const { data, error } = await supabase
    .from("issues")
    .select("slug,title,published_at,cover_img_url") // ⬅️ cover_url not cover_path
    .order("published_at", { ascending: false });

  if (error) return <div className="p-6">Failed to load issues.</div>;
  const issues = (data ?? []) as Issue[];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Past Issues</h1>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {issues.map((i) => (
          <Link key={i.slug} href={`/issues/${i.slug}`} className="group overflow-hidden rounded-xl border">
            <div className="aspect-[3/4] w-full bg-neutral-100">
              {i.cover_img_url && (
                <Image
                  src={i.cover_img_url}
                  alt={i.title}
                  width={300}
                  height={400}
                  className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
              )}
            </div>
            <div className="p-3">
              <div className="text-sm opacity-60">
                {i.published_at ? new Date(i.published_at).toLocaleDateString() : "Unpublished"}
              </div>
              <div className="font-medium">{i.title}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
