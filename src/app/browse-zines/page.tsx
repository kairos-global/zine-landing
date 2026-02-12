import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import MakeZineButton from "./MakeZineButton";

// 🚀 Always fetch fresh data on every request
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export default async function BrowseZines() {
  const { data: issues, error } = await supabase
    .from("issues")
    .select("id, slug, title, published_at, cover_img_url, created_at")
    .eq("status", "published");

  // 🔍 Debug logs
  console.log("✅ Past Issues Query Result:", issues);
  console.log("❌ Past Issues Query Error:", error);

  if (error) {
    console.error("❌ Error fetching issues:", error);
    return (
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl sm:text-3xl font-semibold">Browse zines</h1>
        <p className="mt-4 text-red-600">Error loading issues.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Heading + Button */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-semibold">Browse zines</h1>
        <MakeZineButton />
      </div>

      {issues && issues.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {issues.map((i) => (
            <Link
              key={i.id}
              href={`/issues/${i.slug}`}
              className="group overflow-hidden rounded-xl border bg-white/70"
            >
              <div className="aspect-[3/4] w-full bg-neutral-100">
                {i.cover_img_url ? (
                  <Image
                    src={i.cover_img_url}
                    alt={i.title}
                    width={300}
                    height={400}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-neutral-400">
                    No Cover
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="text-sm opacity-60">
                  {i.published_at
                    ? new Date(i.published_at).toLocaleDateString()
                    : "Unpublished"}
                </div>
                <div className="font-medium">{i.title}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-neutral-500">No published issues yet.</p>
      )}
    </main>
  );
}
