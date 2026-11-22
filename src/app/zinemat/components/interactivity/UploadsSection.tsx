"use client";

import { useEffect, useRef, useState } from "react";
import { isMiniSheet, mapFromPdfUrl, miniMapIds, miniMaps, miniPanel, type ViewMap } from "@/lib/zine-view-map";
import { canvasJpeg, openZinePdf, renderPdfPage } from "@/lib/zine-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";

const control = "min-h-11 rounded-lg border border-yellow-300 px-3 text-sm font-medium disabled:opacity-40";

export default function UploadsSection({
  coverUrl, pdfUrl, format, busy, onCover, onPdf, onPending,
}: {
  coverUrl: string | null;
  pdfUrl: string | null;
  format: "mini" | "half_letter";
  busy: boolean;
  onCover: (file: File | null) => Promise<boolean>;
  onPdf: (file: File | null, map: ViewMap, cover: Blob) => Promise<boolean>;
  onPending: (pending: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [map, setMap] = useState<ViewMap>("pages");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<{ pdf: PDFDocumentProxy; first: HTMLCanvasElement; mini: boolean } | null>(null);
  const [opening, setOpening] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const holder = useRef<HTMLDivElement>(null);
  const savedMap = pdfUrl && (mapFromPdfUrl(pdfUrl) ?? (format === "mini" ? "mini-center" : "pages"));
  const source = file ?? pdfUrl?.split("#")[0];
  const pending = Boolean(file || (preview && map !== savedMap && preview.mini));

  useEffect(() => { onPending(pending); }, [pending, onPending]);

  useEffect(() => {
    let active = true;
    let task: Awaited<ReturnType<typeof openZinePdf>> | undefined;
    setPreview(null);
    setPage(1);
    if (!source) return;
    setOpening(true);
    setError("");
    void (async () => {
      try {
        task = await openZinePdf(source);
        if (!active) {
          await task.destroy();
          return;
        }
        const pdf = await task.promise;
        const first = await renderPdfPage(pdf, 1);
        if (!active) return;
        const mini = isMiniSheet(pdf.numPages, first.width, first.height);
        setPreview({ pdf, first: first.canvas, mini });
        setMap(mini ? file ? "mini-center" : savedMap || "pages" : "pages");
      } catch {
        if (active) setError("Couldn’t open this PDF. Choose an unlocked PDF and try again.");
      } finally {
        if (active) setOpening(false);
      }
    })();
    return () => {
      active = false;
      if (task) void task.destroy().catch(() => {});
    };
    // Update the preview only when the underlying file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  useEffect(() => {
    const target = holder.current;
    if (!preview || !target) return;
    let active = true;
    const canvas = map !== "pages" ? miniPanel(preview.first, map, page)
      : page === 1 ? preview.first : null;
    target.replaceChildren();
    if (canvas) target.append(canvas);
    else void renderPdfPage(preview.pdf, page).then(result => {
      if (active) target.replaceChildren(result.canvas);
    }).catch(() => { if (active) setError("Couldn’t preview this page."); });
    return () => { active = false; };
  }, [preview, map, page]);

  async function apply() {
    if (!preview) return;
    setError("");
    setApplying(true);
    try {
      const cover = await canvasJpeg(map === "pages" ? preview.first : miniPanel(preview.first, map, 1));
      if (await onPdf(file, map, cover)) setFile(null);
    } catch {
      setError("Couldn’t generate the cover from page one.");
    } finally {
      setApplying(false);
    }
  }

  const working = busy || applying;
  const count = preview ? map === "pages" ? preview.pdf.numPages : 8 : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-yellow-900">Zine PDF</h3>
          {pdfUrl && <a className="inline-flex min-h-11 items-center text-sm font-medium underline" href={pdfUrl.split("#")[0]} target="_blank" rel="noreferrer">Open saved PDF</a>}
        </div>
        <label className="block cursor-pointer rounded-xl border-2 border-dashed border-yellow-300 bg-white p-3 text-center text-sm font-semibold text-yellow-900 focus-within:ring-2 focus-within:ring-yellow-500">
          <span className="break-all">{file?.name ?? (pdfUrl ? "Replace PDF" : "Choose a PDF")}</span>
          <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={working} onChange={event => {
            const next = event.target.files?.[0];
            event.target.value = "";
            if (!next) return;
            if (next.size > 50 * 1024 * 1024) {
              setError("Choose a PDF under 50 MB.");
              return;
            }
            setFile(next);
          }} />
        </label>
        {file && <button type="button" disabled={working} onClick={() => { setFile(null); setOpening(false); setError(""); }} className="mt-2 min-h-11 px-2 text-sm underline disabled:opacity-40">{pdfUrl ? "Cancel replacement" : "Cancel PDF selection"}</button>}
        {opening && <p className="mt-2 text-sm" role="status">Opening PDF…</p>}
        {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      </div>

      {preview && (
        <div className="grid min-w-0 gap-4 rounded-xl border border-yellow-200 p-3 sm:p-4">
          <div className="min-w-0 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">View map</h3>
              <p className="mt-1 text-xs text-gray-600">Choose how readers turn the pages. Page 1 becomes the cover.</p>
            </div>
            <div className={`grid gap-2 ${preview.mini ? "grid-cols-3" : ""}`} role="group" aria-label="Reading order">
              <button type="button" className={`${control} min-w-0 px-1.5 py-2 text-left sm:px-3 ${map === "pages" ? "bg-[#F2DC6F]/40" : ""}`} aria-pressed={map === "pages"} disabled={working} onClick={() => { setMap("pages"); setPage(1); }}>
                PDF order <span className="block text-xs text-gray-600">{preview.pdf.numPages} {preview.pdf.numPages === 1 ? "page" : "pages"} as uploaded</span>
              </button>
              {preview.mini && miniMapIds.map(id => (
                <button type="button" key={id} className={`${control} min-w-0 px-1.5 py-2 text-left sm:px-3 ${map === id ? "bg-[#F2DC6F]/40" : ""}`} aria-pressed={map === id} disabled={working} onClick={() => { setMap(id); setPage(1); }}>
                  {miniMaps[id].label}
                  <span className="mt-2 grid grid-cols-4 gap-px overflow-hidden rounded border border-yellow-300 bg-yellow-300 text-center text-xs" aria-hidden="true">
                    {miniMaps[id].order.map((number, index) => (
                      <span key={number} className={`py-1 ${number === 1 ? "bg-[#F2DC6F] font-bold" : "bg-white"}`}>
                        <span className={`inline-block ${index < 4 ? "rotate-180" : ""}`}>{number}</span>
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
            {!pending && pdfUrl && coverUrl && <p role="status" className="text-sm text-green-800">View map applied</p>}
            {pending && !file && savedMap && <button type="button" disabled={working} onClick={() => { setMap(savedMap); setPage(1); }} className="min-h-11 text-sm underline disabled:opacity-40">Reset map</button>}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1" aria-label="PDF preview pages">
              <button type="button" className={control} disabled={page <= 1} onClick={() => setPage(page - 1)}>Back</button>
              <span className="text-xs font-medium" aria-live="polite">Page {page} of {count}</span>
              <button type="button" className={control} disabled={page >= count} onClick={() => setPage(page + 1)}>Next</button>
            </div>
            <div ref={holder} role="img" aria-label={`PDF preview, page ${page}`} className="grid min-h-32 place-items-center overflow-hidden rounded-lg bg-gray-50 p-2 [&>canvas]:h-auto [&>canvas]:max-h-[26rem] [&>canvas]:max-w-full [&>canvas]:object-contain" />
          </div>
          {(pending || !coverUrl) && <button type="button" onClick={() => void apply()} disabled={working} className={`${control} bg-[#F2DC6F]`}>
            {applying ? "Applying view map…" : "Apply view map"}
          </button>}
        </div>
      )}

      <div className="rounded-xl border border-yellow-200 bg-white p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-yellow-900">Cover</h3>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="Current zine cover" className="max-h-24 max-w-24 rounded border border-yellow-200 object-contain" />
          )}
          <div className="space-y-2">
            <p className="text-xs text-gray-600">Use page 1 or choose your own image.</p>
            <label className={`${control} inline-flex cursor-pointer items-center focus-within:ring-2 focus-within:ring-yellow-500`}>
              {coverUrl ? "Replace cover" : "Upload cover"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={working} onChange={event => {
                const next = event.target.files?.[0];
                if (next) void onCover(next);
                event.target.value = "";
              }} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
