// src/app/dashboard/library/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true } }
);

type Issue = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  cover_img_url: string | null;
  pdf_url: string | null;
  published_at: string | null;
};

export default function LibraryPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) console.error("Supabase error:", error);
      setIssues(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">My Library</h1>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {issues.map((it) => (
            <div
              key={it.id}
              className="rounded-xl border bg-white p-3 flex flex-col"
            >
              <div className="text-sm text-gray-600 mb-1">
                {it.status === "published" ? "Published" : "Draft"}
              </div>
              <div className="font-semibold mb-2">
                {it.title || "(untitled)"}
              </div>
              {it.cover_img_url && (
                <img
                  src={it.cover_img_url}
                  className="mb-3 w-full aspect-[3/4] object-cover rounded-md border"
                />
              )}

              <div className="mt-auto flex gap-2">
                {/* View button */}
                {it.slug && (
                  <button
                    onClick={() => router.push(`/issues/${it.slug}`)}
                    className="flex-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                  >
                    View
                  </button>
                )}
                {/* Edit button */}
                <button
                  onClick={() => router.push(`/zinemat?id=${it.id}`)}
                  className="flex-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
