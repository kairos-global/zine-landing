"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import toast from "react-hot-toast";

import BasicsSection, { Basics } from "./BasicsSection";
import UploadsSection from "./UploadsSection";
import InteractivitySection, { InteractiveLink } from "./InteractivitySection";
import CodeGenSection from "./CodeGenSection";
import FinalChecklist from "./FinalChecklist";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type SectionKey = "BASICS" | "UPLOAD" | "INTERACTIVITY" | "CODEGEN";

const SECTION_META: Record<
  SectionKey,
  { label: string; accent: string; required?: boolean }
> = {
  BASICS: { label: "A) Basics", accent: "#65CBF1", required: true },
  UPLOAD: { label: "B) Uploads", accent: "#F2DC6F" },
  INTERACTIVITY: { label: "C) Interactivity", accent: "#82E385" },
  CODEGEN: { label: "D) Code Gen (QR)", accent: "#D16FF2" },
};

export default function InteractivityView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("id") ?? null;
  const { isSignedIn, user } = useUser();

  const [basics, setBasics] = useState<Basics>({ title: "", date: null });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [links, setLinks] = useState<InteractiveLink[]>([]);
  const [active, setActive] = useState<SectionKey[]>(["BASICS"]);
  const [loading, setLoading] = useState<boolean>(!!editId);

  // ✅ Load data if editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("title, published_at")
        .eq("id", editId)
        .single();

      if (error) {
        toast.error("Could not load issue.");
        console.error(error);
        setLoading(false);
        return;
      }

      if (data) {
        setBasics({ title: data.title ?? "", date: data.published_at });

        const { data: linkData } = await supabase
          .from("issue_links")
          .select("id, label, url, generate_qr, redirect_path, qr_path")
          .eq("issue_id", editId);

        if (linkData) {
          setLinks(
            linkData.map((l) => ({
              id: l.id,
              label: l.label,
              url: l.url,
              generateQR: l.generate_qr,
              redirect_path: l.redirect_path,
              qr_path: l.qr_path,
            }))
          );
        }
      }

      setLoading(false);
    })();
  }, [editId]);

  // ✅ Checklist logic
  const checklist = useMemo(() => {
    const basicsOk = basics.title.trim().length > 0;
    const coverOk = !!coverFile;
    return { basics: basicsOk, cover: coverOk };
  }, [basics.title, coverFile]);

  const canSaveDraft = checklist.basics;
  const canPublish = checklist.basics && checklist.cover;

  const addSection = (key: SectionKey) =>
    setActive((cur) => (cur.includes(key) ? cur : [...cur, key]));
  const removeSection = (key: SectionKey) =>
    setActive((cur) => cur.filter((k) => k !== key));

  // ✅ Save handler
  const handleSubmit = async (mode: "draft" | "edit" | "publish") => {
    if (!user) return;

    const formData = new FormData();
    formData.append("title", basics.title);
    formData.append("date", basics.date || "");
    formData.append("userId", user.id);
    if (editId) formData.append("issueId", editId);
    else formData.append("issueId", crypto.randomUUID());

    if (coverFile) formData.append("cover", coverFile);
    if (pdfFile) formData.append("pdf", pdfFile);

    formData.append("interactiveLinks", JSON.stringify(links));

    let endpoint = "/api/zinemat/savedraft";
    if (mode === "edit") endpoint = "/api/zinemat/savechanges";
    else if (mode === "publish") endpoint = "/api/zinemat/publish";

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error?.message || "Something went wrong.");
        return;
      }

      toast.success(
        mode === "publish"
          ? "Published successfully!"
          : mode === "edit"
          ? "Changes saved!"
          : "Draft saved!"
      );

      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    }
  };

  if (isSignedIn === false)
    return (
      <div className="flex items-center justify-center min-h-screen">
        Redirecting to sign in…
      </div>
    );
  if (isSignedIn === undefined || loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading…
      </div>
    );

  // ✅ UI matches your old design
  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold">Interactivity</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSubmit("draft")}
            disabled={!canSaveDraft}
            className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit("edit")}
            disabled={!editId}
            className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-50"
          >
            Save Changes
          </button>
          <button
            onClick={() => handleSubmit("publish")}
            disabled={!canPublish}
            className={`rounded-xl px-3 py-1 text-sm font-medium ${
              canPublish ? "bg-[#65CBF1]" : "bg-gray-300 text-gray-600"
            }`}
          >
            Publish
          </button>
        </div>
      </div>

      {/* Section cards */}
      <div className="rounded-2xl border shadow-inner overflow-hidden bg-white/80 backdrop-blur-[1px]">
        <div className="p-4 sm:p-5 space-y-4">
          <Card
            title={SECTION_META.BASICS.label}
            accent={SECTION_META.BASICS.accent}
          >
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
                  <UploadsSection
                    coverFile={coverFile}
                    pdfFile={pdfFile}
                    onCoverChange={setCoverFile}
                    onPdfChange={setPdfFile}
                  />
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
      <div className="rounded-2xl border bg-white/90">
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
                <div className="text-sm font-medium">
                  {SECTION_META[k].label}
                </div>
                <button
                  onClick={() => addSection(k)}
                  className="rounded-md border px-3 py-1 text-xs hover:bg-white"
                >
                  Add
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* Final checklist */}
      <div className="rounded-2xl border bg-white p-4">
        <FinalChecklist checklist={checklist} />
      </div>
    </div>
  );
}

// ✅ Reusable card component
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
