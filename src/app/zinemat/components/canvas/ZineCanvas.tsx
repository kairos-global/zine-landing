"use client";

import { useEffect, useRef, useState } from "react";
import type { ZineFormat } from "../interactivity/BasicsSection";
import {
  canvasHasArtwork, emptyPage, exportArtwork, frames, importCanvasImage, pageCount, renderArtwork,
  type CanvasState, type TextLayer,
} from "./canvas-art";

const control = "min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-40";
const selected = "border-yellow-400 bg-[#F2DC6F]/40";

export default function ZineCanvas({ state, format, title, onChange, onImportingChange }: {
  state: CanvasState;
  format: ZineFormat;
  title: string;
  onChange: React.Dispatch<React.SetStateAction<CanvasState>>;
  onImportingChange: (importing: boolean) => void;
}) {
  const [view, setView] = useState<"page" | "sheet">("page");
  const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const preview = useRef<HTMLCanvasElement>(null);
  const count = pageCount(state, format);
  const index = Math.min(page, count - 1);
  const sheet = format === "mini" && view === "sheet";
  const current = state.pages[index] ?? emptyPage();
  const layers = sheet ? state.texts : current.texts ?? [];

  useEffect(() => {
    let active = true;
    renderArtwork(state, format, index, 700, sheet).then(artwork => {
      const target = preview.current;
      if (!active || !target) return;
      target.width = artwork.width;
      target.height = artwork.height;
      target.getContext("2d")!.drawImage(artwork, 0, 0);
    }).catch(() => {
      if (active) setError("The page preview couldn’t open.");
    });
    return () => { active = false; };
  }, [state, format, index, sheet]);

  function selectPage(next: number) {
    setPage(next);
    setView("page");
  }

  function updateLayers(update: (layers: TextLayer[]) => TextLayer[]) {
    onChange(previous => sheet
      ? { ...previous, texts: update(previous.texts) }
      : {
          ...previous,
          pages: previous.pages.map((item, position) => position === index
            ? { ...item, texts: update(item.texts ?? []) }
            : item),
        });
  }

  function changeLayer(id: string, values: Partial<TextLayer>) {
    updateLayers(items => items.map(item => item.id === id ? { ...item, ...values } : item));
  }

  async function chooseImages(files: FileList) {
    setError("");
    setImporting(true);
    onImportingChange(true);
    const chosen = Array.from(files)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
      .slice(0, count - index);
    try {
      const images: string[] = [];
      for (const file of chosen) images.push(await importCanvasImage(file));
      onChange(previous => ({
        ...previous,
        pages: previous.pages.map((item, position) => images[position - index]
          ? { ...item, image: images[position - index] }
          : item),
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t import the images.");
    } finally {
      setImporting(false);
      onImportingChange(false);
    }
  }

  function movePage(direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= count) return;
    onChange(previous => {
      const pages = [...previous.pages];
      [pages[index], pages[next]] = [pages[next], pages[index]];
      return { ...previous, pages };
    });
    setPage(next);
  }

  async function downloadPdf() {
    setError("");
    setExporting(true);
    try {
      const { pdf } = await exportArtwork(state, format);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title.trim().replace(/[^\p{L}\p{N}-]+/gu, "-") || "zine"}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setError("Couldn’t make the PDF. Try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {format === "mini" && (
          <div className="flex gap-2" role="group" aria-label="Canvas view">
            <button type="button" aria-pressed={!sheet} className={`${control} ${!sheet ? selected : ""}`} onClick={() => setView("page")}>Page view</button>
            <button type="button" aria-pressed={sheet} className={`${control} ${sheet ? selected : ""}`} onClick={() => setView("sheet")}>Print sheet</button>
          </div>
        )}
        <button type="button" onClick={downloadPdf} disabled={exporting || !canvasHasArtwork(state, format)} className={control}>
          {exporting ? "Making PDF…" : "Download PDF"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <p className="text-center text-sm font-semibold" aria-live="polite">
            {sheet ? "Mini zine print sheet" : `Page ${index + 1} of ${count}${index === 0 ? " · Cover" : ""}`}
          </p>
          <div
            className="relative mx-auto overflow-hidden rounded-lg border border-yellow-300 shadow-sm"
            style={{ background: state.background, width: sheet ? "100%" : "min(100%, 290px)", aspectRatio: sheet ? "792/612" : format === "mini" ? "198/306" : "612/792" }}
          >
            <canvas ref={preview} className="block size-full" role="img" aria-label={sheet ? "Print sheet preview" : `Artwork on page ${index + 1}`} />
            {!sheet && !current.image && !layers.length && (
              <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-black/50">Blank page</span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-4" role="group" aria-label="Canvas pages">
            {Array.from({ length: count }, (_, position) => {
              const item = state.pages[position];
              const hasArtwork = item?.image || item?.texts?.length;
              return (
                <button
                  key={position}
                  type="button"
                  onClick={() => selectPage(position)}
                  aria-label={`${position === 0 ? "Cover, page 1" : `Page ${position + 1}`}${hasArtwork ? ", with artwork" : ", blank"}`}
                  aria-pressed={!sheet && index === position}
                  className={`${control} ${!sheet && index === position ? selected : "border-yellow-200"}`}
                >
                  {position + 1}{hasArtwork ? " ·" : ""}
                </button>
              );
            })}
          </div>
          {!sheet && <div className="flex flex-wrap gap-2">
            <button type="button" className={control} disabled={index === 0} onClick={() => movePage(-1)}>← Move page</button>
            <button type="button" className={control} disabled={index === count - 1} onClick={() => movePage(1)}>Move page →</button>
            {format === "half_letter" && count < 24 &&
              <button type="button" className={control} onClick={() => {
                onChange(previous => ({
                  ...previous,
                  halfLetterPages: count + 4,
                  pages: [...previous.pages, ...Array.from({ length: Math.max(0, count + 4 - previous.pages.length) }, emptyPage)],
                }));
                setPage(count);
              }}>Add 4 pages</button>}
            {format === "half_letter" && count > 4 && !state.pages.slice(count - 4, count).some(item => item.image || item.texts?.length) &&
              <button type="button" className={control} onClick={() => onChange(previous => ({ ...previous, halfLetterPages: count - 4 }))}>
                Remove last 4 blank pages
              </button>}
          </div>}
        </div>
        <div className="space-y-3">
          <div className="space-y-3 rounded-xl border border-yellow-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{sheet ? "Text on the sheet" : "Page text"}</h3>
              <button type="button" className={`${control} ${selected}`} onClick={() => updateLayers(items => [...items, {
                id: crypto.randomUUID(), text: "New text", x: 10, y: 10 + items.length * 10 % 60, size: sheet ? 28 : 52,
              }])}>Add text</button>
            </div>
            {layers.map((layer, position) => (
              <div key={layer.id} className="space-y-2 rounded-lg border p-2">
                <label className="block text-xs font-medium">
                  Text {position + 1}
                  <textarea
                    value={layer.text}
                    onChange={event => changeLayer(layer.id, { text: event.target.value })}
                    maxLength={500}
                    rows={2}
                    className="mt-1 block w-full rounded-lg border p-2 text-base"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["x", "Horizontal", 0, 95],
                    ["y", "Vertical", 0, 95],
                    ["size", "Size", 10, 180],
                  ] as const).map(([key, label, min, max]) => (
                    <label key={key} className="min-w-0 text-xs font-medium">
                      {label}
                      <input type="range" min={min} max={max} value={layer[key]} onChange={event => changeLayer(layer.id, { [key]: event.target.valueAsNumber })} className="block h-9 w-full accent-[#1E7FA8]" />
                    </label>
                  ))}
                  <label className="text-xs font-medium">Text color
                    <input type="color" value={layer.color ?? "#171717"} onChange={event => changeLayer(layer.id, { color: event.target.value })} className="block h-9 w-12 cursor-pointer" />
                  </label>
                </div>
                <button type="button" className={control} onClick={() => updateLayers(items => items.filter(item => item.id !== layer.id))}>
                  Remove text {position + 1}
                </button>
              </div>
            ))}
          </div>
          {!sheet && <div className="space-y-2 rounded-xl border border-yellow-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className={`${control} inline-flex cursor-pointer items-center focus-within:ring-2 focus-within:ring-[#65CBF1]`}>
                {importing ? "Importing…" : current.image ? "Replace or import images" : "Import images"}
                <input type="file" accept="image/*" multiple disabled={importing} className="sr-only" onChange={event => {
                  if (event.target.files?.length) void chooseImages(event.target.files);
                  event.target.value = "";
                }} />
              </label>
              {current.image && <button type="button" className={control} onClick={() => onChange(previous => ({
                ...previous, pages: previous.pages.map((item, position) => position === index ? { ...item, image: "" } : item),
              }))}>Remove image</button>}
            </div>
            <p className="text-xs text-gray-600">Multiple images fill pages from page {index + 1}, in filename order.</p>
            {current.image && <div className="grid grid-cols-2 gap-2" role="group" aria-label="Image frame">
              {frames.map(frame => (
                <button key={frame.id} type="button" aria-pressed={current.frame === frame.id} className={`${control} ${current.frame === frame.id ? selected : ""}`} onClick={() => onChange(previous => ({
                  ...previous, pages: previous.pages.map((item, position) => position === index ? { ...item, frame: frame.id } : item),
                }))}>{frame.label}</button>
              ))}
            </div>}
          </div>}
          <label className="flex items-center justify-between gap-3 rounded-xl border border-yellow-200 p-3 text-sm font-semibold">
            Page background
            <input type="color" value={state.background} onChange={event => onChange(previous => ({ ...previous, background: event.target.value }))} className="h-11 w-14 cursor-pointer" />
          </label>
        </div>
      </div>
    </div>
  );
}
