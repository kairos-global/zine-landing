// src/app/make-zine/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

type Issue = {
  id: string;
  title: string | null;
  slug: string | null;
  pdf_url: string | null;
  cover_img_url: string | null;
  status?: "draft" | "published";
};

type Feature = {
  id: number;
  name: string | null;
  url: string | null;
  type: string | null;
  lat: number | null;
  lng: number | null;
  issue_id: string | null;
};

type Advertiser = {
  id: number;
  name: string | null;
  website: string | null;
  issue_id: string | null;
};

type Distributor = {
  id: number;
  name: string | null;
  website: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  issue_id: string | null;
};

export default function MakeZine() {
  const router = useRouter();
  const search = useSearchParams();
  const issueIdParam = search.get("id") || "";

  const [issue, setIssue] = useState<Issue | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [events, setEvents] = useState<Feature[]>([]);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);

  // Create or resume draft
  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      if (issueIdParam) {
        const { data } = await supabase.from("issues").select("*").eq("id", issueIdParam).maybeSingle();
        if (!stop && data) setIssue(data as Issue);
      } else {
        const { data } = await supabase
          .from("issues")
          .insert([{ title: "Untitled Zine", status: "draft" }])
          .select("*")
          .single();
        if (!stop && data) {
          setIssue(data as Issue);
          router.replace(`/make-zine?id=${data.id}`, { scroll: false });
        }
      }
      setLoading(false);
    })();
    return () => {
      stop = true;
    };
  }, [issueIdParam, router]);

  // Load children when we have issue id
  useEffect(() => {
    if (!issue?.id) return;
    let stop = false;
    (async () => {
      const [f, ev, a, d] = await Promise.all([
        supabase.from("features").select("*").eq("issue_id", issue.id).is("type", null),
        supabase.from("features").select("*").eq("issue_id", issue.id).eq("type", "event"),
        supabase.from("advertisers").select("*").eq("issue_id", issue.id),
        supabase.from("distributors").select("*").eq("issue_id", issue.id),
      ]);
      if (!stop) {
        setFeatures((f.data as any[]) ?? []);
        setEvents((ev.data as any[]) ?? []);
        setAdvertisers((a.data as any[]) ?? []);
        setDistributors((d.data as any[]) ?? []);
      }
    })();
    return () => {
      stop = true;
    };
  }, [issue?.id]);

  if (loading || !issue) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="rounded-xl border p-4">Preparing your draft…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Make a Zine</h1>
        <a
          href={`/issues/${issue.slug || issue.id}`}
          className="rounded-md border-2 border-black bg-white px-3 py-1"
        >
          View issue
        </a>
      </div>

      {/* Issue Basics */}
      <section className="rounded-2xl border-4 border-black bg-[#F0EBCC] p-4">
        <h2 className="mb-3 text-lg font-semibold">Issue basics</h2>
        <IssueBasicsForm issue={issue} onSaved={setIssue} />
      </section>

      {/* Kanban (4 columns) */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BoardColumn
          title="Features"
          color="#65CBF1"
          items={features}
          onAdd={async () => {
            const { data } = await supabase
              .from("features")
              .insert([{ issue_id: issue.id, name: "", url: "", lat: null, lng: null }])
              .select("*")
              .single();
            if (data) setFeatures((p) => [data as any, ...p]);
          }}
          onChange={async (row, patch) => {
            await supabase.from("features").update(patch).eq("id", row.id);
            setFeatures((p) => p.map((x) => (x.id === row.id ? { ...x, ...patch } : x)));
          }}
          onRemove={async (row) => {
            await supabase.from("features").delete().eq("id", row.id);
            setFeatures((p) => p.filter((x) => x.id !== row.id));
          }}
        />

        <BoardColumn
          title="Events"
          color="#65CBF1"
          items={events}
          onAdd={async () => {
            const { data } = await supabase
              .from("features")
              .insert([{ issue_id: issue.id, name: "", url: "", type: "event" }])
              .select("*")
              .single();
            if (data) setEvents((p) => [data as any, ...p]);
          }}
          onChange={async (row, patch) => {
            await supabase.from("features").update(patch).eq("id", row.id);
            setEvents((p) => p.map((x) => (x.id === row.id ? { ...x, ...patch } : x)));
          }}
          onRemove={async (row) => {
            await supabase.from("features").delete().eq("id", row.id);
            setEvents((p) => p.filter((x) => x.id !== row.id));
          }}
        />

        <BoardColumn
          title="Advertisers"
          color="#D16FF2"
          items={advertisers}
          onAdd={async () => {
            const { data } = await supabase
              .from("advertisers")
              .insert([{ issue_id: issue.id, name: "", website: "" }])
              .select("*")
              .single();
            if (data) setAdvertisers((p) => [data as any, ...p]);
          }}
          onChange={async (row: any, patch: Partial<Advertiser>) => {
            await supabase.from("advertisers").update(patch).eq("id", row.id);
            setAdvertisers((p) => p.map((x) => (x.id === row.id ? { ...x, ...patch } : x)));
          }}
          onRemove={async (row: any) => {
            await supabase.from("advertisers").delete().eq("id", row.id);
            setAdvertisers((p) => p.filter((x) => x.id !== row.id));
          }}
        />

        <BoardColumn
          title="Distributors"
          color="#D16FF2"
          items={distributors}
          onAdd={async () => {
            const { data } = await supabase
              .from("distributors")
              .insert([{ issue_id: issue.id, name: "", website: "" }])
              .select("*")
              .single();
            if (data) setDistributors((p) => [data as any, ...p]);
          }}
          onChange={async (row: any, patch: Partial<Distributor>) => {
            await supabase.from("distributors").update(patch).eq("id", row.id);
            setDistributors((p) => p.map((x) => (x.id === row.id ? { ...x, ...patch } : x)));
          }}
          onRemove={async (row: any) => {
            await supabase.from("distributors").delete().eq("id", row.id);
            setDistributors((p) => p.filter((x) => x.id !== row.id));
          }}
        />
      </section>
    </main>
  );
}

/* ---------- Basics form ---------- */
function IssueBasicsForm({
  issue,
  onSaved,
}: {
  issue: Issue;
  onSaved: (i: Issue) => void;
}) {
  async function onSubmit(form: FormData) {
    const patch = {
      title: String(form.get("title") || ""),
      slug: (String(form.get("slug") || "") || null) as string | null,
      pdf_url: (String(form.get("pdf_url") || "") || null) as string | null,
      cover_img_url: (String(form.get("cover_img_url") || "") || null) as string | null,
    };
    await supabase.from("issues").update(patch).eq("id", issue.id);
    onSaved({ ...issue, ...patch });
  }

  return (
    <form
      action={async (fd) => onSubmit(fd)}
      className="grid gap-3 sm:grid-cols-2"
    >
      <label className="grid gap-1">
        <span className="text-sm opacity-70">Title</span>
        <input name="title" defaultValue={issue.title ?? ""} className="rounded-md border px-3 py-2" />
      </label>
      <label className="grid gap-1">
        <span className="text-sm opacity-70">Slug</span>
        <input name="slug" defaultValue={issue.slug ?? ""} className="rounded-md border px-3 py-2" />
      </label>
      <label className="grid gap-1">
        <span className="text-sm opacity-70">PDF URL</span>
        <input name="pdf_url" defaultValue={issue.pdf_url ?? ""} className="rounded-md border px-3 py-2" />
      </label>
      <label className="grid gap-1">
        <span className="text-sm opacity-70">Cover Image URL</span>
        <input name="cover_img_url" defaultValue={issue.cover_img_url ?? ""} className="rounded-md border px-3 py-2" />
      </label>
      <div className="col-span-full">
        <button className="rounded-md border-2 border-black bg-white px-3 py-2">Save basics</button>
      </div>
    </form>
  );
}

/* ---------- Reusable Column ---------- */
function BoardColumn({
  title,
  color,
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  title: string;
  color: string; // header color strip
  items: any[];
  onAdd: () => Promise<void>;
  onChange: (row: any, patch: any) => Promise<void>;
  onRemove: (row: any) => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border-4 border-black bg-white">
      <div
        className="rounded-t-xl border-b-4 border-black px-4 py-2 font-semibold"
        style={{ background: color }}
      >
        {title}
      </div>
      <div className="p-3 space-y-3">
        <button
          onClick={onAdd}
          className="rounded-md border-2 border-black bg-[#F0EBCC] px-3 py-1 text-sm"
        >
          + Add
        </button>

        {items.map((it) => (
          <div key={it.id} className="rounded-md border p-3 grid gap-2">
            {/* Name / Title */}
            <input
              className="rounded border px-2 py-1"
              placeholder="Name / Title"
              defaultValue={it.name ?? ""}
              onBlur={(e) => onChange(it, { name: e.target.value })}
            />
            {/* Link */}
            {"website" in it || "url" in it ? (
              <input
                className="rounded border px-2 py-1"
                placeholder="Link (URL)"
                defaultValue={(it.website ?? it.url) ?? ""}
                onBlur={(e) =>
                  onChange(it, "website" in it ? { website: e.target.value } : { url: e.target.value })
                }
              />
            ) : null}
            {/* Optional coords */}
            {"lat" in it && "lng" in it ? (
              <div className="flex gap-2">
                <input
                  className="rounded border px-2 py-1 w-1/2"
                  placeholder="Lat"
                  defaultValue={it.lat ?? ""}
                  onBlur={(e) => onChange(it, { lat: Number(e.target.value) || null })}
                />
                <input
                  className="rounded border px-2 py-1 w-1/2"
                  placeholder="Lng"
                  defaultValue={it.lng ?? ""}
                  onBlur={(e) => onChange(it, { lng: Number(e.target.value) || null })}
                />
              </div>
            ) : null}
            {/* For Events only, allow type switch */}
            {"type" in it ? (
              <div className="flex items-center gap-2">
                <label className="text-sm">Type</label>
                <select
                  defaultValue={it.type ?? "event"}
                  onChange={(e) => onChange(it, { type: e.target.value || null })}
                  className="rounded border px-2 py-1"
                >
                  <option value="">Feature</option>
                  <option value="event">Event</option>
                </select>
              </div>
            ) : null}
            <button
              onClick={() => onRemove(it)}
              className="justify-self-start rounded-md border px-3 py-1 text-sm hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
