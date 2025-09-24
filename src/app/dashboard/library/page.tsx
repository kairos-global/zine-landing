// src/app/dashboard/library/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useUser } from "@clerk/nextjs";

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
  created_at: string | null;
  profile_id: string | null;
};

export default function LibraryPage() {
  const { user } = useUser();
  const [drafts, setDrafts] = useState<Issue[]>([]);
  const [published, setPublished] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    (async () => {
      console.log("👉 Clerk user.id:", user.id);

      // 1. Look up profile row for this Clerk user
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_id", user.id)
        .single();

      if (profileError || !profile) {
        console.error("Profile not found:", profileError);
        setLoading(false);
        return;
      }

      console.log("👉 Found profile:", profile);

      // 2. Fetch issues tied to that profile_id
      const { data: issues, error } = await supabase
        .from("issues")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase error:", error);
        setLoading(false);
        return;
      }

      console.log("👉 Issues returned from Supabase:", issues);

      setDrafts((issues || []).filter((i) => i.status?.toLowerCase() === "draft"));
      setPublished((issues || []).filter((i) => i.status?.toLowerCase() === "published"));
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">My Library</h1>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <>
          {/* Drafts Section */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4">Drafts</h2>
            {drafts.length === 0 ? (
              <p className="text-sm text-gray-500">No drafts yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {drafts.map((it) => (
                  <div key={it.id} className="rounded-xl border bg-white p-3 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                        Draft
                      </div>
                      <span className="text-xs text-gray-400">
                        {it.created_at ? new Date(it.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <div className="font-semibold mb-2">{it.title || "(untitled)"}</div>
                    {it.cover_img_url && (
                      <img
                        src={it.cover_img_url}
                        className="mb-3 w-full aspect-[3/4] object-cover rounded-md border"
                      />
                    )}
                    <div className="mt-auto flex gap-2">
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
          </section>

          {/* Published Section */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Published</h2>
            {published.length === 0 ? (
              <p className="text-sm text-gray-500">No published issues yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {published.map((it) => (
                  <div key={it.id} className="rounded-xl border bg-white p-3 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                        Published
                      </div>
                      <span className="text-xs text-gray-400">
                        {it.published_at ? new Date(it.published_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <div className="font-semibold mb-2">{it.title || "(untitled)"}</div>
                    {it.cover_img_url && (
                      <img
                        src={it.cover_img_url}
                        className="mb-3 w-full aspect-[3/4] object-cover rounded-md border"
                      />
                    )}
                    <div className="mt-auto flex gap-2">
                      {it.slug && (
                        <button
                          onClick={() => router.push(`/issues/${it.slug}`)}
                          className="flex-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          View
                        </button>
                      )}
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
          </section>
        </>
      )}
    </div>
  );
}
