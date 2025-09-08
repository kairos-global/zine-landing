// src/app/zinemat/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/** ---------- Types shared with child sections ---------- */
export type Basics = {
  title: string;
  date?: string | null; // yyyy-mm-dd or null
};

export type InteractiveLink = {
  id: string;
  label: string;
  url: string;
  type: "website" | "instagram" | "soundcloud" | "map" | "custom";
  generateQR: boolean;
};

/** ---------- Section components ---------- */
import BasicsSection from "./components/BasicsSection";
import UploadsSection from "./components/UploadsSection";
import InteractivitySection from "./components/InteractivitySection";
import FinalChecklist from "./components/FinalChecklist";
import CodeGenSection from "./components/CodeGenSection";

/** ---------- API response types ---------- */
type SubmitOk = { ok: true; issue_id: string };
type SubmitErr = { ok: false; error: { message: string } };
type SubmitResp = SubmitOk | SubmitErr;

/** ---------- Section registry ---------- */
type SectionKey = "BASICS" | "UPLOAD" | "INTERACTIVITY" | "CODEGEN";

const SECTION_META: Record<
  SectionKey,
  { label: string; accent: string; required?: boolean }
> = {
  BASICS: { label: "A) Basics", accent: "#65CBF1", required: true },
  UPLOAD: { label: "B) Cover Upload (optional file becomes required by flow)", accent: "#F2DC6F", required: true },
  INTERACTIVITY: { label: "C) Interactivity", accent: "#82E385" },
  CODEGEN: { label: "D) Code Gen (QR)", accent: "#D16FF2" },
};

export default function ZineMatPage() {
  const router = useRouter();

  /** Core state */
  const [basics, setBasics] = useState<Basics>({ title: "", date: null });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [links, setLinks] = useState<InteractiveLink[]>([]);

  /** Layout state: which optional sections are active on the board */
  const [active, setActive] = useState<SectionKey[]>([
    "BASICS",
    "UPLOAD",
    // Optional sections start in the toolkit by default
  ]);

  const addSection = (key: SectionKey) =>
    setActive((cur) => (cur.includes(key) ? cur : [...cur, key]));

  const removeSection = (key: SectionKey) =>
    setActive((cur) => cur.filter((k) => k !== key));

  /** --- Checklist & publish enablement --- */
  const checklist = useMemo(() => {
    const basicsOk = basics.title.trim().length > 0;
    const coverOk = !!coverFile; // Upload required by your spec
    const interactivityOk = true; // optional
    return { basics: basicsOk, cover: coverOk, interactivity: interactivityOk };
  }, [basics.title, coverFile]);

  const canPublish = checklist.basics && checklist.cover;

  /** ---------- Save (draft or publish) ---------- */
  async function handleSave(publish: boolean) {
    // Simple slug from title; fall back to timestamp
    const slugBase =
      basics.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 48) || `issue-${Date.now().toString().slice(-6)}`;

    const payload = {
      issue: {
        title: basics.title.trim(),
        slug: slugBase,
        status: (publish ? "published" : "draft") as "published" | "draft",
        published_at: publish ? (basics.date || new Date().toISOString().slice(0, 10)) : null,
      },
      // Legacy arrays kept for API compatibility
      features: [] as any[],
      events: [] as any[],
      advertisers: [] as any[],
      distributors: [] as any[],
      // New generalized interactivity
      links,
      // If any link wants a QR, your backend can generate redirects on save/publish
      wantQR: links.some((l) => l.generateQR),
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

    const res = await fetch("/api/zinemat/submit", { method: "POST", body: fd });

    if (res.status === 401) {
      // Middleware protects this route, but fallback just in case
      window.location.href = "/sign-in?redirect_url=/zinemat";
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

  /** ---------- UI ---------- */
  return (
    <div className="relative min-h-screen text-black">
      {/* GLOBAL cutting-mat background (grey grid) */}
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
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">ZineMat</h1>

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
              title={canPublish ? "Publish" : "Needs Basics + Cover"}
            >
              Publish
            </button>
          </div>
        </div>

        {/* Active board */}
        <div className="rounded-2xl border shadow-inner overflow-hidden bg-white/80 backdrop-blur-[1px]">
          {/* Pinned required sections */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* BASICS (required) */}
            <Card title={SECTION_META.BASICS.label} accent={SECTION_META.BASICS.accent}>
              <BasicsSection value={basics} onChange={setBasics} />
            </Card>

            {/* UPLOAD (required) */}
            <Card title={SECTION_META.UPLOAD.label} accent={SECTION_META.UPLOAD.accent}>
              <UploadsSection file={coverFile} onChange={setCoverFile} />
            </Card>

            {/* Optional sections currently active */}
            {active
              .filter((k) => k !== "BASICS" && k !== "UPLOAD")
              .map((k) => (
                <Card
                  key={k}
                  title={SECTION_META[k].label}
                  accent={SECTION_META[k].accent}
                  onRemove={() => removeSection(k)}
                >
                  {k === "INTERACTIVITY" && (
                    <InteractivitySection links={links} onChange={setLinks} />
                  )}
                  {k === "CODEGEN" && (
                    <CodeGenSection links={links} onChangeLinks={setLinks} />
                  )}
                </Card>
              ))}
          </div>
        </div>

        {/* Toolkit (inactive sections) */}
        <div className="mt-6 rounded-2xl border bg-white/90">
          <div className="px-4 py-3 border-b font-semibold text-sm">Toolkit</div>
          <div className="p-4 grid gap-3 sm:grid-cols-2">
            {(["INTERACTIVITY", "CODEGEN"] as SectionKey[])
              .filter((k) => !active.includes(k))
              .map((k) => (
                <div
                  key={k}
                  className="rounded-xl border p-3 bg-white flex items-center justify-between"
                  style={{ borderColor: `${SECTION_META[k].accent}55` }}
                >
                  <div className="text-sm font-medium">{SECTION_META[k].label}</div>
                  <button
                    onClick={() => addSection(k)}
                    className="rounded-md border px-3 py-1 text-xs hover:bg-white"
                    title="Add to board"
                  >
                    Add
                  </button>
                </div>
              ))}
            {/* If everything is active, show a tiny hint */}
            {(["INTERACTIVITY", "CODEGEN"] as SectionKey[]).every((k) => active.includes(k)) && (
              <div className="text-sm text-gray-600">All tools in use.</div>
            )}
          </div>
        </div>

        {/* Checklist footer */}
        <div className="mt-6 rounded-2xl border bg-white p-4">
          <FinalChecklist checklist={checklist} />
        </div>
      </div>
    </div>
  );
}

/** ------- presentational card ------- */
function Card({
  title,
  accent,
  onRemove,
  children,
}: {
  title: string;
  accent: string;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: `${accent}55` }}>
      <div
        className="flex items-center justify-between rounded-t-2xl border-b px-3 py-2"
        style={{ background: `${accent}22`, borderColor: `${accent}55` }}
      >
        <div className="text-sm font-semibold">{title}</div>
        {onRemove ? (
          <button
            onClick={onRemove}
            className="rounded-md border px-2 py-0.5 text-xs hover:bg-white"
            title="Remove card"
          >
            Remove
          </button>
        ) : (
          <span className="rounded-md border px-2 py-0.5 text-[10px] text-gray-500" title="Required">
            Required
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}
