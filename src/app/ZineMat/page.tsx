// src/app/ZineMat/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import toast from "react-hot-toast";

/** ---------- Types shared with child sections ---------- */
export type Basics = {
  title: string;
  date?: string | null;
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
  UPLOAD: { label: "B) Uploads", accent: "#F2DC6F", required: false },
  INTERACTIVITY: { label: "C) Interactivity", accent: "#82E385" },
  CODEGEN: { label: "D) Code Gen (QR)", accent: "#D16FF2" },
};

/** Safe stand-in for legacy arrays we still POST */
type LegacyEntity = Record<string, unknown>;

export default function ZineMatPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();

  if (typeof window !== "undefined" && !isSignedIn) {
    window.location.href = "/sign-in?redirect_url=/zinemat";
    return null;
  }

  /** Core state */
  const [basics, setBasics] = useState<Basics>({ title: "", date: null });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [links, setLinks] = useState<InteractiveLink[]>([]);

  /** Layout state */
  const [active, setActive] = useState<SectionKey[]>(["BASICS"]);

  const addSection = (key: SectionKey) =>
    setActive((cur) => (cur.includes(key) ? cur : [...cur, key]));
  const removeSection = (key: SectionKey) =>
    setActive((cur) => cur.filter((k) => k !== key));

  /** Checklist */
  const checklist = useMemo(() => {
    const basicsOk = basics.title.trim().length > 0;
    const coverOk = !!coverFile;
    return { basics: basicsOk, cover: coverOk };
  }, [basics.title, coverFile]);

  const canSaveDraft = checklist.basics;
  const canPublish = checklist.basics && checklist.cover;

  /** Save */
  async function handleSave(publish: boolean) {
    if (publish && !canPublish) {
      toast.error("Publishing requires an upload.");
      return;
    }
    if (!publish && !canSaveDraft) {
      toast.error("Please add a title before saving.");
      return;
    }

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
        published_at: publish
          ? basics.date || new Date().toISOString().slice(0, 10)
          : null,
      },
      features: [] as LegacyEntity[],
      events: [] as LegacyEntity[],
      advertisers: [] as LegacyEntity[],
      distributors: [] as LegacyEntity[],
      links,
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

    let json: SubmitResp | null = null;
    try {
      const res = await fetch("/api/zinemat/submit", { method: "POST", body: fd });
      json = (await res.json()) as SubmitResp;
    } catch (err) {
      console.error("Network/parse error:", err);
      toast.error("Server did not return JSON.");
      return;
    }

    if (!json || !json.ok) {
      toast.error(json?.error?.message ?? "Could not save the zine.");
      return;
    }

    toast.success(publish ? "Published!" : "Draft saved.");
    router.push(`/past-issues?new=${json.issue_id}`);
  }

  /** UI */
  return (
    <div className="relative min-h-screen text-black">
      {/* GLOBAL cutting-mat background */}
      <div
        className="hidden sm:block fixed inset-0 -z-10 pointer-events-none"
        style={{
          backgroundColor: "#E2E2E2",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px),
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
              disabled={!canSaveDraft}
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
              title={canPublish ? "Publish" : "Needs Basics + Upload"}
            >
              Publish
            </button>
          </div>
        </div>

        {/* Active board */}
        <div className="rounded-2xl border shadow-inner overflow-hidden bg-white/80 backdrop-blur-[1px]">
          <div className="p-4 sm:p-5 space-y-4">
            <Card title={SECTION_META.BASICS.label} accent={SECTION_META.BASICS.accent}>
              <BasicsSection value={basics} onChange={setBasics} />
            </Card>
            {active
              .filter((k) => k !== "BASICS")
              .map((k) => (
                <Card
                  key={k}
                  title={SECTION_META[k].label}
                  accent={SECTION_META[k].accent}
                  onRemove={() => removeSection(k)}
                >
                  {k === "UPLOAD" && (
                    <UploadsSection file={coverFile} onChange={setCoverFile} />
                  )}
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

        {/* Toolkit */}
        <div className="mt-6 rounded-2xl border bg-white/90">
          <div className="px-4 py-3 border-b font-semibold text-sm">Toolkit</div>
          <div className="p-4 grid gap-3 sm:grid-cols-2">
            {(["UPLOAD", "INTERACTIVITY", "CODEGEN"] as SectionKey[])
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
            {(["UPLOAD", "INTERACTIVITY", "CODEGEN"] as SectionKey[]).every((k) =>
              active.includes(k)
            ) && <div className="text-sm text-gray-600">All tools in use.</div>}
          </div>
        </div>

        {/* Checklist */}
        <div className="mt-6 rounded-2xl border bg-white p-4">
          <FinalChecklist checklist={checklist} />
        </div>
      </div>
    </div>
  );
}

/** Card */
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
    <div
      className="rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: `${accent}55` }}
    >
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
          <span className="rounded-md border px-2 py-0.5 text-[10px] text-gray-500">
            Required
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}
