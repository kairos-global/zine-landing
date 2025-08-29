// src/app/dashboard/library/page.tsx
"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    (async () => {
      // TODO: once you add a user_id column, filter with .eq('user_id', userId)
      const { data } = await supabase
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false });
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
            <div key={it.id} className="rounded-xl border bg-white p-3">
              <div className="text-sm text-gray-600 mb-1">
                {it.status === "published" ? "Published" : "Draft"}
              </div>
              <div className="font-semibold">{it.title || "(untitled)"}</div>
              {it.cover_img_url && (
                <img
                  src={it.cover_img_url}
                  className="mt-2 w-full aspect-[3/4] object-cover rounded-md border"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
