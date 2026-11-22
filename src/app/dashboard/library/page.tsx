"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import ActionDialog from "@/components/ActionDialog";
import ZineCover from "@/components/ZineCover";
import { qrPngOptions, qrUrl } from "@/lib/zine-qr";
import { IssueQRCode } from "@/app/issues/[slug]/IssueQRCode";

type Zine = { id: string; title: string | null; slug: string; cover_img_url: string | null };
type OwnedZine = Zine & { status: "draft" | "published"; wasPublished: boolean };

const button = "inline-flex min-h-10 items-center justify-center rounded-lg border px-2.5 text-sm font-medium hover:bg-gray-100 disabled:opacity-50";
const shelf = "grid grid-cols-2 gap-3 sm:gap-4";
const tile = "flex min-w-0 flex-col overflow-hidden rounded-xl border border-neutral-300 bg-white";

export default function LibraryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [owned, setOwned] = useState<OwnedZine[]>([]);
  const [collected, setCollected] = useState<Zine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState<OwnedZine | null>(null);
  const [collectionChoice, setCollectionChoice] = useState<"keep" | "remove">("keep");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.replace("/sign-in"); return; }
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void fetch("/api/library", { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t open your library.");
      setOwned(data.issues);
      setCollected(data.collectedIssues);
    }).catch(caught => {
      if (!controller.signal.aborted) setLoadError(caught instanceof Error ? caught.message : "Couldn’t open your library.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [attempt, isLoaded, router, user]);

  function manage(zine: OwnedZine) {
    setError("");
    setCollectionChoice("keep");
    setAction(zine);
  }

  async function apply() {
    if (!action || saving) return;
    const unpublish = action.status === "published";
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/library/${action.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: unpublish ? collectionChoice : "delete" }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Couldn’t update this zine.");
      if (unpublish) setOwned(items => items.map(item => item.id === action.id ? { ...item, status: "draft", wasPublished: true } : item));
      else setOwned(items => items.filter(item => item.id !== action.id));
      if (!unpublish || collectionChoice === "remove") setCollected(items => items.filter(item => item.id !== action.id));
      setAnnouncement(unpublish ? "Zine unpublished." : "Draft permanently deleted.");
      setAction(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t update this zine.");
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded || loading) return <p className="mx-auto max-w-7xl px-4 py-8" role="status">Opening your library…</p>;

  return (
    <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">My Library</h1>
        <Link href="/zinemat" className={`${button} border-blue-700 bg-blue-600 text-white hover:bg-blue-700`}>Create new zine</Link>
      </header>
      {loadError && <p className="mb-3 text-red-800" role="alert">{loadError} <button className="min-h-10 underline" onClick={() => setAttempt(n => n + 1)}>Try again</button></p>}
      {announcement && <p className="mb-3 text-sm text-green-800" role="status">{announcement}</p>}
      {!loadError && <>
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
          {(["draft", "published"] as const).map(status => {
            const zines = owned.filter(item => item.status === status);
            return (
              <section key={status} className="min-w-0 space-y-3">
                <h2 className="text-xl font-semibold">{status === "draft" ? "Saved" : "Published"}</h2>
                {zines.length ? <div className={shelf}>{zines.map(zine => <OwnedCard key={zine.id} zine={zine} manage={manage} />)}</div>
                  : <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">{status === "draft" ? "No drafts yet." : "No published zines yet."}</p>}
              </section>
            );
          })}
        </div>
        {owned.length > 0 && <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Collection QR codes</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {owned.map(zine => <CollectionQrCard key={zine.id} zine={zine} />)}
          </div>
        </section>}
        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Collected</h2>
          {collected.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {collected.map(zine => (
              <Link key={zine.id} href={`/issues/${encodeURIComponent(zine.slug)}`} className={`${tile} hover:border-black hover:underline`}>
                <ZineCover src={zine.cover_img_url} title={zine.title} />
                <h3 className="p-2.5 text-sm font-semibold">{zine.title || "Untitled zine"}</h3>
              </Link>
            ))}
          </div> : <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">Save a zine from its reader to start your collection.</p>}
        </section>
      </>}

      {action && (
        <ActionDialog title={action.status === "published" ? "Unpublish this zine?" : "Delete this draft forever?"} onDismiss={() => setAction(null)} busy={saving}>
          <p className="mt-3 break-words text-sm font-semibold">{action.title || "Untitled zine"}</p>
          {action.status === "published" ? (
            <fieldset disabled={saving} className="mt-3 space-y-2 text-sm">
              <legend className="mb-2 text-neutral-700">Choose what happens to copies in readers’ collections.</legend>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border p-2"><input type="radio" name="saved-copies" checked={collectionChoice === "keep"} onChange={() => setCollectionChoice("keep")} /> Keep saved copies</label>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border p-2"><input type="radio" name="saved-copies" checked={collectionChoice === "remove"} onChange={() => setCollectionChoice("remove")} /> Remove saved copies</label>
            </fieldset>
          ) : <p className="mt-2 text-sm text-neutral-700">This permanently deletes the draft and its files.</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus className={button} disabled={saving} onClick={() => setAction(null)}>Cancel</button>
            <button type="button" className={`${button} border-red-800 bg-red-700 text-white hover:bg-red-800`} disabled={saving} onClick={() => void apply()}>
              {saving ? "Working…" : action.status === "published" ? "Unpublish" : "Delete forever"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-800" role="alert">{error}</p>}
        </ActionDialog>
      )}
    </main>
  );
}

function OwnedCard({ zine, manage }: { zine: OwnedZine; manage: (zine: OwnedZine) => void }) {
  const published = zine.status === "published";
  return (
    <article className={tile}>
      <ZineCover src={zine.cover_img_url} title={zine.title} />
      <div className="flex flex-1 flex-col gap-2 p-2.5 sm:p-3">
        <h3 className="break-words font-semibold">{zine.title || "Untitled zine"}</h3>
        {!published && zine.wasPublished && <p className="text-xs text-neutral-600">Unpublished</p>}
        <div className="mt-auto flex flex-wrap gap-1.5">
          <Link href={`/zinemat?id=${zine.id}`} className={button}>Edit</Link>
          {(published || !zine.wasPublished) && (
            <button type="button" onClick={() => manage(zine)} className={`${button} border-red-200 text-red-800 hover:bg-red-50`}>{published ? "Unpublish" : "Delete"}</button>
          )}
          {published && <Link href={`/issues/${encodeURIComponent(zine.slug)}`} className={button}>View</Link>}
        </div>
      </div>
    </article>
  );
}

function CollectionQrCard({ zine }: { zine: OwnedZine }) {
  const [error, setError] = useState(false);
  const url = qrUrl(zine.id, "collection");
  async function download() {
    setError(false);
    try {
      const QRCode = await import("qrcode");
      const src = await QRCode.toDataURL(url, { ...qrPngOptions, type: "image/png" });
      const link = document.createElement("a");
      link.href = src;
      link.download = `collection-qr-${zine.slug || zine.id}.png`;
      link.click();
    } catch {
      setError(true);
    }
  }
  return (
    <article className={`${tile} items-center gap-2 p-2.5`}>
      <div className="w-20"><IssueQRCode fullRedirectUrl={url} label={zine.title || "this zine"} /></div>
      <p className="min-w-0 break-words text-center text-sm font-semibold">{zine.title || "Untitled zine"}</p>
      <button type="button" className={`${button} mt-auto`} onClick={() => void download()}>Download QR</button>
      {error && <p className="text-xs text-red-800" role="alert">Couldn’t download this QR.</p>}
    </article>
  );
}
