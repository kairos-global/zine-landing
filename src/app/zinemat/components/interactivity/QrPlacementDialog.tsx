"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { openZinePdf, renderPdfPage } from "@/lib/zine-pdf";
import { isMiniSheet, mapFromPdfUrl, miniPanel, type ViewMap } from "@/lib/zine-view-map";
import { placeQrInPdf, type QrPlacement } from "@/lib/zine-qr-placement";
import { pageCount, renderArtwork, type CanvasState } from "../canvas/canvas-art";
import type { ZineFormat } from "./BasicsSection";
import { ActionIcon } from "./QrActions";

type Source = { canvas: CanvasState; format: ZineFormat } | { url: string; format: ZineFormat };
const button = "min-h-11 rounded-lg border border-green-300 px-3 text-sm font-medium hover:bg-green-50 disabled:opacity-50";

export default function QrPlacementDialog({ code, source, onClose, onApply }: {
  code: { src: string; label: string };
  source: Source;
  onClose: () => void;
  onApply: (page: number, placement: QrPlacement, pdf?: Blob) => Promise<boolean>;
}) {
  const [page, setPage] = useState(1);
  const [pdf, setPdf] = useState<{ document: PDFDocumentProxy; map: ViewMap } | null>(null);
  const [placed, setPlaced] = useState({ x: 0.66, y: 0.71, width: 0.26 });
  const [ratio, setRatio] = useState(0);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const format = source.format;
  const url = "url" in source ? source.url : null;
  const canvas = "canvas" in source ? source.canvas : null;
  const count = canvas ? pageCount(canvas, format) : pdf?.map === "pages" ? pdf.document.numPages : pdf ? 8 : 0;
  const height = placed.width * ratio;
  const x = Math.max(0, Math.min(placed.x, 1 - placed.width));
  const y = Math.max(0, Math.min(placed.y, 1 - height));

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    if (!url) return;
    let active = true;
    let task: Awaited<ReturnType<typeof openZinePdf>> | undefined;
    void (async () => {
      try {
        task = await openZinePdf(url);
        if (!active) {
          await task.destroy();
          return;
        }
        const document = await task.promise;
        const first = (await document.getPage(1)).getViewport({ scale: 1 });
        const map = isMiniSheet(document.numPages, first.width, first.height)
          ? mapFromPdfUrl(url) ?? (format === "mini" ? "mini-center" : "pages")
          : "pages";
        if (active) setPdf({ document, map });
      } catch {
        if (active) setError("Couldn’t open the PDF for placement.");
      }
    })();
    return () => {
      active = false;
      if (task) void task.destroy().catch(() => {});
    };
  }, [url, format]);

  useEffect(() => {
    if (!canvas && !pdf) return;
    let active = true;
    setRatio(0);
    void (async () => {
      try {
        const artwork = canvas ? await renderArtwork(canvas, format, page - 1, 620)
          : await renderPdfPage(pdf!.document, pdf!.map === "pages" ? page : 1, 1700).then(result =>
            pdf!.map === "pages" ? result.canvas : miniPanel(result.canvas, pdf!.map, page));
        if (!active || !preview.current) return;
        preview.current.width = artwork.width;
        preview.current.height = artwork.height;
        preview.current.getContext("2d")!.drawImage(artwork, 0, 0);
        setRatio(artwork.width / artwork.height);
      } catch {
        if (active) setError("Couldn’t preview this page.");
      }
    })();
    return () => { active = false; };
  }, [canvas, pdf, page, format]);

  function move(event: PointerEvent<HTMLElement>) {
    const rect = sheet.current?.getBoundingClientRect();
    if (!rect || !drag.current) return;
    const { offsetX, offsetY } = drag.current;
    setPlaced(previous => ({
      ...previous,
      x: Math.max(0, Math.min((event.clientX - rect.left) / rect.width - offsetX, 1 - previous.width)),
      y: Math.max(0, Math.min((event.clientY - rect.top) / rect.height - offsetY, 1 - previous.width * ratio)),
    }));
  }

  async function apply() {
    setApplying(true);
    setError("");
    try {
      const placement = { src: code.src, x, y, width: placed.width };
      const output = pdf ? await placeQrInPdf(pdf.document, pdf.map, page, placement) : undefined;
      if (await onApply(page, placement, output)) onClose();
      else setError("Couldn’t apply the QR code. Try again.");
    } catch {
      setError("Couldn’t add this QR code to the file. Try another PDF or download the QR.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!applying) onClose(); }} aria-labelledby="qr-placement-title"
      className="m-auto max-h-[94dvh] w-[min(94vw,48rem)] overflow-auto rounded-2xl border bg-white p-4 text-black shadow-lg backdrop:bg-black/40 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" id="qr-placement-title">Place QR on file</h2>
        <button type="button" className={button} disabled={applying} aria-label="Close placement" onClick={onClose}><ActionIcon name="close" /></button>
      </div>
      <div className="mt-3 grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="grid min-h-32 place-items-center rounded-xl border bg-gray-50 p-2">
          <div ref={sheet} className={`relative max-w-full overflow-hidden ${ratio ? "" : "hidden"}`}>
            <canvas ref={preview} className="block h-auto max-h-[49dvh] max-w-full object-contain" aria-label={`Page ${page} preview`} role="img" />
            {ratio > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={code.src} alt={`${code.label} QR`} draggable={false}
                className="absolute touch-none cursor-move outline-1 outline-green-600"
                style={{ width: `${placed.width * 100}%`, height: `${height * 100}%`, left: `${x * 100}%`, top: `${y * 100}%` }}
                onPointerDown={event => {
                  if (applying) return;
                  const rect = sheet.current!.getBoundingClientRect();
                  drag.current = { offsetX: (event.clientX - rect.left) / rect.width - x, offsetY: (event.clientY - rect.top) / rect.height - y };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={move}
                onLostPointerCapture={() => { drag.current = null; }}
              />
            )}
          </div>
          {!ratio && !error && <p role="status" className="text-sm">Opening page…</p>}
        </div>
        <fieldset disabled={applying || !count} className="space-y-3">
          <label className="block text-sm font-medium">Page
            <select value={page} onChange={event => setPage(Number(event.target.value))} className="mt-1 block min-h-11 w-full rounded-lg border px-2">
              {Array.from({ length: count }, (_, index) => <option key={index} value={index + 1}>{index === 0 ? "1 · Cover" : `Page ${index + 1}`}</option>)}
            </select>
          </label>
          {([
            ["width", "Size", 0.12, Math.max(0.12, Math.min(0.52, 0.95 / (ratio || 1))), placed.width],
            ["x", "Horizontal position", 0, 1 - placed.width, x],
            ["y", "Vertical position", 0, Math.max(0, 1 - height), y],
          ] as const).map(([key, label, min, max, value]) => (
            <label className="block text-sm font-medium" key={key}>{label}
              <input type="range" min={min} max={max} step={0.005} value={value} onChange={event => {
                const next = event.target.valueAsNumber;
                setPlaced(previous => ({ ...previous, [key]: next }));
              }} className="block h-8 w-full accent-green-700" />
            </label>
          ))}
        </fieldset>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={button} disabled={applying} onClick={onClose}>Cancel</button>
        <button type="button" className={`${button} bg-[#82E385] hover:bg-green-300`} disabled={!ratio || applying} onClick={() => void apply()}>{applying ? "Applying…" : "Apply QR code"}</button>
      </div>
    </dialog>
  );
}
