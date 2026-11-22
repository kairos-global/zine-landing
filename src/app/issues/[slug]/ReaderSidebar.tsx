"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ActionDialog from "@/components/ActionDialog";
import ZineIcon from "@/components/ZineIcon";
import { qrUrl } from "@/lib/zine-qr";
import type { MapLocation } from "@/lib/map-directory";
import { IssueQRCode } from "./IssueQRCode";
import styles from "./reader-motion.module.css";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-400 px-3 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50";
const primary = `${button} border-green-700 bg-[#82E385] text-green-950 hover:bg-green-300`;
const card = "min-w-0 space-y-2.5 rounded-xl border p-3.5 text-sm";
type Dialog = "collect" | "recommend" | "share";

export default function ReaderSidebar({ issueId, title, slug, path, url, published, collected, signedIn, forceSave, forceRecommend, category, author }: {
  issueId: string;
  title: string;
  slug: string;
  path: string;
  url: string;
  published: boolean;
  collected: boolean;
  signedIn: boolean;
  forceSave: boolean;
  forceRecommend: boolean;
  category: string | null;
  author: { name: string; handle: string; avatar: string | null } | null;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [saved, setSaved] = useState(collected);
  const [locations, setLocations] = useState<MapLocation[] | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [distributor, setDistributor] = useState("");
  const [recommended, setRecommended] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seenKey = `zineground:collect-prompt:${issueId}`;

  useEffect(() => {
    if (!published) return;
    let seen = false;
    try { seen = localStorage.getItem(seenKey) === "1"; } catch { /* Storage can be unavailable in private browsing. */ }
    if (forceRecommend && signedIn) setDialog("recommend");
    else if (!collected && (forceSave || !seen)) setDialog("collect");
  }, [collected, forceRecommend, forceSave, published, seenKey, signedIn]);

  useEffect(() => {
    if (!published) return;
    const controller = new AbortController();
    void fetch("/api/map", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Directory unavailable");
        return response.json() as Promise<{ locations: MapLocation[] }>;
      })
      .then(data => setLocations(data.locations))
      .catch(() => { if (!controller.signal.aborted) setAvailabilityError(true); });
    return () => controller.abort();
  }, [published]);

  const available = locations?.filter(location => location.issues.some(issue => issue.id === issueId));
  const sortedLocations = locations?.slice().sort((a, b) => a.name.localeCompare(b.name));

  function markSeen() {
    try { localStorage.setItem(seenKey, "1"); } catch { /* The sidebar save button remains available. */ }
  }

  function open(next: Dialog) {
    setError("");
    setCopied(false);
    setRecommended(false);
    setDialog(next);
  }

  function close() {
    if (dialog === "collect") markSeen();
    if (dialog === "collect" || dialog === "recommend") {
      const current = new URL(window.location.href);
      current.searchParams.delete(dialog === "collect" ? "save" : "recommend");
      window.history.replaceState(window.history.state, "", current);
    }
    setDialog(null);
  }

  function signIn(next: "save" | "recommend") {
    const target = new URL(path, window.location.origin);
    target.search = window.location.search;
    target.searchParams.delete(next === "save" ? "recommend" : "save");
    target.searchParams.set(next, "1");
    window.location.assign(`/sign-in?redirect_url=${encodeURIComponent(target.pathname + target.search)}`);
  }

  async function submit(kind: "collect" | "recommend") {
    if (!signedIn) { signIn(kind === "collect" ? "save" : "recommend"); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/issues/${issueId}/${kind}`, {
        method: "POST",
        ...(kind === "recommend" ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ distributorId: distributor }),
        } : {}),
      });
      if (response.status === 401) { signIn(kind === "collect" ? "save" : "recommend"); return; }
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Couldn’t finish. Try again.");
      if (kind === "collect") {
        setSaved(true);
        markSeen();
      } else setRecommended(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t finish. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; }
      catch (caught) { if (caught instanceof DOMException && caught.name === "AbortError") return; }
    }
    open("share");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Couldn’t copy automatically. Select the link to copy it.");
    }
  }

  return (
    <aside aria-label="About this zine" className="min-w-0 space-y-3">
      {(author || category || !published) && (
        <div className={card}>
          {author && (
            <Link href={`/u/${encodeURIComponent(author.handle)}`} className="flex min-h-11 items-center gap-2.5 font-semibold hover:underline">
              {author.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={author.avatar} alt="" className="size-9 rounded-full object-cover" />
              )}
              <span className="min-w-0 break-words">By {author.name}</span>
            </Link>
          )}
          {category && <p className="text-neutral-600">{category}</p>}
          {!published && <p className="text-neutral-600">{collected ? "Saved edition" : "Unpublished zine"}</p>}
        </div>
      )}

      {published && <>
        <section className={card}>
          <h2 className="font-semibold">Collection QR</h2>
          <div className="flex items-center gap-3">
            <div className="w-20 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-white">
              <IssueQRCode fullRedirectUrl={qrUrl(issueId, "collection")} label="this zine’s collection page" />
            </div>
            <p className="text-neutral-600">Open and save this zine to your Zineground collection.</p>
          </div>
          {saved ? <Link href="/dashboard/library" className={button}><ZineIcon name="check" /> In your collection</Link>
            : <button type="button" className={primary} onClick={() => open("collect")}><ZineIcon name="bookmark" /> Save to collection</button>}
        </section>

        <section id="locate" className={`${card} scroll-mt-5`}>
          <h2 className="font-semibold">Find on map</h2>
          {availabilityError && <p className="text-neutral-600">Stock information is temporarily unavailable.</p>}
          {!available && !availabilityError && <p className="text-neutral-600" role="status">Checking stock…</p>}
          {available?.length === 0 && <p className="text-neutral-600">No distributors have this zine in stock.</p>}
          {!!available?.length && <p className="text-neutral-600">In stock at {available.length} {available.length === 1 ? "distributor" : "distributors"}.</p>}
          {available?.length !== 0 && <Link href={`/map?issue=${encodeURIComponent(slug)}`} className={button}><ZineIcon name="map" />Find on map</Link>}
          {available?.length === 0 && <button type="button" onClick={() => open("recommend")} className={button}>Recommend to distributor</button>}
        </section>
        <button type="button" onClick={() => void share()} className={button}><ZineIcon name="share" />Share with friends</button>
      </>}

      {dialog === "collect" && (
        <ActionDialog title={saved ? "Saved to your collection" : "Save this zine to your collection?"} onDismiss={close} busy={busy}>
          <div className={`${styles.collectionArt} ${saved ? styles.saved : ""}`}><ZineIcon name={saved ? "check" : "bookmark"} /></div>
          <p className="text-center text-sm text-neutral-700">{saved ? `${title} is in My Library.` : title}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {saved ? <button autoFocus type="button" className={primary} onClick={close}>Keep reading</button>
              : <>
                  <button type="button" className={button} disabled={busy} onClick={close}>Not now</button>
                  <button type="button" autoFocus className={primary} disabled={busy} onClick={() => void submit("collect")}>
                    {busy ? "Saving…" : signedIn ? "Save to collection" : "Sign in to save"}
                  </button>
                </>}
          </div>
          {error && <p className="mt-2 text-sm text-red-800" role="alert">{error}</p>}
        </ActionDialog>
      )}

      {dialog === "recommend" && (
        <ActionDialog title="Recommend to a distributor" onDismiss={close} busy={busy}>
          {recommended ? (
            <>
              <p className="mt-3 text-sm" role="status">Your recommendation is in their Zineground distributor portal.</p>
              <div className="mt-4 flex justify-end"><button type="button" className={primary} onClick={close}>Done</button></div>
            </>
          ) : (
            <form className="mt-3 space-y-4" onSubmit={event => { event.preventDefault(); void submit("recommend"); }}>
              <p className="text-sm text-neutral-700">Ask a distributor to stock {title}.</p>
              {signedIn && !!sortedLocations?.length && (
                <label className="block text-sm font-medium">
                  Distributor
                  <select required value={distributor} onChange={event => setDistributor(event.target.value)} className="mt-1.5 block min-h-11 w-full rounded-lg border border-neutral-400 bg-white px-2.5">
                    <option value="">Choose a distributor</option>
                    {sortedLocations.map(location => <option key={location.id} value={location.id}>{location.name} · {location.address}</option>)}
                  </select>
                </label>
              )}
              {signedIn && !sortedLocations && !availabilityError && <p role="status" className="text-sm">Opening the distributor list…</p>}
              {signedIn && (availabilityError || sortedLocations?.length === 0) && <Link className="block min-h-10 py-2 text-sm underline"
                href={`/contact?topic=map&reference=${encodeURIComponent(title.slice(0, 200))}`}>Suggest a distributor to Zineground</Link>}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className={button} disabled={busy} onClick={close}>Cancel</button>
                <button type="submit" className={primary} disabled={busy || signedIn && !distributor}>
                  {busy ? "Sending…" : signedIn ? "Send recommendation" : "Sign in to recommend"}
                </button>
              </div>
              {error && <p className="text-sm text-red-800" role="alert">{error}</p>}
            </form>
          )}
        </ActionDialog>
      )}

      {dialog === "share" && (
        <ActionDialog title="Share with friends" onDismiss={close}>
          <label className="mt-3 block text-sm font-medium">Zine link
            <input readOnly value={url} onFocus={event => event.currentTarget.select()} className="mt-1 block min-h-11 w-full rounded-lg border border-neutral-400 p-2" />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={primary} onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</button>
            <a className={button} href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`}>Share by email</a>
            <button type="button" className={button} onClick={close}>Done</button>
          </div>
          {error && <p className="mt-2 text-sm text-red-800" role="alert">{error}</p>}
        </ActionDialog>
      )}
    </aside>
  );
}
