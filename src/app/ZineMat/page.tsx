// src/app/ZineMat/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

  /** C) Tracking entries (mini) */
  type FE = { id: number; name: string; url?: string };
  type ADV = { id: number; name: string; website?: string };
  type DIST = { id: number; name: string; website?: string };

  const [features, setFeatures] = useState<FE[]>([]);
  const [events, setEvents] = useState<FE[]>([]);
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
        status: publish ? "published" as const : "draft" as const,
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
              /* mobile: simple separators */
              divide-y sm:divide-y-0
              /* desktop: cell borders */
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

            {active.includes("C_TRACKING") && (
              <div className="mat-cell">
                <Card
                  title="C) Tracking Entries"
                  onClose={() => removeModule("C_TRACKING")}
                  accent="#82E385"
                >
                  <Subhead>Features</Subhead>
                  <RowAdd
                    onAdd={(name, url) =>
                      setFeatures((arr) => [...arr, { id: Date.now(), name, url }])
                    }
                  />
                  <List
                    items={features.map((f) => ({
                      id: f.id,
                      primary: f.name,
                      secondary: f.url,
                    }))}
                  />

                  <Subhead className="mt-3">Events</Subhead>
                  <RowAdd
                    onAdd={(name, url) =>
                      setEvents((arr) => [...arr, { id: Date.now(), name, url }])
                    }
                    urlPlaceholder="https://event"
                  />
                  <List
                    items={events.map((f) => ({
                      id: f.id,
                      primary: f.name,
                      secondary: f.url,
                    }))}
                  />

                  <Subhead className="mt-3">Advertisers</Subhead>
                  <RowAdd
                    onAdd={(name, url) =>
                      setAdvertisers((arr) => [
                        ...arr,
                        { id: Date.now(), name, website: url },
                      ])
                    }
                    urlPlaceholder="https://website"
                  />
                  <List
                    items={advertisers.map((a) => ({
                      id: a.id,
                      primary: a.name,
                      secondary: a.website,
                    }))}
                  />

                  <Subhead className="mt-3">Distributors</Subhead>
                  <RowAdd
                    onAdd={(name, url) =>
                      setDistributors((arr) => [
                        ...arr,
                        { id: Date.now(), name, website: url },
                      ])
                    }
                    urlPlaceholder="https://website"
                  />
                  <List
                    items={distributors.map((d) => ({
                      id: d.id,
                      primary: d.name,
                      secondary: d.website,
                    }))}
                  />
                </Card>
              </div>
            )}

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

function List({
  items,
}: {
  items: { id: number; primary: string; secondary?: string }[];
}) {
  if (!items.length)
    return <div className="text-sm text-gray-600">No items yet</div>;
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.id} className="rounded-lg border p-2 text-sm">
          <div className="font-medium">{it.primary}</div>
          {it.secondary ? (
            <a className="text-xs underline" href={it.secondary} target="_blank">
              {it.secondary}
            </a>
          ) : (
            <div className="text-xs text-gray-600">No link</div>
          )}
        </div>
      ))}
    </div>
  );
}

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
