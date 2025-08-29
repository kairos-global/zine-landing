// src/app/make-zine/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

/** ---------- Types (match your tables) ---------- */
type Issue = {
  id: string;
  title: string | null;
  slug: string | null;
  cover_img_url: string | null;
  pdf_url: string | null;
  status: string | null;          // 'draft' | 'published' | etc
  published_at: string | null;    // ISO date string
};

type Feature = { id: number; name: string | null; url: string | null };
type Advertiser = { id: number; name: string | null; website: string | null };
type Distributor = { id: number; name: string | null; website: string | null };

type RedirectLink = {
  id: string;
  label: string | null;
  slug: string | null;
  target_url: string | null;
  source_kind: "feature" | "event" | "advertiser" | "distributor";
  source_id: number;
};

/** ---------- Supabase (browser) ---------- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true } }
);

/** ---------- Page ---------- */
export default function MakeZinePage() {
  const router = useRouter();
  const params = useSearchParams();
  const presetTitle = params.get("title") ?? "";

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // issue (null until you click "Create draft")
  const [issue, setIssue] = useState<Issue | null>(null);

  // A) Basics (local state before saving)
  const [title, setTitle] = useState(presetTitle);
  const [slug, setSlug] = useState("");
  const [date, setDate] = useState<string>(""); // yyyy-mm-dd

  // B) mini form inputs
  const [featureName, setFeatureName] = useState("");
  const [featureUrl, setFeatureUrl] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [advertiserWebsite, setAdvertiserWebsite] = useState("");
  const [distributorName, setDistributorName] = useState("");
  const [distributorWebsite, setDistributorWebsite] = useState("");

  // B) lists
  const [features, setFeatures] = useState<Feature[]>([]);
  const [events, setEvents] = useState<Feature[]>([]);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);

  // C) redirects
  const [redirects, setRedirects] = useState<RedirectLink[]>([]);
  const [qrLoading, setQrLoading] = useState(false);

  // D) uploads
  const [coverUploading, setCoverUploading] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);

  /** ---------- Auth (for gating publish) ---------- */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      setLoadingAuth(false);
    })();
  }, []);

  /** ---------- Helpers ---------- */
  const draftExists = Boolean(issue?.id);

  async function refreshLists() {
    if (!issue) return;
    const [f, e, a, d, r] = await Promise.all([
      supabase.from("features").select("id,name,url").eq("issue_id", issue.id).is("type", null),
      supabase.from("features").select("id,name,url").eq("issue_id", issue.id).eq("type", "event"),
      supabase.from("advertisers").select("id,name,website").eq("issue_id", issue.id),
      supabase.from("distributors").select("id,name,website").eq("issue_id", issue.id),
      supabase.from("redirect_links")
        .select("id,label,slug,target_url,source_kind,source_id")
        .eq("issue_id", issue.id),
    ]);

    if (!f.error) setFeatures((f.data ?? []) as Feature[]);
    if (!e.error) setEvents((e.data ?? []) as Feature[]);
    if (!a.error) setAdvertisers((a.data ?? []) as Advertiser[]);
    if (!d.error) setDistributors((d.data ?? []) as Distributor[]);
    if (!r.error) setRedirects((r.data ?? []) as RedirectLink[]);
  }

  /** ---------- Create draft (A) ---------- */
  async function createDraft() {
    if (!title.trim()) return alert("Please add a title.");
    const reserveSlug = slug.trim() || `issue-${Date.now().toString().slice(-6)}`;

    const { data, error } = await supabase
      .from("issues")
      .insert({
        title: title.trim(),
        slug: reserveSlug,
        status: "draft",
        published_at: date || null,
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return alert("Could not create draft.");
    }

    setIssue(data as Issue);
    setSlug(data.slug ?? reserveSlug);
    refreshLists();
  }

  /** ---------- Save basics ---------- */
  async function saveBasics() {
    if (!issue) return;
    const { data, error } = await supabase
      .from("issues")
      .update({
        title: title.trim(),
        slug: slug.trim(),
        published_at: date || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", issue.id)
      .select("*")
      .single();
    if (error) {
      console.error(error);
      return alert("Failed saving basics.");
    }
    setIssue(data as Issue);
    alert("Basics saved.");
  }

  /** ---------- B) add items ---------- */
  async function addFeature() {
    if (!issue) return alert("Create a draft first.");
    if (!featureName.trim() || !featureUrl.trim()) return;
    const { error } = await supabase.from("features").insert({
      issue_id: issue.id,
      name: featureName.trim(),
      url: featureUrl.trim(),
    });
    if (error) console.error(error);
    setFeatureName(""); setFeatureUrl("");
    refreshLists();
  }

  async function addEvent() {
    if (!issue) return alert("Create a draft first.");
    if (!eventName.trim() || !eventUrl.trim()) return;
    const { error } = await supabase.from("features").insert({
      issue_id: issue.id,
      name: eventName.trim(),
      url: eventUrl.trim(),
      type: "event",
    });
    if (error) console.error(error);
    setEventName(""); setEventUrl("");
    refreshLists();
  }

  async function addAdvertiser() {
    if (!issue) return alert("Create a draft first.");
    if (!advertiserName.trim() || !advertiserWebsite.trim()) return;
    const { error } = await supabase.from("advertisers").insert({
      issue_id: issue.id,
      name: advertiserName.trim(),
      website: advertiserWebsite.trim(),
    });
    if (error) console.error(error);
    setAdvertiserName(""); setAdvertiserWebsite("");
    refreshLists();
  }

  async function addDistributor() {
    if (!issue) return alert("Create a draft first.");
    if (!distributorName.trim() || !distributorWebsite.trim()) return;
    const { error } = await supabase.from("distributors").insert({
      issue_id: issue.id,
      name: distributorName.trim(),
      website: distributorWebsite.trim(),
      active: true,
    });
    if (error) console.error(error);
    setDistributorName(""); setDistributorWebsite("");
    refreshLists();
  }

  /** ---------- C) redirects ---------- */
  async function generateRedirects() {
    if (!issue) return alert("Create a draft first.");
    setQrLoading(true);
    const { error } = await supabase.rpc("generate_missing_redirects_for_issue", {
      p_issue_id: issue.id,
    });
    if (error) console.error(error);
    await refreshLists();
    setQrLoading(false);
  }

  /** ---------- D) uploads ---------- */
  async function uploadCover(file: File) {
    if (!issue) return alert("Create a draft first.");
    setCoverUploading(true);
    const path = `issues/${issue.id}/cover-${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage.from("zine-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      console.error(error);
      setCoverUploading(false);
      return alert("Cover upload failed.");
    }
    const { data: url } = supabase.storage.from("zine-assets").getPublicUrl(data.path);
    const { error: updErr, data: updated } = await supabase
      .from("issues")
      .update({ cover_img_url: url.publicUrl })
      .eq("id", issue.id)
      .select("*")
      .single();
    if (updErr) console.error(updErr);
    setIssue(updated as Issue);
    setCoverUploading(false);
  }

  async function uploadPdf(file: File) {
    if (!issue) return alert("Create a draft first.");
    setPdfUploading(true);
    const path = `issues/${issue.id}/zine-${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage.from("zine-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      console.error(error);
      setPdfUploading(false);
      return alert("PDF upload failed.");
    }
    const { data: url } = supabase.storage.from("zine-assets").getPublicUrl(data.path);
    const { error: updErr, data: updated } = await supabase
      .from("issues")
      .update({ pdf_url: url.publicUrl })
      .eq("id", issue.id)
      .select("*")
      .single();
    if (updErr) console.error(updErr);
    setIssue(updated as Issue);
    setPdfUploading(false);
  }

  /** ---------- Save + Publish ---------- */
  async function saveDraftAndExit() {
    if (!issue) {
      await createDraft();
    } else {
      await saveBasics();
    }
    router.push("/past-issues");
  }

  async function publish() {
    if (!issue) return alert("Create a draft first.");
    if (loadingAuth) return;
    if (!userId) return alert("Create an account to publish.");

    const ready = publishEnabled;
    if (!ready) return alert("Complete the checklist before publishing.");

    await saveBasics();

    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("issues")
      .update({
        status: "published",
        published_at: date || today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", issue.id);

    if (error) {
      console.error(error);
      return alert("Publish failed.");
    }
    alert("Published!");
    router.push("/past-issues");
  }

  /** ---------- Checklist ---------- */
  const totalCards = features.length + events.length + advertisers.length + distributors.length;

  const checklist = useMemo(() => {
    const A = title.trim().length > 0 && (slug.trim().length > 0 || !draftExists);
    const D = Boolean(issue?.cover_img_url) && Boolean(issue?.pdf_url);
    const C = totalCards === 0 || redirects.length > 0;
    return { A, B: true, C, D };
  }, [title, slug, draftExists, issue, totalCards, redirects.length]);

  const publishEnabled = checklist.A && checklist.C && checklist.D;

  /** ---------- UI ---------- */
  return (
    <div className="bg-[#F0EBCC] min-h-screen">
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-12">
        {/* Header */}
        <header className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
          <h1 className="font-semibold text-xl sm:text-2xl text-black">Start your Zine</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/past-issues")}
              className="rounded-xl border px-3 py-1 text-sm hover:bg-white text-black"
            >
              Close
            </button>
            <button
              onClick={saveDraftAndExit}
              className="rounded-xl border px-3 py-1 text-sm hover:bg-white text-black"
            >
              Save draft
            </button>
            <button
              onClick={publish}
              disabled={!publishEnabled || !draftExists}
              title={!draftExists ? "Create draft first" : publishEnabled ? "Publish" : "Complete checklist"}
              className={`rounded-xl px-3 py-1 text-sm font-medium ${
                publishEnabled && draftExists
                  ? "bg-[#65CBF1] text-black hover:brightness-95"
                  : "bg-gray-300 text-gray-600"
              }`}
            >
              Publish
            </button>
          </div>
        </header>

        {/* A. Basics */}
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 font-semibold text-black">A. Issue Basics</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-black">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Issue title"
                className="w-full rounded-xl border px-3 py-2 text-black placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-black">Slug (Issue no.)</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={issue?.slug ?? "issue-001"}
                className="w-full rounded-xl border px-3 py-2 text-black placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-black">Date (optional)</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-black placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>

            <div className="flex items-end gap-2">
              {!draftExists ? (
                <button
                  onClick={createDraft}
                  className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white"
                >
                  Create draft
                </button>
              ) : (
                <button
                  onClick={saveBasics}
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 text-black"
                >
                  Save basics
                </button>
              )}
              {issue?.slug && (
                <span className="text-xs text-gray-600">
                  ID: {issue.id.slice(0, 8)}… • slug: {issue.slug}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* B. Board */}
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="mb-4 font-semibold text-black">B. Features / Events / Advertisers / Distributors</h2>
          {!draftExists && (
            <p className="mb-3 text-sm text-gray-700">
              Create a draft to enable these forms.
            </p>
          )}
          <div
            className={`grid gap-4 md:grid-cols-2 xl:grid-cols-4 ${
              !draftExists ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            <BoardCard
              title="Features"
              accent="#65CBF1"
              items={features.map(f => ({ id: f.id, name: f.name, url: f.url }))}
              form={
                <>
                  <Input placeholder="Name" value={featureName} onChange={setFeatureName} />
                  <Input placeholder="https://link" value={featureUrl} onChange={setFeatureUrl} />
                  <AddButton onClick={addFeature} />
                </>
              }
            />
            <BoardCard
              title="Events"
              accent="#F2DC6F"
              items={events.map(f => ({ id: f.id, name: f.name, url: f.url }))}
              form={
                <>
                  <Input placeholder="Name" value={eventName} onChange={setEventName} />
                  <Input placeholder="https://event" value={eventUrl} onChange={setEventUrl} />
                  <AddButton onClick={addEvent} />
                </>
              }
            />
            <BoardCard
              title="Advertisers"
              accent="#82E385"
              items={advertisers.map(a => ({ id: a.id, name: a.name, url: a.website }))}
              form={
                <>
                  <Input placeholder="Business name" value={advertiserName} onChange={setAdvertiserName} />
                  <Input placeholder="https://website" value={advertiserWebsite} onChange={setAdvertiserWebsite} />
                  <AddButton onClick={addAdvertiser} />
                </>
              }
            />
            <BoardCard
              title="Distributors"
              accent="#D16FF2"
              items={distributors.map(d => ({ id: d.id, name: d.name, url: d.website }))}
              form={
                <>
                  <Input placeholder="Location name" value={distributorName} onChange={setDistributorName} />
                  <Input placeholder="https://website" value={distributorWebsite} onChange={setDistributorWebsite} />
                  <AddButton onClick={addDistributor} />
                </>
              }
            />
          </div>
        </section>

        {/* C. QR */}
        <section className="rounded-2xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-black">C. QR & Links</h2>
            <button
              disabled={!draftExists || qrLoading}
              onClick={generateRedirects}
              className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 text-black"
            >
              {qrLoading ? "Generating…" : "Generate missing"}
            </button>
          </div>

          {!draftExists ? (
            <p className="text-sm text-gray-700">Create a draft to generate shortlinks.</p>
          ) : redirects.length === 0 ? (
            <p className="text-sm text-gray-700">No redirects yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {redirects.map((r) => {
                const short = `${window.location.origin}/r/${r.slug}`;
                return (
                  <div key={r.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-black">{r.label}</span>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-black/70">
                        {r.source_kind}
                      </span>
                    </div>
                    <div className="mt-2 text-xs break-all text-black">
                      <span className="font-medium">Shortlink:</span>{" "}
                      <Link href={`/r/${r.slug!}`} className="underline">
                        {short}
                      </Link>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <img
                        alt="qr"
                        className="h-28 w-28 rounded-md border"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(short)}`}
                      />
                      <div className="text-xs text-gray-700">
                        <div className="truncate">
                          <span className="font-medium">Dest:</span> {r.target_url}
                        </div>
                        <button
                          className="mt-2 rounded-md border px-2 py-1 text-black"
                          onClick={() => navigator.clipboard.writeText(short)}
                        >
                          Copy shortlink
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* D. Files */}
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 font-semibold text-black">D. Files</h2>
          {!draftExists && (
            <p className="mb-3 text-sm text-gray-700">
              Create a draft to upload cover & PDF.
            </p>
          )}
          <div className={`grid gap-4 md:grid-cols-2 ${!draftExists ? "opacity-60 pointer-events-none" : ""}`}>
            <div className="rounded-xl border p-3">
              <div className="mb-2 text-sm font-medium text-black">Cover image (jpg/png)</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])}
                className="text-black"
              />
              <div className="mt-2 text-xs text-gray-700">
                {coverUploading ? "Uploading…" : issue?.cover_img_url ? (
                  <Link href={issue.cover_img_url} className="underline" target="_blank">
                    Preview cover
                  </Link>
                ) : (
                  "No cover uploaded"
                )}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="mb-2 text-sm font-medium text-black">Zine PDF</div>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])}
                className="text-black"
              />
              <div className="mt-2 text-xs text-gray-700">
                {pdfUploading ? "Uploading…" : issue?.pdf_url ? (
                  <Link href={issue.pdf_url} className="underline" target="_blank">
                    Open PDF
                  </Link>
                ) : (
                  "No PDF uploaded"
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Checklist */}
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 font-semibold text-black">Publish checklist</h2>
          <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            {([
              ["A. Basics", checklist.A],
              ["B. Entries (optional v1)", true],
              ["C. QR (or no entries)", checklist.C],
              ["D. Files", checklist.D],
            ] as const).map(([label, ok]) => (
              <li
                key={label}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  ok ? "bg-green-50 border-green-200 text-black" : "bg-yellow-50 border-yellow-200 text-black"
                }`}
              >
                {ok ? "✓" : "•"} {label}
              </li>
            ))}
          </ul>
        </section>

        <div className="h-2" />
      </div>
    </div>
  );
}

/** ---------- Small UI helpers ---------- */
function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="w-full rounded-lg border px-3 py-2 text-black placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-black/10"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-black px-3 py-2 text-sm text-white"
    >
      Add
    </button>
  );
}

function BoardCard({
  title,
  accent,
  items,
  form,
}: {
  title: string;
  accent: string;
  items: { id: number; name: string | null; url: string | null }[];
  form: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border">
      <div
        className="rounded-t-2xl border-b px-3 py-2 text-sm font-semibold text-black"
        style={{ background: accent + "22", borderColor: accent + "55" }}
      >
        {title}
      </div>
      <div className="space-y-3 p-3">
        <div className="space-y-2">{form}</div>
        <div className="h-px w-full bg-gray-200" />
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="text-sm text-gray-700">No items yet</div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="rounded-lg border p-2 text-sm">
                <div className="font-medium text-black">{it.name}</div>
                {it.url ? (
                  <a className="truncate text-xs underline" href={it.url} target="_blank">
                    {it.url}
                  </a>
                ) : (
                  <div className="text-xs text-gray-700">No link</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
