// src/app/ZineMat/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/** ---------- Shared geocode helper (module scope) ---------- */
async function geocodeAddress(address?: string): Promise<{ lat?: number; lng?: number }> {
  if (!address || !address.trim()) return {};
  try {
    const q = encodeURIComponent(address.trim());
    const res = await fetch(`/api/geocode?query=${q}`);
    if (!res.ok) return {};
    const data = await res.json();
    if (typeof data.lat === "number" && typeof data.lng === "number") {
      return { lat: data.lat, lng: data.lng };
    }
    return {};
  } catch {
    return {};
  }
}

/** Module keys (final labels) */
type ModuleKey = "A_BASICS" | "B_FILES" | "C_TRACKING" | "D_QR" | "E_LINKS";

/** API response from /api/zinemat/submit */
type SubmitOk = { ok: true; issue_id: string };
type SubmitErr = { ok: false; error: { message: string } };
type SubmitResp = SubmitOk | SubmitErr;

export default function ZineMatPage() {
  const router = useRouter();

  /** which modules are active on the mat (defaults on) */
  const [active, setActive] = useState<ModuleKey[]>([
    "A_BASICS",
    "B_FILES",
    "C_TRACKING",
  ]);

  /** A) Basics */
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [date, setDate] = useState<string>(""); // yyyy-mm-dd

  /** B) Files (kept in memory; uploaded at save time) */
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  /** ---------- Tracking entry types ---------- */
  type BaseTracking = {
    id: number;
    name: string;
    website?: string;   // free text
    address?: string;   // user-selected or typed text
    active: boolean;
    lat?: number;       // from geocode/selection
    lng?: number;       // from geocode/selection
  };

  type FE = BaseTracking;   // Features
  type EV = BaseTracking;   // Events
  type ADV = BaseTracking;  // Advertisers
  type DIST = BaseTracking; // Distributors (address required on add)

  const [features, setFeatures] = useState<FE[]>([]);
  const [events, setEvents] = useState<EV[]>([]);
  const [advertisers, setAdvertisers] = useState<ADV[]>([]);
  const [distributors, setDistributors] = useState<DIST[]>([]);

  /** D) QR generator flag */
  const [wantQR, setWantQR] = useState(true);

  /** E) Final zine links */
  type LinkItem = { id: number; label: string; url: string };
  const [linktree, setLinktree] = useState<LinkItem[]>([]);

  /** helper to toggle modules */
  function toggleModule(key: ModuleKey) {
    setActive((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    );
  }

  /** computed checklist for publish button */
  const checklist = useMemo(() => {
    const A = title.trim().length > 0; // Basics: require title
    const B = !!coverFile && !!pdfFile; // Files: require both
    return { A, B, C: true, D: true, E: true };
  }, [title, coverFile, pdfFile]);

  const canPublish = checklist.A && checklist.B;

  /** ---------- ONE-SHOT SAVE (draft or publish) ---------- */
  async function handleSave(publish: boolean) {
    const reserveSlug =
      slug.trim() || `issue-${Date.now().toString().slice(-6)}`;

    const payload = {
      issue: {
        title: title.trim(),
        slug: reserveSlug,
        status: (publish ? "published" : "draft") as "published" | "draft",
        published_at: publish
          ? (date || new Date().toISOString().slice(0, 10))
          : null,
      },
      features,
      events,
      advertisers,
      distributors,
      links: linktree,
      wantQR,
    };

    const fd = new FormData();
    fd.append("issue", JSON.stringify(payload.issue));
    fd.append("features", JSON.stringify(payload.features));
    fd.append("events", JSON.stringify(payload.events));
    fd.append("advertisers", JSON.stringify(payload.advertisers));
    fd.append("distributors", JSON.stringify(payload.distributors));
    fd.append("links", JSON.stringify(payload.links));
    fd.append("wantQR", JSON.stringify(payload.wantQR));
    if (coverFile) fd.append("cover", coverFile);
    if (pdfFile) fd.append("pdf", pdfFile);

    const res = await fetch("/api/zinemat/submit", { method: "POST", body: fd });

    if (res.status === 401) {
      window.location.href = "/sign-in?redirect_url=/ZineMat";
      return;
    }

    let json: SubmitResp;
    try {
      json = (await res.json()) as SubmitResp;
    } catch {
      alert("Server did not return JSON.");
      return;
    }

    if (!json.ok) {
      alert(json.error?.message ?? "Could not save the zine.");
      return;
    }

    alert(publish ? "Published!" : "Draft saved.");
    router.push(`/past-issues?new=${json.issue_id}`);
  }

  /** remove a module from the grid */
  function removeModule(m: ModuleKey) {
    setActive((cur) => cur.filter((k) => k !== m));
  }

  /** --------- UI --------- */
  return (
    <div className="relative min-h-screen text-black">
      {/* GLOBAL cutting-mat background (hidden on mobile) */}
      <div
        className="hidden sm:block fixed inset-0 -z-10 pointer-events-none"
        style={{
          backgroundColor: "#E2E2E2",
          backgroundImage: `
            /* minor grid (24px) */
            linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px),
            /* major grid (120px) */
            linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px",
        }}
      />

      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <ToolbarButton
              label="Basics"
              active={active.includes("A_BASICS")}
              onClick={() => toggleModule("A_BASICS")}
            />
            <ToolbarButton
              label="Files"
              active={active.includes("B_FILES")}
              onClick={() => toggleModule("B_FILES")}
            />
            <ToolbarButton
              label="Tracking Entries"
              active={active.includes("C_TRACKING")}
              onClick={() => toggleModule("C_TRACKING")}
            />
            <ToolbarButton
              label="QR Codes"
              active={active.includes("D_QR")}
              onClick={() => toggleModule("D_QR")}
            />
            <ToolbarButton
              label="Final Zine Links"
              active={active.includes("E_LINKS")}
              onClick={() => toggleModule("E_LINKS")}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSave(false)}
              className="rounded-xl border px-3 py-1 text-sm hover:bg-white"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={!canPublish}
              className={`rounded-xl px-3 py-1 text-sm font-medium ${
                canPublish ? "bg-[#65CBF1]" : "bg-gray-300 text-gray-600"
              }`}
              title={canPublish ? "Publish" : "Complete A & B"}
            >
              Publish
            </button>
            <button
              onClick={() => handleSave(false)}
              className="ml-1 rounded-full border w-8 h-8 grid place-content-center hover:bg-white"
              title="Exit (saves draft)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* MAT BOARD */}
        <div className="relative rounded-2xl border shadow-inner overflow-hidden bg-white/80 backdrop-blur-[1px]">
          <div
            className="
              relative
              grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4
              gap-0
              divide-y sm:divide-y-0
              sm:[&>.mat-cell]:border sm:[&>.mat-cell]:border-black/15
            "
          >
            {active.includes("A_BASICS") && (
              <div className="mat-cell">
                <Card
                  title="A) Basics"
                  onClose={() => removeModule("A_BASICS")}
                  accent="#65CBF1"
                >
                  <Label>Title *</Label>
                  <Input
                    value={title}
                    onChange={setTitle}
                    placeholder="Issue title"
                  />
                  <Label>Slug (optional)</Label>
                  <Input value={slug} onChange={setSlug} placeholder="issue-001" />
                  <Label>Date (optional)</Label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2"
                  />
                </Card>
              </div>
            )}

            {active.includes("B_FILES") && (
              <div className="mat-cell">
                <Card
                  title="B) Files"
                  onClose={() => removeModule("B_FILES")}
                  accent="#F2DC6F"
                >
                  <Label>Cover image (jpg/png) *</Label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                    className="w-full"
                  />
                  <Label>Zine PDF *</Label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-600">
                    Files stay local until you <b>Save Draft</b> or <b>Publish</b>.
                  </p>
                </Card>
              </div>
            )}

            {/* ----------------- C) TRACKING (UPDATED) ----------------- */}
            {active.includes("C_TRACKING") && (
              <div className="mat-cell">
                <Card
                  title="C) Tracking Entries"
                  onClose={() => removeModule("C_TRACKING")}
                  accent="#82E385"
                >
                  <Subhead>Features</Subhead>
                  <TrackingRowAdd
                    onAdd={async (raw) => {
                      let { lat, lng } = raw;
                      if (raw.address && (lat == null || lng == null)) {
                        const g = await geocodeAddress(raw.address);
                        lat = g.lat; lng = g.lng;
                      }
                      setFeatures((arr) => [
                        ...arr,
                        { id: Date.now(), ...raw, lat, lng },
                      ]);
                    }}
                    addressOptional
                  />
                  <TrackingList items={features} />

                  <Subhead className="mt-3">Events</Subhead>
                  <TrackingRowAdd
                    onAdd={async (raw) => {
                      let { lat, lng } = raw;
                      if (raw.address && (lat == null || lng == null)) {
                        const g = await geocodeAddress(raw.address);
                        lat = g.lat; lng = g.lng;
                      }
                      setEvents((arr) => [
                        ...arr,
                        { id: Date.now(), ...raw, lat, lng },
                      ]);
                    }}
                    addressOptional
                  />
                  <TrackingList items={events} />

                  <Subhead className="mt-3">Advertisers</Subhead>
                  <TrackingRowAdd
                    onAdd={async (raw) => {
                      let { lat, lng } = raw;
                      if (raw.address && (lat == null || lng == null)) {
                        const g = await geocodeAddress(raw.address);
                        lat = g.lat; lng = g.lng;
                      }
                      setAdvertisers((arr) => [
                        ...arr,
                        { id: Date.now(), ...raw, lat, lng },
                      ]);
                    }}
                    addressOptional
                  />
                  <TrackingList items={advertisers} />

                  <Subhead className="mt-3">Distributors</Subhead>
                  <TrackingRowAdd
                    onAdd={async (raw) => {
                      if (!raw.address?.trim()) {
                        alert("Distributors require an address.");
                        return;
                      }
                      let { lat, lng } = raw;
                      if (lat == null || lng == null) {
                        const g = await geocodeAddress(raw.address);
                        lat = g.lat; lng = g.lng;
                      }
                      if (lat == null || lng == null) {
                        alert("We couldn't find that address. Please pick a suggestion or try a more specific address.");
                        return;
                      }
                      setDistributors((arr) => [
                        ...arr,
                        { id: Date.now(), ...raw, lat, lng },
                      ]);
                    }}
                    addressOptional={false}
                  />
                  <TrackingList items={distributors} />
                </Card>
              </div>
            )}
            {/* --------------------------------------------------------- */}

            {active.includes("D_QR") && (
              <div className="mat-cell">
                <Card
                  title="D) QR Codes"
                  onClose={() => removeModule("D_QR")}
                  accent="#D16FF2"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={wantQR}
                      onChange={(e) => setWantQR(e.target.checked)}
                    />
                    Generate shortlinks + QR codes at save/publish
                  </label>
                  <p className="text-xs text-gray-600 mt-2">
                    Calls your <code>generate_missing_redirects_for_issue</code> function.
                  </p>
                </Card>
              </div>
            )}

            {active.includes("E_LINKS") && (
              <div className="mat-cell">
                <Card
                  title="E) Final Zine Links"
                  onClose={() => removeModule("E_LINKS")}
                  accent="#A4A4A4"
                >
                  <RowAdd
                    namePlaceholder="Label"
                    urlPlaceholder="https://link"
                    onAdd={(label, url) =>
                      setLinktree((arr) => [
                        ...arr,
                        { id: Date.now(), label, url: url ?? "" },
                      ])
                    }
                  />
                  <div className="mt-2 space-y-2">
                    {linktree.length === 0 ? (
                      <div className="text-sm text-gray-600">No links yet</div>
                    ) : (
                      linktree.map((l) => (
                        <div key={l.id} className="rounded-lg border p-2 text-sm">
                          <div className="font-medium">{l.label}</div>
                          <a
                            className="text-xs underline"
                            href={l.url}
                            target="_blank"
                          >
                            {l.url}
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Checklist footer */}
        <div className="mt-6 rounded-2xl border bg-white p-4">
          <h3 className="font-semibold mb-2">Publish checklist</h3>
          <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-5 text-sm">
            <Badge ok={checklist.A} label="A) Basics (required)" />
            <Badge ok={checklist.B} label="B) Files (required)" />
            <Badge ok={checklist.C} label="C) Tracking Entries (optional)" />
            <Badge ok={checklist.D} label="D) QR codes (optional)" />
            <Badge ok={checklist.E} label="E) Final Zine Links (optional)" />
          </ul>
        </div>
      </div>
    </div>
  );
}

/** ------- tiny UI bits ------- */
function ToolbarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-1 text-sm ${
        active ? "bg-black text-white" : "bg-white hover:bg-black/5"
      }`}
    >
      {label}
    </button>
  );
}

function Card({
  title,
  accent,
  onClose,
  children,
}: {
  title: string;
  accent: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div
        className="flex items-center justify-between rounded-t-2xl border-b px-3 py-2"
        style={{ background: `${accent}22`, borderColor: `${accent}55` }}
      >
        <div className="text-sm font-semibold">{title}</div>
        <button
          onClick={onClose}
          className="rounded-md border px-2 py-0.5 text-xs hover:bg-white"
          title="Remove card"
        >
          Remove
        </button>
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm">{children}</label>;
}

function Subhead({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`text-sm font-semibold ${className}`}>{children}</div>;
}

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
      className="w-full rounded-xl border px-3 py-2"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Legacy RowAdd (kept for E) Links) */
function RowAdd({
  onAdd,
  namePlaceholder = "Name",
  urlPlaceholder = "https://link",
}: {
  onAdd: (name: string, url?: string) => void;
  namePlaceholder?: string;
  urlPlaceholder?: string;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input
        className="w-full rounded-xl border px-3 py-2"
        placeholder={namePlaceholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="w-full rounded-xl border px-3 py-2"
        placeholder={urlPlaceholder}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        onClick={() => {
          if (!name.trim()) return;
          onAdd(name.trim(), url.trim() || undefined);
          setName("");
          setUrl("");
        }}
        className="rounded-xl bg-black px-3 py-2 text-sm text-white"
      >
        Add
      </button>
    </div>
  );
}

/** ------------ AddressAutocomplete (Mapbox-like) ------------ */
function AddressAutocomplete({
  value,
  onSelect,     // fires when user picks a suggestion
  placeholder,
  required = false,
}: {
  value?: string;
  onSelect: (v: { address: string; lat?: number; lng?: number }) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [input, setInput] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<
    { id: string; label: string; lat?: number; lng?: number }[]
  >([]);
  const [hi, setHi] = useState<number>(-1); // highlighted index
  const [loading, setLoading] = useState(false);
  const [t, setT] = useState<any>(null);

  // keep internal input in sync if parent updates value
  useEffect(() => {
    if (value !== undefined && value !== input) setInput(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  async function fetchSuggestions(q: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode/suggest?query=${encodeURIComponent(q)}&limit=5`);
      const data = await res.json();
      setItems(data?.suggestions ?? []);
      setOpen(true);
      setHi(-1);
    } finally {
      setLoading(false);
    }
  }

  // close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest?.('[data-ac-root="1"]')) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" data-ac-root="1">
      <input
        className={`w-full rounded-xl border px-3 py-2 ${required ? "required:[&]:" : ""}`}
        placeholder={placeholder}
        value={input}
        onChange={(e) => {
          const v = e.target.value;
          setInput(v);
          clearTimeout(t);
          setT(setTimeout(() => {
            if (v.trim().length < 3) { setItems([]); setOpen(false); return; }
            fetchSuggestions(v.trim());
          }, 250));
        }}
        onFocus={() => {
          if (items.length) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || !items.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(i + 1, items.length - 1)); }
          if (e.key === "ArrowUp")   { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
          if (e.key === "Enter" && hi >= 0) {
            e.preventDefault();
            const sel = items[hi];
            setInput(sel.label);
            setOpen(false);
            onSelect({ address: sel.label, lat: sel.lat, lng: sel.lng });
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-60 overflow-auto">
          {loading && <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>}
          {!loading && !items.length && (
            <div className="px-3 py-2 text-sm text-gray-500">No results</div>
          )}
          {items.map((it, idx) => (
            <button
              key={it.id}
              onMouseEnter={() => setHi(idx)}
              onMouseLeave={() => setHi(-1)}
              onClick={() => {
                setInput(it.label);
                setOpen(false);
                onSelect({ address: it.label, lat: it.lat, lng: it.lng });
              }}
              className={`block w-full text-left px-3 py-2 text-sm ${
                idx === hi ? "bg-black/5" : ""
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ------------ TrackingRowAdd & TrackingList ------------ */
function TrackingRowAdd({
  onAdd,
  addressOptional,
}: {
  onAdd: (v: {
    name: string;
    website?: string;
    address?: string;
    active: boolean;
    lat?: number;
    lng?: number;
  }) => void;
  addressOptional: boolean;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const [active, setActive] = useState(true);

  return (
    <div className="grid gap-2 md:grid-cols-5">
      <input
        className="rounded-xl border px-3 py-2 md:col-span-2"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="rounded-xl border px-3 py-2"
        placeholder="website (plain text)"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      {/* Autocomplete address input */}
      <AddressAutocomplete
        value={address}
        placeholder={addressOptional ? "address (optional)" : "address *"}
        required={!addressOptional}
        onSelect={(v) => {
          setAddress(v.address);
          setCoords({ lat: v.lat, lng: v.lng });
        }}
      />
      <div className="flex items-center gap-2">
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
        </label>
        <button
          onClick={async () => {
            if (!name.trim()) return;
            if (!addressOptional && !address.trim()) return;

            let lat = coords.lat, lng = coords.lng;

            // Fallback geocode if user typed but didn't choose a suggestion
            if (address && (lat == null || lng == null)) {
              const g = await geocodeAddress(address);
              lat = g.lat; lng = g.lng;
            }

            // For required address rows (Distributors), enforce coords
            if (!addressOptional && address.trim() && (lat == null || lng == null)) {
              alert("We couldn't find that address. Please pick a suggestion or try a more specific address.");
              return;
            }

            onAdd({
              name: name.trim(),
              website: website.trim() || undefined,
              address: address.trim() || undefined,
              active,
              lat, lng,
            });

            setName("");
            setWebsite("");
            setAddress("");
            setCoords({});
            setActive(true);
          }}
          className="ml-auto rounded-xl bg-black px-3 py-2 text-sm text-white"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function TrackingList({
  items,
}: {
  items: {
    id: number;
    name: string;
    website?: string;
    address?: string;
    active: boolean;
    lat?: number;
    lng?: number;
  }[];
}) {
  if (!items.length)
    return <div className="text-sm text-gray-600">No items yet</div>;
  return (
    <div className="mt-2 space-y-2">
      {items.map((it) => (
        <div key={it.id} className="rounded-lg border p-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="font-medium">{it.name}</div>
            <span
              className={`text-xs rounded-full px-2 py-0.5 border ${
                it.active ? "border-green-300 bg-green-50" : "border-gray-300 bg-gray-50"
              }`}
            >
              {it.active ? "active" : "inactive"}
            </span>
          </div>
          {it.website ? (
            <div className="text-xs break-all">{it.website}</div>
          ) : (
            <div className="text-xs text-gray-600">No website</div>
          )}
          {it.address ? (
            <div className="text-xs">{it.address}</div>
          ) : (
            <div className="text-xs text-gray-600">No address</div>
          )}
          {typeof it.lat === "number" && typeof it.lng === "number" ? (
            <div className="text-[10px] text-gray-500">
              ({it.lat.toFixed(5)}, {it.lng.toFixed(5)})
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
/** ----------------------------------------------------------- */

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={`rounded-lg border px-3 py-2 ${
        ok ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
      }`}
    >
      {ok ? "✓" : "•"} {label}
    </li>
  );
}
