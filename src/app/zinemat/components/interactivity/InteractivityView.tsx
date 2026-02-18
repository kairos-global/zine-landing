"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import toast from "react-hot-toast";

import BasicsSection, { Basics } from "./BasicsSection";
import UploadsSection from "./UploadsSection";
import InteractivitySection, { InteractiveLink } from "./InteractivitySection";
import DistributionSection, { Distribution } from "./DistributionSection";
import FinalChecklist from "./FinalChecklist";

const AUTOSAVE_DEBOUNCE_MS = 1800;

type SectionKey = "BASICS" | "UPLOAD" | "INTERACTIVITY" | "DISTRIBUTION";

const SECTION_META: Record<
  SectionKey,
  { label: string; accent: string; required?: boolean }
> = {
  BASICS: { label: "A) Basics", accent: "#65CBF1", required: true },
  UPLOAD: { label: "B) Uploads", accent: "#F2DC6F" },
  INTERACTIVITY: { label: "C) Interactivity", accent: "#82E385" },
  DISTRIBUTION: { label: "D) Distribution", accent: "#F4A261" },
};

export default function InteractivityView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("id") ?? null;
  const { isSignedIn, user } = useUser();

  const [basics, setBasics] = useState<Basics>({ title: "" });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);
  const [links, setLinks] = useState<InteractiveLink[]>([]);
  const [distribution, setDistribution] = useState<Distribution>({
    self_distribute: false,
    print_for_me: false,
  });
  const [hasPayment, setHasPayment] = useState<boolean>(false);
  const [active, setActive] = useState<SectionKey[]>(["BASICS"]);
  const [loading, setLoading] = useState<boolean>(!!editId);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState<string | null>(null);
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState<string | null>(null);
  const [coverCleared, setCoverCleared] = useState(false);
  const [pdfCleared, setPdfCleared] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // Stable issueId for new zines (so autosave always targets the same draft)
  const newIssueIdRef = useRef<string | null>(null);
  const issueId = editId ?? newIssueIdRef.current ?? (newIssueIdRef.current = crypto.randomUUID());

  // ✅ Load existing issue via API
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        console.log("📖 [ZineMat] Loading issue:", editId);
        
        // Check URL params for payment success
        const paymentStatus = searchParams?.get("payment");
        if (paymentStatus === "success") {
          toast.success("Payment successful! You can now publish with print-for-me distribution.");
          // Clean URL
          router.replace(`/zinemat?id=${editId}`, { scroll: false });
        } else if (paymentStatus === "cancelled") {
          toast.error("Payment was cancelled.");
          router.replace(`/zinemat?id=${editId}`, { scroll: false });
        }
        
        const response = await fetch(`/api/zinemat/load?id=${editId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error("❌ [ZineMat] Load error:", errorData);
          toast.error(errorData.error || "Could not load issue.");
          setLoading(false);
          return;
        }

        const data = await response.json();
        console.log("✅ [ZineMat] Loaded issue:", data);

        if (data.issue) {
          setBasics({ title: data.issue.title ?? "" });
          setExistingCoverUrl(data.issue.cover_img_url);
          setExistingPdfUrl(data.issue.pdf_url);
          setCoverCleared(false);
          setPdfCleared(false);
          
          // Load distribution settings
          setDistribution({
            self_distribute: data.issue.self_distribute ?? false,
            print_for_me: data.issue.print_for_me ?? false,
          });

          // Always check payment status when issue exists (not just if print_for_me is true)
          // This handles cases where user paid but hasn't published yet
          const paymentRes = await fetch(`/api/payments/check?issueId=${editId}`);
          if (paymentRes.ok) {
            const paymentData = await paymentRes.json();
            setHasPayment(paymentData.hasPayment || false);
            // If payment exists but print_for_me isn't set, enable it
            if (paymentData.hasPayment && !data.issue.print_for_me) {
              setDistribution(prev => ({ ...prev, print_for_me: true }));
            }
          }
        }

        if (data.links) {
          setLinks(
            data.links.map((l: { id: string; label: string; url: string; redirect_path: string; qr_path: string | null }) => ({
              id: l.id,
              label: l.label,
              url: l.url,
              generateQR: !!l.qr_path,
              redirect_path: l.redirect_path,
              qr_path: l.qr_path,
            }))
          );
        }

        setLoading(false);
      } catch (err) {
        console.error("❌ [ZineMat] Unexpected error:", err);
        toast.error("Could not load issue.");
        setLoading(false);
      }
    })();
  }, [editId]);

  // Direct upload to Supabase when user selects a file (avoids sending large body through our API)
  useEffect(() => {
    if (!coverFile || !user) return;
    let cancelled = false;
    setUploadingCover(true);
    (async () => {
      try {
        const res = await fetch("/api/zinemat/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueId,
            type: "cover",
            contentType: coverFile.type,
          }),
        });
        if (!res.ok || cancelled) return;
        const { token, path, publicUrl } = await res.json();
        if (cancelled) return;
        const { error } = await supabase.storage
          .from("zineground")
          .uploadToSignedUrl(path, token, coverFile, { upsert: true });
        if (error) throw error;
        if (!cancelled) setUploadedCoverUrl(publicUrl);
      } catch (err) {
        if (!cancelled) {
          console.error("Cover upload error:", err);
          toast.error(err instanceof Error ? err.message : "Cover upload failed.");
        }
      } finally {
        if (!cancelled) setUploadingCover(false);
      }
    })();
    return () => { cancelled = true; };
  }, [coverFile, issueId, user, supabase]);

  useEffect(() => {
    if (!pdfFile || !user) return;
    let cancelled = false;
    setUploadingPdf(true);
    (async () => {
      try {
        const res = await fetch("/api/zinemat/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueId, type: "pdf" }),
        });
        if (!res.ok || cancelled) return;
        const { token, path, publicUrl } = await res.json();
        if (cancelled) return;
        const { error } = await supabase.storage
          .from("zineground")
          .uploadToSignedUrl(path, token, pdfFile, { upsert: true });
        if (error) throw error;
        if (!cancelled) setUploadedPdfUrl(publicUrl);
      } catch (err) {
        if (!cancelled) {
          console.error("PDF upload error:", err);
          toast.error(err instanceof Error ? err.message : "PDF upload failed.");
        }
      } finally {
        if (!cancelled) setUploadingPdf(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfFile, issueId, user, supabase]);

  // ✅ Checklist validation (Publish requires all basics + upload fields)
  const checklist = useMemo(() => {
    const basicsOk = basics.title.trim().length > 0;
    const coverOk = !!(existingCoverUrl || uploadedCoverUrl || coverFile);
    return { basics: basicsOk, cover: coverOk };
  }, [basics.title, existingCoverUrl, uploadedCoverUrl, coverFile]);

  const canPublish = checklist.basics && checklist.cover;

  const addSection = (key: SectionKey) =>
    setActive((cur) => (cur.includes(key) ? cur : [...cur, key]));
  const removeSection = (key: SectionKey) =>
    setActive((cur) => cur.filter((k) => k !== key));

  const handleCoverChange = useCallback((file: File | null) => {
    setCoverFile(file);
    if (file) {
      setCoverCleared(false);
      setUploadedCoverUrl(null);
    } else {
      setUploadedCoverUrl(null);
      setCoverCleared(true);
    }
  }, []);
  const handlePdfChange = useCallback((file: File | null) => {
    setPdfFile(file);
    if (file) {
      setPdfCleared(false);
      setUploadedPdfUrl(null);
    } else {
      setUploadedPdfUrl(null);
      setPdfCleared(true);
    }
  }, []);

  // Build FormData for save — send URLs from direct upload only (no file bodies to avoid timeouts)
  const buildSaveFormData = useCallback(() => {
    const formData = new FormData();
    formData.append("title", basics.title.trim() || "Untitled");
    formData.append("issueId", issueId);
    if (coverCleared) formData.append("cover_url", "");
    else if (uploadedCoverUrl) formData.append("cover_url", uploadedCoverUrl);
    if (pdfCleared) formData.append("pdf_url", "");
    else if (uploadedPdfUrl) formData.append("pdf_url", uploadedPdfUrl);
    formData.append("interactiveLinks", JSON.stringify(links));
    formData.append("distribution", JSON.stringify(distribution));
    return formData;
  }, [basics.title, issueId, coverCleared, uploadedCoverUrl, pdfCleared, uploadedPdfUrl, links, distribution]);

  const SAVE_TIMEOUT_MS = 90_000; // 90s for large PDFs

  // Perform save (saved state) — returns success
  const performSave = useCallback(async (): Promise<boolean> => {
    const formData = buildSaveFormData();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
    try {
      const res = await fetch("/api/zinemat/save", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      let result: { error?: string; message?: string };
      try {
        result = await res.json();
      } catch {
        result = {};
      }
      if (!res.ok) {
        const msg = result.error || result.message || "Something went wrong.";
        toast.error(msg);
        return false;
      }
      return true;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        toast.error("Save timed out. Try again or use a smaller PDF.");
        return false;
      }
      toast.error(err instanceof Error ? err.message : "Save failed.");
      return false;
    }
  }, [buildSaveFormData]);

  // ✅ Autosave: debounced save when any field changes
  const autosaveTriggerRef = useRef(false);
  useEffect(() => {
    if (!user || loading) return;
    // Skip the first mount so we don't save an empty form on load
    if (!autosaveTriggerRef.current) {
      autosaveTriggerRef.current = true;
      return;
    }
    const timer = setTimeout(async () => {
      const ok = await performSave();
      // After first successful save of a new zine, add id to URL so refresh loads from DB
      if (ok && !editId) {
        router.replace(`/zinemat?id=${issueId}`, { scroll: false });
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [user, loading, editId, issueId, basics.title, uploadedCoverUrl, uploadedPdfUrl, links, distribution, performSave, router]);

  // Save button: save then go to My Library
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const ok = await performSave();
      if (ok) {
        toast.success("Changes saved!");
        setTimeout(() => router.push("/dashboard/library"), 800);
      }
    } finally {
      setSaving(false);
    }
  };

  // Publish button: save then publish then go to Browse zines
  const handlePublish = async () => {
    if (!user || !canPublish) return;
    setPublishing(true);
    try {
      const formData = buildSaveFormData();
      const res = await fetch("/api/zinemat/publish", { method: "POST", body: formData });
      let result: { error?: string; message?: string } = {};
      try {
        result = await res.json();
      } catch {
        /* non-JSON response */
      }
      if (!res.ok) {
        const msg = result.error || result.message || "Something went wrong.";
        toast.error(msg);
        return;
      }
      toast.success("Published successfully!");
      setTimeout(() => router.push("/browse-zines"), 800);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setPublishing(false);
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

  const slug = basics.title?.toLowerCase().replace(/\s+/g, "-") ?? "";
  const uploadInProgress = Boolean(
    (coverFile && !uploadedCoverUrl) || (pdfFile && !uploadedPdfUrl)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold">Interactivity</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || uploadInProgress}
            className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-50"
          >
            {saving ? "Saving…" : uploadInProgress ? "Uploading…" : "Save"}
          </button>
          <button
            onClick={handlePublish}
            disabled={!canPublish || publishing || uploadInProgress}
            className={`rounded-xl px-3 py-1 text-sm font-medium ${
              canPublish && !publishing && !uploadInProgress ? "bg-[#65CBF1]" : "bg-gray-300 text-gray-600"
            }`}
          >
            {publishing ? "Publishing…" : uploadInProgress ? "Uploading…" : "Publish"}
          </button>
        </div>
      </div>

      {/* Section Cards */}
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
                    onCoverChange={handleCoverChange}
                    onPdfChange={handlePdfChange}
                    existingCoverUrl={existingCoverUrl}
                    existingPdfUrl={existingPdfUrl}
                  />
                )}
                {k === "INTERACTIVITY" && (
                  <InteractivitySection
                    links={links}
                    onChange={setLinks}
                    issueId={editId}
                    slug={slug}
                    siteUrl={process.env.NEXT_PUBLIC_SITE_URL}
                  />
                )}
                {k === "DISTRIBUTION" && (
                  <DistributionSection
                    value={distribution}
                    onChange={setDistribution}
                    issueId={editId || undefined}
                    hasPayment={hasPayment}
                  />
                )}
              </Card>
            ))}
        </div>
      </div>

      {/* Add New Sections */}
      <div className="rounded-2xl border bg-white/90">
        <div className="px-4 py-3 border-b font-semibold text-sm">Toolkit</div>
        <div className="p-4 grid gap-3 sm:grid-cols-2">
          {(["UPLOAD", "INTERACTIVITY", "DISTRIBUTION"] as SectionKey[])
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

      {/* Final Checklist */}
      <div className="rounded-2xl border bg-white p-4">
        <FinalChecklist checklist={checklist} />
      </div>
    </div>
  );
}

// ✅ Reusable Card
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
