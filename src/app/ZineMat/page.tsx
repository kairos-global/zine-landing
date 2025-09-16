// src/app/ZineMat/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import toast from "react-hot-toast";

/** ---------- Supabase ---------- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** ---------- Types ---------- */
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
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const { isSignedIn, user } = useUser();

  /** Core state */
  const [basics, setBasics] = useState<Basics>({ title: "", date: null });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [links, setLinks] = useState<InteractiveLink[]>([]);
  const [active, setActive] = useState<SectionKey[]>(["BASICS"]);
  const [loading, setLoading] = useState<boolean>(!!editId);

  /** Fetch existing issue if editing */
  useEffect(() => {
    if (!editId) return;

    (async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .eq("id", editId)
        .single();

      if (error) {
        console.error("Error fetching issue:", error);
        toast.error("Could not load issue.");
        setLoading(false);
        return;
      }

      if (data) {
        setBasics({
          title: data.title ?? "",
          date: data.published_at,
        });
        if (data.links) setLinks(data.links);
      }

      setLoading(false);
    })();
  }, [editId]);

  /** Checklist */
  const checklist = useMemo(() => {
    const basicsOk = basics.title.trim().length > 0;
    const coverOk = !!coverFile;
    return { basics: basicsOk, cover: coverOk };
  }, [basics.title, coverFile]);

  const canSaveDraft = checklist.basics;
  const canPublish = checklist.basics && checklist.cover;

  /** Redirect placeholder if not signed in */
  if (typeof window !== "undefined" && !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-700">
        Redirecting to sign in…
      </div>
    );
  }

  const addSection = (key: SectionKey) =>
    setActive((cur) => (cur.includes(key) ? cur : [...cur, key]));
  const removeSection = (key: SectionKey) =>
    setActive((cur) => cur.filter((k) => k !== key));

  /** Helpers */
  function buildPayload(status: "draft" | "published") {
    const slugBase =
      basics.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 48) || `issue-${Date.now().toString().slice(-6)}`;

    return {
      title: basics.title.trim(),
      slug: slugBase,
      status,
      published_at:
        status === "published"
          ? basics.date || new Date().toISOString().slice(0, 10)
          : null,
      links,
      wantQR: links.some((l) => l.generateQR),
      ...(user ? { user_id: user.id } : {}),
    };
  }

  /** Create new draft */
  async function createDraft() {
    const payload = buildPayload("draft");
    const { data, error } = await supabase
      .from("issues")
      .insert([payload])
      .select("id")
      .single();

    if (error) {
      console.error("Draft error:", error);
      toast.error("Could not save draft.");
      return;
    }

    toast.success("Draft saved.");
    router.push(`/zinemat?id=${data.id}`);
  }

  /** Update existing draft */
  async function updateDraft() {
    if (!editId) return;
    const payload = buildPayload("draft");
    const { error } = await supabase
      .from("issues")
      .update(payload)
      .eq("id", editId);

    if (error) {
      console.error("Update error:", error);
      toast.error("Could not save changes.");
      return;
    }

    toast.success("Changes saved.");
  }

  /** Publish */
  async function publishIssue() {
    const payload = buildPayload("published");
    let result;
    if (editId) {
      result = await supabase
        .from("issues")
        .update(payload)
        .eq("id", editId)
        .select("id")
        .single();
    } else {
      result = await supabase
        .from("issues")
        .insert([payload])
        .select("id")
        .single();
    }

    if (result.error) {
      console.error("Publish error:", result.error);
      toast.error("Could not publish issue.");
      return;
    }

    toast.success("Published!");
    router.push(`/past-issues?new=${result.data.id}`);
  }

  /** UI */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Loading issue…
      </div>
    );
  }

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
            {/* Save Draft */}
            <button
              onClick={createDraft}
              disabled={!canSaveDraft || !!editId}
              className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-50"
            >
              Save Draft
            </button>

            {/* Save Changes */}
            <button
              onClick={updateDraft}
              disabled={!editId}
              className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-50"
            >
              Save Changes
            </button>

            {/* Publish */}
            <button
              onClick={publishIssue}
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
