"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/* ====== CONFIG ====== */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

// brand colors
const BG_BLUE = "#AAEEFF";
const BG_CREAM = "#F0EBCC";

/* ====== UTILS ====== */
function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function normalizeUrl(v: string) {
  if (!v) return v;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

/* ====== ADDRESS AUTOCOMPLETE (Mapbox Places) ====== */
type Place = {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  context?: Array<{ id: string; text: string }>;
};

function usePlacesSearch(query: string) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Place[]>([]);

  useEffect(() => {
    if (!token) return;
    if (!query || query.length < 3) {
      setResults([]);
      return;
    }

    const ctl = new AbortController();
    const run = async () => {
      setLoading(true);
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${token}&autocomplete=true&limit=5`;
        const r = await fetch(url, { signal: ctl.signal });
        const j = await r.json();
        const feats: Place[] = (j?.features ?? []).map((f: any) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center,
          context: f.context,
        }));
        setResults(feats);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ctl.abort();
  }, [query, token]);

  return { loading, results };
}

type GeoSelectProps = {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (s: string) => void;
  onPick: (picked: { address: string; city?: string; lat?: number; lng?: number }) => void;
};
function GeoSelect({ label, placeholder, value, onChange, onPick }: GeoSelectProps) {
  const { loading, results } = usePlacesSearch(value);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      {label && <div className="mb-1 text-sm opacity-70">{label}</div>}
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder ?? "Search address"}
        className="w-full rounded-lg border-2 border-black px-3 py-2 focus:outline-none"
      />
      {open && (loading || results.length > 0) && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border-2 border-black bg-white shadow-lg max-h-56 overflow-auto">
          {loading && <div className="px-3 py-2 text-sm">Searching…</div>}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="block w-full px-3 py-2 text-left hover:bg-neutral-100"
              onClick={() => {
                // try to find city in context
                const city =
                  p.context?.find((c) => c.id.startsWith("place"))?.text ??
                  p.context?.find((c) => c.id.startsWith("locality"))?.text;
                onPick({
                  address: p.place_name,
                  city,
                  lat: p.center[1],
                  lng: p.center[0],
                });
                setOpen(false);
              }}
            >
              {p.place_name}
            </button>
          ))}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm opacity-70">No results</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ====== MAIN BUTTON + MODAL ====== */
export default function MakeZineButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border-2 border-black bg-[var(--btn)] px-5 py-2.5 text-black font-medium hover:translate-y-[1px] transition"
        style={{ ["--btn" as any]: BG_BLUE }}
      >
        Make a Zine
      </button>

      {open && <ZineModal onClose={() => setOpen(false)} />}
    </>
  );
}

/* ====== MODAL CONTENT ====== */
function ZineModal({ onClose }: { onClose: () => void }) {
  // Issue state
  const [title, setTitle] = useState("");
  const [issueNo, setIssueNo] = useState("");
  const [date, setDate] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [issueId, setIssueId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Forms for lanes
  const [fName, setFName] = useState("");
  const [fUrl, setFUrl] = useState("");
  const [fCity, setFCity] = useState("");
  const [fAddr, setFAddr] = useState("");
  const fGeo = useRef<{ lat?: number; lng?: number }>({});

  const [eName, setEName] = useState("");
  const [eUrl, setEUrl] = useState("");
  const [eCity, setECity] = useState("");
  const [eAddr, setEAddr] = useState("");
  const eGeo = useRef<{ lat?: number; lng?: number }>({});

  const [aName, setAName] = useState("");
  const [aWeb, setAWeb] = useState("");

  const [dName, setDName] = useState("");
  const [dAddr, setDAddr] = useState("");
  const [dWeb, setDWeb] = useState("");
  const dGeo = useRef<{ lat?: number; lng?: number }>({});

  // Lists (local echo)
  const [features, setFeatures] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [advertisers, setAdvertisers] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);

  const canCreateIssue = title.trim().length > 0 && !issueId;

  async function uploadToStorage(file: File, path: string) {
    const { data, error } = await supabase.storage.from("Zineground").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
    });
    if (error) throw error;
    const { data: pub } = supabase.storage.from("Zineground").getPublicUrl(path);
    return pub.publicUrl;
  }

  async function createDraft() {
    try {
      setSaving(true);
      let cover_url: string | null = null;
      let pdf_url: string | null = null;

      // upload first (if provided)
      if (coverFile) {
        cover_url = await uploadToStorage(coverFile, `covers/${Date.now()}_${coverFile.name}`);
      }
      if (pdfFile) {
        pdf_url = await uploadToStorage(pdfFile, `pdfs/${Date.now()}_${pdfFile.name}`);
      }

      const slug = issueNo ? slugify(issueNo) : slugify(title);

      const { data, error } = await supabase
        .from("issues")
        .insert({
          title,
          slug,
          cover_img_url: cover_url,
          pdf_url,
          published_at: date || null,
          status: "draft",
        })
        .select("id")
        .single();

      if (error) throw error;
      setIssueId(data.id);
      alert("Draft created. You can now add items to lanes.");
    } catch (e: any) {
      alert(e.message ?? "Failed to create draft");
    } finally {
      setSaving(false);
    }
  }

  async function publishIssue() {
    if (!issueId) return;
    try {
      setSaving(true);
      const { error } = await supabase.from("issues").update({ status: "published" }).eq("id", issueId);
      if (error) throw error;
      alert("Published!");
      onClose();
    } catch (e: any) {
      alert(e.message ?? "Failed to publish");
    } finally {
      setSaving(false);
    }
  }

  // Lane adders
  async function addFeature(kind: "feature" | "event") {
    if (!issueId) return alert("Create draft first");
    const name = kind === "feature" ? fName : eName;
    const url = kind === "feature" ? fUrl : eUrl;
    const city = kind === "feature" ? fCity : eCity;
    const address = kind === "feature" ? fAddr : eAddr;
    const geoRef = kind === "feature" ? fGeo : eGeo;

    if (!name.trim()) return;

    try {
      const { data, error } = await supabase
        .from("features")
        .insert({
          type: kind === "event" ? "event" : "feature",
          name,
          url: url ? normalizeUrl(url) : null,
          city: city || null,
          address: address || null,
          lat: geoRef.current.lat ?? null,
          lng: geoRef.current.lng ?? null,
          issue_id: issueId,
        })
        .select("*")
        .single();

      if (error) throw error;
      if (kind === "feature") setFeatures((x) => [data, ...x]);
      else setEvents((x) => [data, ...x]);

      // clear
      if (kind === "feature") {
        setFName("");
        setFUrl("");
        setFCity("");
        setFAddr("");
        fGeo.current = {};
      } else {
        setEName("");
        setEUrl("");
        setECity("");
        setEAddr("");
        eGeo.current = {};
      }
    } catch (e: any) {
      alert(e.message ?? "Failed to add");
    }
  }

  async function addAdvertiser() {
    if (!issueId) return alert("Create draft first");
    if (!aName.trim()) return;
    try {
      const { data, error } = await supabase
        .from("advertisers")
        .insert({
          issue_id: issueId,
          name: aName,
          website: aWeb ? normalizeUrl(aWeb) : null,
        })
        .select("*")
        .single();

      if (error) throw error;
      setAdvertisers((x) => [data, ...x]);
      setAName("");
      setAWeb("");
    } catch (e: any) {
      alert(e.message ?? "Failed to add advertiser");
    }
  }

  async function addDistributor() {
    if (!issueId) return alert("Create draft first");
    if (!dName.trim()) return;
    try {
      const { data, error } = await supabase
        .from("distributors")
        .insert({
          issue_id: issueId,
          name: dName,
          address: dAddr || null,
          website: dWeb ? normalizeUrl(dWeb) : null,
          lat: dGeo.current.lat ?? null,
          lng: dGeo.current.lng ?? null,
          active: true,
        })
        .select("*")
        .single();

      if (error) throw error;
      setDistributors((x) => [data, ...x]);
      setDName("");
      setDAddr("");
      setDWeb("");
      dGeo.current = {};
    } catch (e: any) {
      alert(e.message ?? "Failed to add distributor");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: "blur(8px)" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Sheet */}
      <div className="relative z-10 w-[min(1100px,92vw)] max-h-[88vh] overflow-auto rounded-2xl border-2 border-black bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b-2 border-black bg-white/80 px-5 py-3 backdrop-blur">
          <h2 className="text-xl font-semibold">Start your Zine</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-2 border-black bg-white px-3 py-1.5 hover:bg-neutral-100"
          >
            Close
          </button>
        </div>

        {/* Issue form */}
        <div className="px-5 py-4">
          <div
            className="rounded-2xl border-2 border-black bg-[var(--cream)] p-4"
            style={{ ["--cream" as any]: BG_CREAM }}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                className="rounded-lg border-2 border-black px-3 py-2"
                placeholder="Title *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="rounded-lg border-2 border-black px-3 py-2"
                placeholder="Issue No. (optional)"
                value={issueNo}
                onChange={(e) => setIssueNo(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className="col-span-2 rounded-lg border-2 border-black px-3 py-2"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              {/* Uploads */}
              <div className="md:col-span-3 grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-lg border-2 border-black px-3 py-2">
                  <span>Cover image (jpg/png)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border-2 border-black px-3 py-2">
                  <span>PDF</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!canCreateIssue || saving}
                onClick={createDraft}
                className="rounded-lg border-2 border-black bg-[var(--btn)] px-3 py-1.5 disabled:opacity-60"
                style={{ ["--btn" as any]: BG_BLUE }}
              >
                {saving ? "Saving…" : "Create draft"}
              </button>
              <button
                type="button"
                disabled={!issueId || saving}
                onClick={publishIssue}
                className="rounded-lg border-2 border-black bg-white px-3 py-1.5 hover:bg-neutral-100 disabled:opacity-60"
              >
                Publish
              </button>
            </div>
          </div>
        </div>

        {/* Lanes */}
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 md:grid-cols-2 xl:grid-cols-4">
          {/* Features */}
          <Lane title="Features">
            <div className="rounded-2xl border-2 border-black p-3">
              <div className="space-y-2">
                <input
                  className="w-full rounded-lg border-2 border-black px-3 py-2"
                  placeholder="Name *"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border-2 border-black px-3 py-2"
                  placeholder="URL"
                  value={fUrl}
                  onChange={(e) => setFUrl(e.target.value)}
                />
                <GeoSelect
                  value={fAddr}
                  onChange={setFAddr}
                  onPick={({ address, city, lat, lng }) => {
                    setFAddr(address);
                    setFCity(city || "");
                    fGeo.current = { lat, lng };
                  }}
                  label="Address"
                  placeholder="Search address"
                />
                <input
                  className="w-full rounded-lg border-2 border-black px-3 py-2"
                  placeholder="City"
                  value={fCity}
                  onChange={(e) => setFCity(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => addFeature("feature")}
                  disabled={!issueId}
                  className="mt-1 w-full rounded-lg border-2 border-black bg-[var(--btn)] px-3 py-2 disabled:opacity-60"
                  style={{ ["--btn" as any]: BG_BLUE }}
                >
                  Add
                </button>
              </div>
            </div>
            <List items={features} />
          </Lane>

          {/* Events */}
          <Lane title="Events">
            <div className="rounded-2xl border-2 border-black p-3">
              <div className="space-y-2">
                <input
                  className="w-full rounded-lg border-2 border-black px-3 py-2"
                  placeholder="Name *"
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border-2 border-black px-3 py-2"
                  placeholder="URL"
                  value={eUrl}
                  onChange={(e) => setEUrl(e.target.value)}
                />
                <GeoSelect
                  value={eAddr}
                  onChange={setEAddr}
                  onPick={({ address, city, lat, lng }) => {
                    setEAddr(address);
                    setECity(city || "");
                    eGeo.current = { lat, lng };
                  }}
                  label="Address"
                  placeholder="Search address"
                />
                <input
                  className="w-full rounded-lg border-2 border-black px-3 py-2"
                  placeholder="City"
                  value={eCity}
                  onChange={(e) => setECity(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => addFeature("event")}
                  disabled={!issueId}
                  className="mt-1 w-full rounded-lg border-2 border-black bg-[var(--btn)] px-3 py-2 disabled:opacity-60"
                  style={{ ["--btn" as any]: BG_BLUE }}
                >
                  Add
                </button>
              </div>
            </div>
            <List items={events} />
          </Lane>

          {/* Advertisers */}
          <Lane title="Advertisers">
            <div className="rounded-2xl border-2 border-black p-3">
              <div className="space-y-2">
                <input
                  className="w-full rounded-lg border-2 border-black px-3 py-2"
                  placeholder="Business name *"
                  value={aName}
                  onChange={(e) => setAName(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border-2 border-black px-3 py-2"
                  placeholder="Website"
                  value={aWeb}
                  onChange={(e) => setAWeb(e.target.value)}
                />
                <button
                  type="button"
                  onClick={addAdvertiser}
                  disabled={!issueId}
                  className="mt-1 w-full rounded-lg border-2 border-black bg-[var(--btn)] px-3 py-2 disabled:opacity-60"
                  style={{ ["--btn" as any]: BG_BLUE }}
                >
                  Add
                </button>
              </div>
            </div>
            <List items={advertisers} />
          </Lane>

          {/* Distributors */}
          <Lane title="Distributors">
            <div className="rounded-2xl border-2 border-black p-3">
              <div className="space-y-2">
                <input
                  className="w-full rounded-lg border-2 border-black px-3 py-2"
                  placeholder="Name *"
                  value={dName}
                  onChange={(e) => setDName(e.target.value)}
                />
                <GeoSelect
                  value={dAddr}
                  onChange={setDAddr}
                  onPick={({ address, lat, lng }) => {
                    setDAddr(address);
                    dGeo.current = { lat, lng };
                  }}
                  label="Address"
                  placeholder="Search address"
                />
                <input
                  className="w-full rounded-lg border-2 border-black px-3 py-2"
                  placeholder="Website"
                  value={dWeb}
                  onChange={(e) => setDWeb(e.target.value)}
                />
                <button
                  type="button"
                  onClick={addDistributor}
                  disabled={!issueId}
                  className="mt-1 w-full rounded-lg border-2 border-black bg-[var(--btn)] px-3 py-2 disabled:opacity-60"
                  style={{ ["--btn" as any]: BG_BLUE }}
                >
                  Add
                </button>
              </div>
            </div>
            <List items={distributors} />
          </Lane>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t-2 border-black bg-white/80 px-5 py-3 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-2 border-black bg-white px-4 py-2 hover:bg-neutral-100"
          >
            Close
          </button>
          <button
            type="button"
            disabled={!issueId || saving}
            onClick={publishIssue}
            className="rounded-lg border-2 border-black bg-[var(--btn)] px-4 py-2 disabled:opacity-60"
            style={{ ["--btn" as any]: BG_BLUE }}
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

/* ====== SMALL PRESENTATION HELPERS ====== */
function Lane({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded-3xl border-2 border-black bg-white">
      <header
        className="rounded-t-[20px] border-b-2 border-black px-4 py-2 font-semibold"
        style={{ background: BG_CREAM }}
      >
        {title}
      </header>
      <div className="space-y-3 p-3">{children}</div>
    </section>
  );
}

function List({ items }: { items: any[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li
          key={it.id ?? JSON.stringify(it)}
          className="rounded-xl border-2 border-black bg-white px-3 py-2"
        >
          <div className="font-medium">{it.name ?? it.title ?? "Untitled"}</div>
          {it.address && <div className="text-sm opacity-70">{it.address}</div>}
          {it.website && (
            <a href={it.website} target="_blank" className="text-sm underline">
              {it.website}
            </a>
          )}
          {it.url && (
            <a href={it.url} target="_blank" className="text-sm underline">
              {it.url}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
