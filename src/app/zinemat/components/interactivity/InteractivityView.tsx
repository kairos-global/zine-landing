"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import toast from "react-hot-toast";

import BasicsSection, { type Basics, type ZineFormat } from "./BasicsSection";
import { isZineCategoryKey, type ZineCategoryKey } from "@/lib/zine-categories";
import { withViewMap, type ViewMap } from "@/lib/zine-view-map";
import UploadsSection from "./UploadsSection";
import InteractivitySection from "./InteractivitySection";
import { builtInQrLabels } from "@/lib/zine-qr";
import { pdfHasQrPlacement, withQrPlacement, type QrPlacement } from "@/lib/zine-qr-placement";
import QrPlacementDialog from "./QrPlacementDialog";
import DistributionSection, { type Distribution } from "./DistributionSection";
import FinalChecklist from "./FinalChecklist";
import ZineCanvas from "../canvas/ZineCanvas";
import { canvasHasArtwork, exportArtwork, newCanvas, type CanvasState } from "../canvas/canvas-art";

const AUTOSAVE_DEBOUNCE_MS = 1800;
const initialDistribution = { self_distribute: false, print_for_me: false, max_copies_per_order: 50, auto_approve_quantity: 20 };
const emptyAssets: { cover: string | null; pdf: string | null } = { cover: null, pdf: null };
const sections = {
  basics: { label: "A) Basics", accent: "#65CBF1" },
  artwork: { label: "B) Uploads", accent: "#F2DC6F" },
  links: { label: "C) Interactivity", accent: "#82E385" },
  distribution: { label: "D) Distribution", accent: "#D16FF2" },
};
const toolkit = ["links", "distribution"] as const;

export type WorkspaceMode = "upload" | "create";
type Section = keyof typeof sections;
type SaveStatus = "idle" | "saving" | "saved" | "error";
type Issue = {
  title: string;
  zine_format: ZineFormat;
  category: string | null;
  cover_img_url: string | null;
  pdf_url: string | null;
  self_distribute: boolean;
  print_for_me: boolean;
  max_copies_per_order: number;
  auto_approve_quantity: number;
  has_canvas: boolean;
};

function draftForm(basics: Basics, mode: WorkspaceMode, category: ZineCategoryKey | null, files: typeof emptyAssets, distribution: Distribution) {
  return {
    title: basics.title.trim() || (mode === "create" ? "Untitled canvas" : "Untitled"),
    zine_format: basics.zine_format,
    category: category ?? "",
    cover_url: files.cover ?? "",
    pdf_url: files.pdf ?? "",
    distribution: JSON.stringify(distribution),
  };
}

async function checkedJson(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || fallback);
  return data;
}

export default function InteractivityView({ editId, initialMode }: {
  editId: string | null;
  initialMode: WorkspaceMode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [basics, setBasics] = useState<Basics>({ title: "", zine_format: "mini" });
  const [category, setCategory] = useState<ZineCategoryKey | null>(null);
  const [files, setFiles] = useState(emptyAssets);
  const [distribution, setDistribution] = useState<Distribution>(initialDistribution);
  const [canvas, setCanvas] = useState(newCanvas);
  const [active, setActive] = useState<Section[]>(["basics", "artwork"]);
  const [loading, setLoading] = useState(Boolean(editId));
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(editId);
  const [qrIssueId, setQrIssueId] = useState<string | null>(editId);
  const [placingQr, setPlacingQr] = useState<{ src: string; label: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [uploading, setUploading] = useState(false);
  const [importingArtwork, setImportingArtwork] = useState(false);
  const [action, setAction] = useState<"save" | "publish" | null>(null);
  const [pdfPending, setPdfPending] = useState(false);
  const [existingCoverOnly, setExistingCoverOnly] = useState(false);

  const draftId = useRef<string | null>(editId);
  const loadedId = useRef<string | null>(null);
  const lastSavedForm = useRef<string | null>(null);
  const lastSavedCanvas = useRef<CanvasState | null>(null);
  const issueReady = useRef(Boolean(editId));
  const qrReady = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const transfer = useRef(false);
  const manualAction = useRef(false);
  const alive = useRef(true);
  const supabase = useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!editId || loadedId.current === editId || draftId.current === editId && lastSavedForm.current !== null) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void (async () => {
      try {
        const data = await checkedJson(await fetch(`/api/zinemat/load?id=${encodeURIComponent(editId)}`, {
          signal: controller.signal,
        }), "Couldn’t open this zine.");
        const issue: Issue = data.issue;
        let artwork = newCanvas();
        if (issue.has_canvas) {
          const result = await checkedJson(await fetch(`/api/canvas/${encodeURIComponent(editId)}`, {
            signal: controller.signal,
          }), "Couldn’t load the canvas.");
          if (!result.state) throw new Error("Couldn’t load the canvas.");
          artwork = { ...artwork, ...result.state };
        }
        if (controller.signal.aborted) return;
        const create = issue.has_canvas || (issue.zine_format === "mini" &&
          !issue.pdf_url && !issue.cover_img_url && (initialMode === "create" || issue.title === "Untitled canvas"));
        const title = issue.title === "Untitled canvas" && create || issue.title === "Untitled" ? "" : issue.title;
        const nextBasics = { title, zine_format: issue.zine_format };
        const nextCategory = isZineCategoryKey(issue.category) ? issue.category : null;
        const nextFiles = { cover: issue.cover_img_url, pdf: issue.pdf_url };
        const nextDistribution = {
          self_distribute: issue.self_distribute,
          print_for_me: issue.print_for_me,
          max_copies_per_order: issue.max_copies_per_order,
          auto_approve_quantity: issue.auto_approve_quantity,
        };
        const collectionQr = (data.links ?? []).find((link: { label: string; redirect_path?: string }) =>
          link.label === builtInQrLabels.collection && link.redirect_path === `/qr/${editId}/collection`);
        lastSavedForm.current = JSON.stringify(draftForm(nextBasics, create ? "create" : "upload", nextCategory, nextFiles, nextDistribution));
        qrReady.current = Boolean(collectionQr);
        setMode(create ? "create" : "upload");
        setBasics(nextBasics);
        setCategory(nextCategory);
        setFiles(nextFiles);
        setExistingCoverOnly(Boolean(issue.cover_img_url && !issue.pdf_url));
        setDistribution(nextDistribution);
        setQrIssueId(editId);
        setSaveStatus("saved");
        setActive([
          "basics", "artwork",
          ...(collectionQr ? ["links" as const] : []),
          ...(issue.self_distribute || issue.print_for_me ? ["distribution" as const] : []),
        ]);
        setCanvas(artwork);
        lastSavedCanvas.current = issue.has_canvas ? artwork : null;
        issueReady.current = true;
        loadedId.current = editId;
        draftId.current = editId;
        setSavedId(editId);
        setLoading(false);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setLoadError(caught instanceof Error ? caught.message : "Couldn’t open this zine.");
          setLoading(false);
        }
      }
    })();
    return () => controller.abort();
  }, [editId, initialMode, loadAttempt]);

  const titleOk = Boolean(basics.title.trim());
  const artworkOk = mode === "create" ? canvasHasArtwork(canvas, basics.zine_format)
    : Boolean(files.cover && (files.pdf || existingCoverOnly));
  const distributionOk = distribution.self_distribute || distribution.print_for_me;
  const form = useMemo(() => draftForm(basics, mode, category, files, distribution), [basics, category, distribution, files, mode]);

  const formKey = JSON.stringify(form);

  const getDraftId = useCallback(() => draftId.current ?? (draftId.current = crypto.randomUUID()), []);

  const uploadAsset = useCallback(async (type: "cover" | "pdf" | "canvas", blob: Blob) => {
    const { token, path, publicUrl } = await checkedJson(await fetch("/api/zinemat/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issueId: getDraftId(),
        type,
        contentType: blob.type,
        ...(type !== "canvas" ? { revision: crypto.randomUUID() } : {}),
      }),
    }), "Couldn’t prepare the upload.");
    const { error } = await supabase.storage.from("zineground").uploadToSignedUrl(path, token, blob, {
      upsert: true,
      contentType: blob.type,
      cacheControl: type === "canvas" ? "0" : "3600",
    });
    if (error) throw error;
    return publicUrl as string;
  }, [getDraftId, supabase]);

  const sendForm = useCallback(async (values: Record<string, string>, endpoint: "save" | "publish") => {
    const body = new FormData();
    body.set("issueId", getDraftId());
    Object.entries(values).forEach(([key, value]) => body.set(key, value));
    return checkedJson(await fetch(`/api/zinemat/${endpoint}`, { method: "POST", body }), `Couldn’t ${endpoint} this zine.`);
  }, [getDraftId]);

  const save = useCallback(async (intent: "autosave" | "prepare" | "save" | "publish") => {
    const result = queue.current.then(async () => {
      if (!alive.current) return false;
      const canvasChanged = mode === "create" && lastSavedCanvas.current !== canvas;
      const needsGeneratedFiles = mode === "create" && intent === "publish";
      if ((intent === "autosave" || intent === "prepare" && qrReady.current) && lastSavedForm.current === formKey && !canvasChanged) return true;
      setSaveStatus("saving");
      let values = form;

      // Canvas storage requires an owned issue before the first write.
      if (mode === "create" && !issueReady.current) {
        await sendForm(form, "save");
        issueReady.current = true;
        qrReady.current = true;
        lastSavedForm.current = formKey;
      }
      if (canvasChanged) {
        await uploadAsset("canvas", new Blob([JSON.stringify(canvas)], { type: "application/json" }));
        lastSavedCanvas.current = canvas;
      }

      if (needsGeneratedFiles) {
        const output = await exportArtwork(canvas, basics.zine_format);
        const [cover, pdf] = await Promise.all([uploadAsset("cover", output.cover), uploadAsset("pdf", output.pdf)]);
        values = { ...form, cover_url: cover, pdf_url: withViewMap(pdf, basics.zine_format === "mini" ? "mini-center" : "pages") };
      }
      // Serialize writes so a slower draft save can’t overwrite a newer save or publish.
      if (intent === "publish" || intent === "prepare" && !qrReady.current || lastSavedForm.current !== formKey) {
        await sendForm(values, intent === "publish" ? "publish" : "save");
        issueReady.current = true;
        qrReady.current = true;
        lastSavedForm.current = formKey;
      }
      if (alive.current) {
        const id = getDraftId();
        setSavedId(id);
        const url = new URL(window.location.href);
        if (url.searchParams.get("id") !== id || url.searchParams.has("payment")) {
          url.searchParams.set("id", id);
          url.searchParams.delete("payment");
          window.history.replaceState(null, "", url);
        }
        setSaveStatus("saved");
      }
      return true;
    }).catch(caught => {
      if (alive.current) {
        setSaveStatus("error");
        if (intent !== "autosave") toast.error(caught instanceof Error ? caught.message : "Couldn’t save this zine.");
      }
      return false;
    });
    queue.current = result;
    return result;
  }, [basics.zine_format, canvas, form, formKey, getDraftId, mode, sendForm, uploadAsset]);

  const prepareQr = useCallback(() => save("prepare"), [save]);

  const baseline = useRef<{ form: string; canvas: CanvasState } | null>(null);
  useEffect(() => {
    if (loading || loadError || action || uploading) return;
    if (!baseline.current) {
      baseline.current = { form: formKey, canvas };
      return;
    }
    if (!lastSavedForm.current && baseline.current.form === formKey && baseline.current.canvas === canvas) return;
    if (lastSavedForm.current === formKey && (mode !== "create" || lastSavedCanvas.current === canvas)) return;
    const timer = window.setTimeout(() => {
      if (!manualAction.current && !transfer.current) void save("autosave");
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [action, canvas, formKey, loadError, loading, mode, save, uploading]);

  function toggle(section: Section) {
    if (section === "links" && !qrIssueId) setQrIssueId(getDraftId());
    setActive(previous => previous.includes(section) ? previous.filter(key => key !== section) : [...previous, section]);
  }

  async function transferFiles(update: () => Promise<typeof emptyAssets>) {
    if (transfer.current || manualAction.current) return false;
    setUploading(true);
    transfer.current = true;
    try {
      const updated = await update();
      setFiles(updated);
      return true;
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Upload failed. Try again.");
      return false;
    } finally {
      transfer.current = false;
      setUploading(false);
    }
  }

  function setCover(file: File | null) {
    return transferFiles(async () => ({ ...files, cover: file ? await uploadAsset("cover", file) : null }));
  }

  function applyMap(file: File | null, map: ViewMap, cover: Blob) {
    return transferFiles(async () => {
      const [pdf, coverUrl] = await Promise.all([
        file ? uploadAsset("pdf", new Blob([file], { type: "application/pdf" })) : files.pdf,
        uploadAsset("cover", cover),
      ]);
      if (!pdf) throw new Error("Choose a PDF first.");
      return { cover: coverUrl, pdf: withViewMap(pdf, map) };
    });
  }

  function applyQr(page: number, placement: QrPlacement, pdf?: Blob) {
    if (pdf) {
      return transferFiles(async () => {
        const url = await uploadAsset("pdf", pdf);
        const hash = files.pdf?.split("#")[1];
        return { ...files, pdf: withQrPlacement(hash ? `${url}#${hash}` : url) };
      });
    }
    const code = { ...placement, id: crypto.randomUUID() };
    setCanvas(previous => ({
      ...previous,
      pages: previous.pages.map((item, index) => index === page - 1
        ? { ...item, qrCodes: [...item.qrCodes ?? [], code] }
        : item),
    }));
    return Promise.resolve(true);
  }

  async function finish(intent: "save" | "publish") {
    if (manualAction.current || transfer.current || importingArtwork || pdfPending || (intent === "publish" && (!titleOk || !artworkOk))) return;
    manualAction.current = true;
    setAction(intent);
    if (await save(intent)) {
      toast.success(intent === "publish" ? "Published successfully!" : "Changes saved!");
      router.push(intent === "publish" ? "/browse-zines" : "/dashboard/library");
      return;
    }
    manualAction.current = false;
    setAction(null);
  }

  if (loading) return <p className="p-5 text-sm" role="status">Opening ZineMat…</p>;
  if (loadError) return (
    <div className="space-y-3 p-3">
      <p role="alert" className="text-sm text-red-700">{loadError}</p>
      <button type="button" onClick={() => setLoadAttempt(attempt => attempt + 1)} className="min-h-11 rounded-xl border px-3 text-sm">Try again</button>
    </div>
  );

  const busy = action !== null || uploading || importingArtwork;
  const artworkLabel = mode === "create" ? "B) Canvas" : sections.artwork.label;
  const alternate = mode === "create" ? "upload" : "create";
  const alternateUrl = `/zinemat?mode=${alternate}`;
  const editing = Boolean(savedId);
  const previousForm = lastSavedForm.current ?? baseline.current?.form;
  const formChanged = previousForm != null && formKey !== previousForm;
  const previousCanvas = lastSavedCanvas.current ?? baseline.current?.canvas;
  const canvasChanged = mode === "create" && previousCanvas != null && canvas !== previousCanvas;
  const hasChanges = formChanged || canvasChanged;
  const interactivityApplied = mode === "create" ? canvas.pages.some(page => page.qrCodes?.length) : pdfHasQrPlacement(files.pdf);
  const canPlace = mode === "create" || Boolean(files.pdf && !pdfPending);
  let statusText = "Not saved";
  if (saveStatus !== "error") {
    if (saveStatus === "saving" || uploading || (!pdfPending && hasChanges)) statusText = "Saving…";
    else if (savedId && !pdfPending) statusText = "Saved";
  }

  async function switchMode(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (busy || pdfPending) {
      event.preventDefault();
      if (pdfPending) toast.error("Apply the view map or cancel the PDF change first.");
      return;
    }
    if (!hasChanges) return;
    event.preventDefault();
    manualAction.current = true;
    setAction("save");
    if (await save("save")) router.push(alternateUrl);
    else {
      manualAction.current = false;
      setAction(null);
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">ZineMat</h1>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <label className="sr-only" htmlFor="zinemat-workspace-title">Zine title</label>
          <input id="zinemat-workspace-title" disabled={action !== null} value={basics.title}
            onChange={event => setBasics(previous => ({ ...previous, title: event.target.value }))}
            placeholder="Untitled zine" className="min-h-11 w-40 min-w-0 rounded-xl border bg-white px-3 text-base sm:w-60" />
          <span className={`min-w-[5.25rem] text-sm ${statusText === "Saved" ? "text-green-800" : saveStatus === "error" ? "text-red-700" : "text-gray-600"}`} role="status">{statusText}</span>
        </div>
      </div>
      <nav className="grid grid-cols-2 gap-2 rounded-xl border bg-white/90 p-1" aria-label="ZineMat workspace">
        {(["upload", "create"] as const).map(item => {
          const label = item === "upload" ? "Upload" : "Create";
          const style = "flex min-h-11 items-center justify-center rounded-lg px-2 text-center text-sm font-semibold";
          return item === mode
            ? <span key={item} className={`${style} bg-[#65CBF1]/25 ring-1 ring-inset ring-[#65CBF1]`} aria-current="page">{label}</span>
            : <Link key={item} href={alternateUrl} onClick={switchMode} className={`${style} hover:bg-gray-50`} aria-label={editing ? `${label} a new zine` : label}>{label}{editing && <span className="sr-only"> a new zine</span>}</Link>;
        })}
      </nav>
      <fieldset disabled={action !== null} className="min-w-0 space-y-3">
        <Card section="basics" expanded={active.includes("basics")} onToggle={toggle}>
          <BasicsSection value={basics} onChange={setBasics} category={category} onCategoryChange={setCategory} />
        </Card>
        <Card section="artwork" title={artworkLabel} expanded={active.includes("artwork")} onToggle={toggle}>
          {interactivityApplied && <p role="status" className="mb-3 text-sm text-green-800">Interactivity applied</p>}
          {mode === "create"
            ? <ZineCanvas state={canvas} format={basics.zine_format} title={basics.title} onChange={setCanvas} onImportingChange={setImportingArtwork} />
            : <UploadsSection coverUrl={files.cover} pdfUrl={files.pdf} format={basics.zine_format} busy={busy} onCover={setCover} onPdf={applyMap} onPending={setPdfPending} />}
        </Card>
        <section className="space-y-3 rounded-2xl border bg-white/90 p-2 sm:p-3">
          <h2 className="px-2 text-sm font-semibold">Toolkit</h2>
          {toolkit.map(section => (
            <Card key={section} section={section} expanded={active.includes(section)} onToggle={toggle}>
              {section === "links" ? (
                <InteractivitySection
                  issueId={qrIssueId}
                  canPlace={canPlace && !busy}
                  prepare={prepareQr}
                  onPlace={(src, label) => setPlacingQr({ src, label })}
                />
              ) : <DistributionSection value={distribution} onChange={setDistribution} />}
            </Card>
          ))}
        </section>
      </fieldset>
      {placingQr && canPlace && (
        <QrPlacementDialog code={placingQr} source={mode === "create" ? { canvas, format: basics.zine_format } : { url: files.pdf!, format: basics.zine_format }}
          onClose={() => setPlacingQr(null)} onApply={applyQr} />
      )}

      <div className="space-y-4 rounded-2xl border bg-white p-3 sm:p-4">
        <FinalChecklist mode={mode} coverOnly={existingCoverOnly && !files.pdf} checklist={{ basics: titleOk, artwork: artworkOk && !pdfPending, interactivity: interactivityApplied || qrReady.current, distribution: distributionOk }} />
        {saveStatus === "error" && <p className="text-xs text-red-700">Draft save failed. Select Save to retry.</p>}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" onClick={() => void finish("save")} disabled={busy || pdfPending}
            className="min-h-11 rounded-xl border px-4 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            {action === "save" ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => void finish("publish")} disabled={busy || !titleOk || !artworkOk || pdfPending}
            className="min-h-11 rounded-xl bg-[#65CBF1] px-4 text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-600">
            {action === "publish" ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ section, title, expanded, onToggle, children }: {
  section: Section;
  title?: string;
  expanded: boolean;
  onToggle: (section: Section) => void;
  children: React.ReactNode;
}) {
  const { label, accent } = sections[section];
  return (
    <section className="min-w-0 rounded-2xl border bg-white shadow-sm" style={{ borderColor: `${accent}66` }}>
      <h2>
        <button type="button" aria-expanded={expanded} aria-controls={`zinemat-${section}`} onClick={() => onToggle(section)}
          className={`flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold ${expanded ? "rounded-t-2xl border-b" : "rounded-2xl"}`}
          style={{ backgroundColor: `${accent}22`, borderColor: `${accent}66` }}>
          {title ?? label}
          <span className="text-base leading-none" aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
      </h2>
      <div id={`zinemat-${section}`} hidden={!expanded} className="min-w-0 p-2.5 sm:p-3">
        {(expanded || section === "artwork") && children}
      </div>
    </section>
  );
}
