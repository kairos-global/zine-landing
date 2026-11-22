"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { openZinePdf, renderPdfPage } from "@/lib/zine-pdf";
import { isMiniSheet, mapFromPdfUrl, miniPanel, type ViewMap } from "@/lib/zine-view-map";
import ZineIcon from "@/components/ZineIcon";

type DocumentView = { pdf: PDFDocumentProxy; map: ViewMap; imposed: boolean };
const viewButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium disabled:opacity-40";
const overviewSize = 8;

export default function ReaderArtwork({ pdfUrl, format, cover, title, initialView }: {
  pdfUrl: string | null;
  format: string | null;
  cover: string | null;
  title: string;
  initialView: "mapped" | "top";
}) {
  const [mode, setMode] = useState(initialView);
  const [page, setPage] = useState(1);
  const [overview, setOverview] = useState(0);
  const [doc, setDoc] = useState<DocumentView | null>(null);
  const [openError, setOpenError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sheet = useRef<Promise<HTMLCanvasElement> | null>(null);
  const swipeStart = useRef<number | null>(null);

  useEffect(() => {
    setDoc(null);
    setOpenError(false);
    sheet.current = null;
    if (!pdfUrl) return;
    let active = true;
    let task: Awaited<ReturnType<typeof openZinePdf>> | undefined;
    void (async () => {
      try {
        task = await openZinePdf(pdfUrl);
        if (!active) { await task.destroy(); return; }
        const pdf = await task.promise;
        const viewport = (await pdf.getPage(1)).getViewport({ scale: 1 });
        const imposed = isMiniSheet(pdf.numPages, viewport.width, viewport.height);
        const map = imposed ? mapFromPdfUrl(pdfUrl) ?? (format === "mini" ? "mini-center" : "pages") : "pages";
        if (active) setDoc({ pdf, map, imposed });
      } catch {
        if (active) setOpenError(true);
      }
    })();
    return () => {
      active = false;
      if (task) void task.destroy().catch(() => {});
    };
  }, [pdfUrl, format, attempt]);

  function show(next: "mapped" | "top") {
    setMode(next);
    if (next === "top" && doc?.map === "pages") setOverview(Math.floor((page - 1) / overviewSize));
    const url = new URL(window.location.href);
    if (next === "top") url.searchParams.set("view", "top");
    else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url);
  }

  const count = doc ? (doc.map === "pages" ? doc.pdf.numPages : 8) : 0;
  const topCount = doc ? Math.ceil(doc.pdf.numPages / overviewSize) : 0;
  const virtualPage = Math.min(page, count || 1);
  const pageLabel = doc?.map !== "pages" && virtualPage === 1 ? "Cover"
    : doc?.map !== "pages" && virtualPage === count ? "Back cover" : `Page ${virtualPage}`;

  function move(direction: number) {
    setPage(previous => Math.max(1, Math.min(count, previous + direction)));
  }

  return (
    <section aria-label="Digital copy" className="min-w-0 rounded-xl border bg-white p-3 sm:p-4 print:hidden">
      {pdfUrl && (
        <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Reader view" role="group">
          <button type="button" className={`${viewButton} ${mode === "mapped" ? "border-black bg-[#AAEEFF]" : "border-gray-300 hover:bg-gray-50"}`} aria-pressed={mode === "mapped"} onClick={() => show("mapped")}><ZineIcon name="book" />Mapped View</button>
          <button type="button" className={`${viewButton} ${mode === "top" ? "border-black bg-[#AAEEFF]" : "border-gray-300 hover:bg-gray-50"}`} aria-pressed={mode === "top"} onClick={() => show("top")}><ZineIcon name="sheet" />Top View</button>
        </div>
      )}
      {(!doc || openError) && (
        <div className="grid min-h-36 place-items-center gap-2 rounded-lg bg-neutral-100 p-3">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={`Cover of ${title}`} className="max-h-[62dvh] max-w-full object-contain" draggable={false} />
          )}
          {pdfUrl && !openError && <p role="status" className="text-sm text-gray-600">Opening the zine…</p>}
          {openError && <div className="text-center text-sm"><p role="alert">Couldn’t open the digital copy.</p><button type="button" className="min-h-10 underline" onClick={() => setAttempt(n => n + 1)}>Try again</button></div>}
          {!pdfUrl && <p className="text-sm text-gray-600">Digital copy unavailable.</p>}
        </div>
      )}
      {doc && mode === "mapped" && (
        <>
          <div className="grid min-h-36 place-items-center rounded-lg bg-neutral-100 p-2 focus-visible:outline-2 focus-visible:outline-blue-600 sm:p-4"
            tabIndex={0} aria-label="Artwork. Use the left and right arrow keys to change pages."
            onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }}
            onTouchStart={event => { swipeStart.current = event.touches[0].clientX; }}
            onTouchCancel={() => { swipeStart.current = null; }}
            onTouchEnd={event => {
              const x = swipeStart.current;
              swipeStart.current = null;
              if (x == null) return;
              const distance = event.changedTouches[0].clientX - x;
              if (Math.abs(distance) > 55) move(distance > 0 ? -1 : 1);
            }}>
            <ArtworkCanvas key={virtualPage} doc={doc} page={virtualPage} mapped sheet={sheet} label={pageLabel} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" className={viewButton} disabled={virtualPage === 1} onClick={() => move(-1)}>Previous</button>
            <span aria-live="polite" className="text-center text-xs font-medium sm:text-sm">{pageLabel} · {virtualPage} of {count}</span>
            <button type="button" className={viewButton} disabled={virtualPage === count} onClick={() => move(1)}>Next</button>
          </div>
        </>
      )}
      {doc && mode === "top" && (
        <div className="rounded-lg bg-neutral-100 p-2 sm:p-4">
          {doc.imposed ? <ArtworkCanvas doc={doc} page={1} mapped={false} sheet={sheet} label="Unfolded zine sheet" />
            : <>
                <div className={`grid gap-2 ${doc.pdf.numPages === 1 ? "" : "grid-cols-2 md:grid-cols-4"}`}>
                  {Array.from({ length: Math.min(overviewSize, doc.pdf.numPages - overview * overviewSize) }, (_, index) => {
                    const number = overview * overviewSize + index + 1;
                    return <button key={number} type="button" onClick={() => { setPage(number); show("mapped"); }} className="min-w-0 rounded border bg-white p-1.5 hover:border-black">
                      <ArtworkCanvas doc={doc} page={number} mapped={false} sheet={sheet} label={`Page ${number}`} small />
                      <span className="text-xs">Page {number}</span>
                    </button>;
                  })}
                </div>
                {topCount > 1 && <div className="mt-2 flex justify-between gap-2">
                  <button type="button" className={viewButton} disabled={overview === 0} onClick={() => setOverview(n => n - 1)}>Previous pages</button>
                  <button type="button" className={viewButton} disabled={overview === topCount - 1} onClick={() => setOverview(n => n + 1)}>Next pages</button>
                </div>}
              </>}
        </div>
      )}
    </section>
  );
}

function ArtworkCanvas({ doc, page, mapped, sheet, label, small }: {
  doc: DocumentView;
  page: number;
  mapped: boolean;
  sheet: React.MutableRefObject<Promise<HTMLCanvasElement> | null>;
  label: string;
  small?: boolean;
}) {
  const target = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus("loading");
    void (async () => {
      try {
        let image: HTMLCanvasElement;
        if (doc.imposed) {
          sheet.current ??= renderPdfPage(doc.pdf, 1, 2000).then(result => result.canvas).catch(error => { sheet.current = null; throw error; });
          const full = await sheet.current;
          image = mapped && doc.map !== "pages" ? miniPanel(full, doc.map, page) : full;
        } else {
          image = (await renderPdfPage(doc.pdf, page, small ? 480 : 1600)).canvas;
        }
        const canvas = target.current;
        if (!active || !canvas) return;
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext("2d")?.drawImage(image, 0, 0);
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    })();
    return () => { active = false; };
  }, [doc, page, mapped, sheet, small, attempt]);

  return <div className="mx-auto min-w-0">
    {status === "loading" && <p className="py-4 text-center text-sm text-gray-600" role="status">Opening {label.toLowerCase()}…</p>}
    {status === "error" && (small ? <p className="text-xs">Page preview unavailable</p> : <p className="text-sm" role="alert">Couldn’t render this page. <button type="button" className="min-h-10 underline" onClick={() => setAttempt(n => n + 1)}>Try again</button></p>)}
    <canvas ref={target} role="img" aria-label={label} hidden={status !== "ready"} className="h-auto max-h-[67dvh] max-w-full object-contain" onContextMenu={event => event.preventDefault()} />
  </div>;
}
