"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { ZineFormat } from "../interactivity/BasicsSection";
import {
  artworkLayers, canvasHasArtwork, emptyPage, exportArtwork, frameBox, frames, importCanvasImage, layerName,
  pageCount, pageHasArtwork, renderArtwork, type ArtworkLayer, type CanvasPage, type CanvasState, type LayerBox,
} from "./canvas-art";

const control = "min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-40";
const selectedStyle = "border-yellow-400 bg-[#F2DC6F]/40";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value * 10) / 10));
const boxStyle = ({ x, y, w, h }: LayerBox) => ({ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
const fields = [["x", "Left"], ["y", "Top"], ["w", "Width"], ["h", "Height"]] as const;

type Drag = { mode: "move" | "resize"; originX: number; originY: number; width: number; height: number; layer: ArtworkLayer };

function Preview({ state, format, index, sheet, width, onError }: {
  state: CanvasState;
  format: ZineFormat;
  index: number;
  sheet?: boolean;
  width: number;
  onError?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    void renderArtwork(state, format, index, width, sheet).then(artwork => {
      const target = canvas.current;
      if (!active || !target) return;
      target.width = artwork.width;
      target.height = artwork.height;
      target.getContext("2d")!.drawImage(artwork, 0, 0);
    }).catch(() => { if (active) onError?.(); });
    return () => { active = false; };
  }, [state, format, index, width, sheet, onError]);
  return <canvas ref={canvas} className="pointer-events-none block size-full" aria-hidden="true" />;
}

export default function ZineCanvas({ state, format, title, onChange, onImportingChange }: {
  state: CanvasState;
  format: ZineFormat;
  title: string;
  onChange: React.Dispatch<React.SetStateAction<CanvasState>>;
  onImportingChange: (importing: boolean) => void;
}) {
  const [view, setView] = useState<"page" | "sheet">("page");
  const [page, setPage] = useState(0);
  const [layerId, setLayerId] = useState<string | null>(null);
  const [dragged, setDragged] = useState<LayerBox | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const count = pageCount(state, format);
  const index = Math.min(page, count - 1);
  const sheet = format === "mini" && view === "sheet";
  const current = state.pages[index] ?? emptyPage();
  const layers = artworkLayers(current);
  const selected = layers.find(layer => layer.id === layerId);
  const previewState = useMemo(() => {
    if (!dragged || !layerId) return state;
    return {
      ...state,
      pages: state.pages.map((item, position) => position === index
        ? { ...item, layers: artworkLayers(item).map(layer => layer.id === layerId ? { ...layer, ...dragged } : layer) }
        : item),
    };
  }, [state, dragged, layerId, index]);

  function updatePage(change: (item: CanvasPage) => CanvasPage) {
    onChange(previous => ({
      ...previous,
      pages: previous.pages.map((item, position) => position === index ? change(item) : item),
    }));
  }

  function updateLayers(change: (items: ArtworkLayer[]) => ArtworkLayer[]) {
    updatePage(item => ({ ...item, image: "", texts: [], layers: change(artworkLayers(item)) }));
  }

  function updateLayer(id: string, change: (layer: ArtworkLayer) => ArtworkLayer) {
    updateLayers(items => items.map(layer => layer.id === id ? change(layer) : layer));
  }

  function selectPage(next: number) {
    setPage(next);
    setView("page");
    setLayerId(null);
  }

  function addText() {
    const bounds = frameBox(current.frame);
    const id = crypto.randomUUID();
    updateLayers(items => [...items, {
      id, kind: "text", text: "New text", color: "#171717", size: 52, bold: true,
      x: bounds.x + 5, y: bounds.y + 5, w: bounds.w - 10, h: Math.min(28, bounds.h - 5),
    }]);
    setLayerId(id);
  }

  async function chooseImages(files: FileList, fillPages: boolean) {
    setError("");
    setImporting(true);
    onImportingChange(true);
    const chosen = Array.from(files)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
      .slice(0, fillPages ? count - index : 1);
    try {
      const images = await Promise.all(chosen.map(async file => ({
        id: crypto.randomUUID(), kind: "image" as const, src: await importCanvasImage(file), name: file.name, fit: fillPages ? "cover" as const : "contain" as const,
      })));
      onChange(previous => ({
        ...previous,
        pages: previous.pages.map((item, position) => {
          const image = images[position - index];
          if (!image) return item;
          const bounds = frameBox(item.frame);
          const box = fillPages ? bounds : { x: bounds.x + 5, y: bounds.y + 5, w: bounds.w - 10, h: bounds.h - 10 };
          return { ...item, image: "", texts: [], layers: [...artworkLayers(item), { ...image, ...box }] };
        }),
      }));
      setLayerId(images[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t import the images.");
    } finally {
      setImporting(false);
      onImportingChange(false);
    }
  }

  function reorder(direction: -1 | 1) {
    updateLayers(items => {
      const position = items.findIndex(item => item.id === layerId);
      const next = position + direction;
      if (position < 0 || next < 0 || next >= items.length) return items;
      const result = [...items];
      [result[position], result[next]] = [result[next], result[position]];
      return result;
    });
  }

  function movePage(direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= count) return;
    onChange(previous => {
      const pages = [...previous.pages];
      [pages[index], pages[next]] = [pages[next], pages[index]];
      return { ...previous, pages };
    });
    selectPage(next);
  }

  function startDrag(event: PointerEvent<HTMLElement>, layer: ArtworkLayer, mode: Drag["mode"]) {
    const rect = board.current?.getBoundingClientRect();
    if (!rect || event.button !== 0) return;
    event.stopPropagation();
    setLayerId(layer.id);
    drag.current = { layer, mode, originX: event.clientX, originY: event.clientY, width: rect.width, height: rect.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragBox(event: PointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active) return null;
    const { layer } = active;
    const dx = (event.clientX - active.originX) * 100 / active.width;
    const dy = (event.clientY - active.originY) * 100 / active.height;
    return active.mode === "move"
      ? { ...layer, x: clamp(layer.x + dx, 0, 100 - layer.w), y: clamp(layer.y + dy, 0, 100 - layer.h) }
      : { ...layer, w: clamp(layer.w + dx, 4, 100 - layer.x), h: clamp(layer.h + dy, 4, 100 - layer.y) };
  }

  const pointerEvents = {
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const bounds = dragBox(event);
      if (bounds) setDragged(bounds);
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const bounds = dragBox(event);
      if (bounds && drag.current && (event.clientX !== drag.current.originX || event.clientY !== drag.current.originY)) {
        const { x, y, w, h } = bounds;
        updateLayer(drag.current.layer.id, layer => ({ ...layer, x, y, w, h, ...(layer.kind === "text" ? { legacy: false } : {}) }));
      }
      drag.current = null;
      setDragged(null);
    },
    onLostPointerCapture() {
      drag.current = null;
      setDragged(null);
    },
  };

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
        {format === "mini" && <div className="flex gap-2" role="group" aria-label="Canvas view">
          <button type="button" aria-pressed={!sheet} className={`${control} ${!sheet ? selectedStyle : ""}`} onClick={() => setView("page")}>Page view</button>
          <button type="button" aria-pressed={sheet} className={`${control} ${sheet ? selectedStyle : ""}`} onClick={() => setView("sheet")}>Print sheet</button>
        </div>}
        <button type="button" onClick={() => void downloadPdf()} disabled={exporting || !canvasHasArtwork(state, format)} className={control}>
          {exporting ? "Making PDF…" : "Download PDF"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className={`grid min-w-0 items-start gap-4 ${sheet ? "" : "md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.75fr)]"}`}>
        <section className="min-w-0 space-y-2" aria-label="Artwork canvas">
          <p className="text-center text-sm font-semibold">{sheet ? "Mini zine print sheet" : `Page ${index + 1} of ${count}${index === 0 ? " · Cover" : ""}`}</p>
          <div className="grid min-h-44 place-items-center rounded-xl border border-yellow-200 bg-gray-50 p-3">
            <div ref={board} onPointerDown={() => setLayerId(null)} className="relative mx-auto rounded-sm border border-yellow-300 shadow-sm"
              style={{ background: current.background ?? state.background, width: sheet ? "min(100%, 650px)" : "min(100%, 290px)", aspectRatio: sheet ? "792/612" : format === "mini" ? "198/306" : "612/792" }}>
              <div role="img" aria-label={sheet ? "Print sheet preview" : `Artwork on page ${index + 1}`} className="pointer-events-none size-full">
                <Preview state={previewState} format={format} index={index} width={700} sheet={sheet} />
              </div>
              {!sheet && !layers.length && !current.qrCodes?.length && (
                <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-gray-600">Blank page</span>
              )}
              {!sheet && layers.map(layer => (
                <button key={layer.id} type="button" onClick={() => setLayerId(layer.id)} aria-label={layerName(layer)}
                  className="absolute touch-none cursor-move focus-visible:outline-2 focus-visible:outline-blue-700"
                  style={boxStyle(layer)} onPointerDown={event => startDrag(event, layer, "move")} {...pointerEvents} />
              ))}
              {!sheet && selected && (
                <div className="pointer-events-none absolute outline-2 outline-blue-600" style={boxStyle(dragged ?? selected)}>
                  <button type="button" tabIndex={-1} aria-label="Resize selected layer" className="pointer-events-auto absolute -right-2 -bottom-2 size-5 touch-none rounded-sm border border-blue-700 bg-white cursor-nwse-resize"
                    onPointerDown={event => startDrag(event, selected, "resize")} {...pointerEvents} />
                </div>
              )}
            </div>
          </div>
        </section>

        {!sheet && <aside className="space-y-3 rounded-xl border border-yellow-200 p-3" aria-label="Layer controls">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${control} ${selectedStyle}`} onClick={addText}>Add text</button>
            {[false, true].map(fillPages => (
              <label key={String(fillPages)} className={`${control} inline-flex cursor-pointer items-center focus-within:ring-2 focus-within:ring-blue-600`}>
                {fillPages ? "Fill pages with images" : "Add image"}
                <input type="file" accept="image/*" aria-label={fillPages ? "Fill pages with images" : "Add image"} multiple={fillPages} disabled={importing} className="sr-only" onChange={event => {
                  if (event.target.files?.length) void chooseImages(event.target.files, fillPages);
                  event.target.value = "";
                }} />
              </label>
            ))}
          </div>
          {importing && <p role="status" className="text-xs text-gray-600">Opening images…</p>}
          {layers.length > 0 && <div className="space-y-1">
            <h3 className="text-sm font-semibold">Layers</h3>
            {[...layers].reverse().map(layer => (
              <button type="button" key={layer.id} onClick={() => setLayerId(layer.id)} aria-pressed={layerId === layer.id}
                className={`block min-h-10 w-full truncate rounded-lg border px-2 text-left text-sm ${layerId === layer.id ? selectedStyle : "border-gray-200"}`}>
                {layerName(layer)}
              </button>
            ))}
          </div>}

          {selected && <div className="space-y-3 border-t border-yellow-200 pt-3">
            {selected.kind === "text" ? <>
              <label className="block text-sm font-medium">Text
                <textarea value={selected.text} rows={3} maxLength={2400} className="mt-1 block w-full rounded-lg border p-2"
                  onChange={event => updateLayer(selected.id, layer => layer.kind === "text" ? { ...layer, text: event.target.value, legacy: false } : layer)} />
              </label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2">
                <label className="text-xs font-medium">Size
                  <input type="range" min={10} max={180} value={selected.size} className="block h-10 w-full accent-[#1E7FA8]"
                    onChange={event => updateLayer(selected.id, layer => layer.kind === "text" ? { ...layer, size: event.target.valueAsNumber } : layer)} />
                </label>
                <button type="button" aria-pressed={selected.bold !== false} className={`${control} ${selected.bold !== false ? selectedStyle : ""}`}
                  onClick={() => updateLayer(selected.id, layer => layer.kind === "text" ? { ...layer, bold: layer.bold === false, legacy: false } : layer)}>Bold</button>
                <label className="text-xs font-medium">Color
                  <input type="color" value={selected.color ?? "#171717"} className="block h-11 w-12 cursor-pointer"
                    onChange={event => updateLayer(selected.id, layer => layer.kind === "text" ? { ...layer, color: event.target.value } : layer)} />
                </label>
              </div>
            </> : (
              <label className="block text-sm font-medium">Image fit
                <select value={selected.fit} className="mt-1 block min-h-11 w-full rounded-lg border px-2" onChange={event => {
                  const fit = event.target.value === "contain" ? "contain" : "cover";
                  updateLayer(selected.id, layer => layer.kind === "image" ? { ...layer, fit } : layer);
                }}>
                  <option value="cover">Fill frame</option>
                  <option value="contain">Fit whole image</option>
                </select>
              </label>
            )}
            <details>
              <summary className="cursor-pointer text-sm font-medium">Position and size</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {fields.map(([key, label]) => {
                  const size = key === "w" || key === "h";
                  const max = 100 - selected[{ x: "w", y: "h", w: "x", h: "y" }[key] as keyof LayerBox];
                  return (
                    <label key={key} className="text-xs font-medium">{label} %
                      <input type="number" min={size ? 4 : 0} max={max} step={0.5} value={selected[key]} className="mt-1 block min-h-10 w-full rounded-lg border px-2"
                        onChange={event => {
                          const next = event.target.valueAsNumber;
                          if (Number.isFinite(next)) updateLayer(selected.id, layer => ({ ...layer, [key]: clamp(next, size ? 4 : 0, max), ...(layer.kind === "text" ? { legacy: false } : {}) }));
                        }} />
                    </label>
                  );
                })}
              </div>
            </details>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={control} disabled={layers.at(-1)?.id === selected.id} onClick={() => reorder(1)}>Raise</button>
              <button type="button" className={control} disabled={layers[0]?.id === selected.id} onClick={() => reorder(-1)}>Lower</button>
              <button type="button" className={control} onClick={() => {
                const id = crypto.randomUUID();
                updateLayers(items => [...items, { ...selected, id, x: clamp(selected.x + 3, 0, 100 - selected.w), y: clamp(selected.y + 3, 0, 100 - selected.h) }]);
                setLayerId(id);
              }}>Duplicate</button>
              <button type="button" className={`${control} text-red-700`} onClick={() => {
                updateLayers(items => items.filter(layer => layer.id !== selected.id));
                setLayerId(null);
              }}>Remove</button>
            </div>
          </div>}

          <details className="border-t border-yellow-200 pt-2">
            <summary className="cursor-pointer text-sm font-semibold">Page settings</summary>
            <div className="mt-2 space-y-3">
              <label className="flex items-center justify-between gap-2 text-sm">Page background
                <input type="color" value={current.background ?? state.background} className="h-11 w-14 cursor-pointer" onChange={event => {
                  const background = event.target.value;
                  updatePage(item => ({ ...item, background }));
                }} />
              </label>
              <button type="button" className={control} onClick={() => {
                const background = current.background ?? state.background;
                onChange(previous => ({ ...previous, background, pages: previous.pages.map(item => ({ ...item, background })) }));
              }}>Apply background to all pages</button>
              <label className="block text-sm">Image frame
                <select value={current.frame} className="mt-1 block min-h-11 w-full rounded-lg border px-2" onChange={event => {
                  const frame = frames.find(item => item.id === event.target.value)!.id;
                  updatePage(item => ({
                    ...item, frame,
                    layers: item.layers?.map(layer => layer.id === layerId && layer.kind === "image" ? { ...layer, ...frameBox(frame) } : layer),
                  }));
                }}>
                  {frames.map(frame => <option value={frame.id} key={frame.id}>{frame.label}</option>)}
                </select>
              </label>
            </div>
          </details>

          {!!current.qrCodes?.length && <div className="space-y-1 border-t border-yellow-200 pt-2">
            <p className="text-xs font-medium text-green-800">{current.qrCodes.length} placed QR {current.qrCodes.length === 1 ? "code" : "codes"}</p>
            {current.qrCodes.map((code, position) => <button key={code.id} type="button" className={`${control} text-red-700`}
              onClick={() => updatePage(item => ({ ...item, qrCodes: item.qrCodes?.filter(qr => qr.id !== code.id) }))}>Remove QR {position + 1}</button>)}
          </div>}
        </aside>}

        {sheet && state.texts.length > 0 && <div className="space-y-3 rounded-xl border border-yellow-200 p-3">
          <h3 className="text-sm font-semibold">Print sheet text</h3>
          {state.texts.map(layer => <label key={layer.id} className="block text-sm">Text
            <textarea className="mt-1 block w-full rounded-lg border p-2" value={layer.text} onChange={event => {
              const text = event.target.value;
              onChange(previous => ({ ...previous, texts: previous.texts.map(item => item.id === layer.id ? { ...item, text } : item) }));
            }} />
          </label>)}
        </div>}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="group" aria-label="Canvas pages">
        {Array.from({ length: count }, (_, position) => {
          const item = state.pages[position];
          return (
            <button key={position} type="button" onClick={() => selectPage(position)}
              aria-label={position === 0 ? "Cover, page 1" : `Page ${position + 1}`} aria-pressed={!sheet && index === position}
              className={`min-h-11 min-w-0 rounded-lg border p-1 text-xs font-semibold ${!sheet && index === position ? selectedStyle : "border-yellow-200"}`}>
              <span className="mx-auto mb-1 block aspect-[198/306] w-7 overflow-hidden rounded-sm border border-black/10" style={{ background: item?.background ?? state.background }}>
                {pageHasArtwork(item) && <Preview state={state} format={format} index={position} width={55} />}
              </span>
              {position === 0 ? "Cover" : position + 1}
            </button>
          );
        })}
      </div>
      {!sheet && <div className="flex flex-wrap gap-2">
        <button type="button" className={control} disabled={index === 0} onClick={() => movePage(-1)}>Move page left</button>
        <button type="button" className={control} disabled={index === count - 1} onClick={() => movePage(1)}>Move page right</button>
      </div>}
    </div>
  );
}
