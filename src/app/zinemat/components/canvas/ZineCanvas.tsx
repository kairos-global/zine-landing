"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { GRID_ORDER, GUIDES, PANEL_ASPECT, SHEET, pageLabel } from "@/lib/zine-imposition";
import { freshState, sheetPdf, SHEET_FONT, type CanvasState, type Frame, type Page } from "@/lib/zine-sheet";

type SaveState = "loading" | "saved" | "saving" | "error";
const frames: { id: Frame; label: string; hint: string }[] = [
  { id: "full", label: "Full bleed", hint: "Edge to edge" }, { id: "inset", label: "Gallery", hint: "Wide margin" },
  { id: "portrait", label: "Portrait", hint: "Tall crop" }, { id: "split", label: "Offset", hint: "Editorial crop" },
];

export default function ZineCanvas({ issueId }: { issueId: string }) {
  const [state, setState] = useState<CanvasState>(freshState);
  const [mode, setMode] = useState<"page" | "top">("page");
  const [page, setPage] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [loaded, setLoaded] = useState(false);
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("Untitled canvas");
  const [textDraft, setTextDraft] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetWidth, setSheetWidth] = useState(0);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => { fetch(`/api/canvas/${issueId}`).then(async response => {
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    if (data.state) setState({ ...freshState(), ...data.state });
    setTitle(data.title || "Untitled canvas"); setLoaded(true); setSaveState("saved");
  }).catch(() => setSaveState("error")); }, [issueId]);

  const save = useCallback(async (next: CanvasState, nextTitle?: string) => {
    setSaveState("saving");
    try { const response = await fetch(`/api/canvas/${issueId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: next, title: nextTitle }) });
      if (!response.ok) throw new Error(); setSaveState("saved");
    } catch { setSaveState("error"); }
  }, [issueId]);

  useEffect(() => { if (!loaded) return; setSaveState("saving"); if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => save(state), 700); return () => { if (saveTimer.current) clearTimeout(saveTimer.current); }; }, [state, loaded, save]);
  const update = (fn: (value: CanvasState) => CanvasState) => setState(current => fn(current));

  // Type is stored in points so the preview and the PDF agree. That means the
  // preview has to know how wide it is being drawn, which only the DOM knows.
  useEffect(() => {
    const element = sheetRef.current;
    if (!element) { setSheetWidth(0); return; }
    const observer = new ResizeObserver(entries => setSheetWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [mode]);
  const typeScale = sheetWidth ? sheetWidth / SHEET.width : 0;

  async function downloadSheet() {
    setExporting("Building the sheet…");
    try {
      const blob = await sheetPdf(state, { guides: true, title });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${(title || "zine").replace(/\s+/g, "-").toLowerCase()}-sheet.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
      setExporting(null);
    } catch (error) {
      setExporting(error instanceof Error ? error.message : "Could not build the sheet.");
      setTimeout(() => setExporting(null), 4000);
    }
  }

  async function chooseImages(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files).slice(0, 8);
    const urls = await Promise.all(selected.map(file => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); })));
    update(current => ({ ...current, pages: current.pages.map((item, index) => urls[index] ? { ...item, image: urls[index] } : item) }));
  }
  function movePage(index: number, direction: number) { const target = index + direction; if (target < 0 || target > 7) return; update(current => { const pages = [...current.pages]; [pages[index], pages[target]] = [pages[target], pages[index]]; return { ...current, pages }; }); setPage(target); }
  function addText() { if (!textDraft.trim()) return; update(current => ({ ...current, texts: [...current.texts, { id: crypto.randomUUID(), text: textDraft.trim(), x: 10 + (current.texts.length * 7) % 60, y: 12 + (current.texts.length * 11) % 65, size: 24 }] })); setTextDraft(""); }
  function positionText(id: string, axis: "x" | "y", value: number) { update(current => ({ ...current, texts: current.texts.map(text => text.id === id ? { ...text, [axis]: value } : text) })); }

  const imageCount = state.pages.filter(item => item.image).length;
  const framesSet = imageCount === 8 && state.pages.every(item => item.frameSet);
  const readyToName = imageCount === 8 && framesSet && state.backgroundSet && state.texts.length > 0;
  const steps = [{ label: "8 images selected", done: imageCount === 8, detail: `${imageCount}/8` }, { label: "Frames set", done: framesSet }, { label: "Global color set", done: state.backgroundSet }, { label: "Text added in top view", done: state.texts.length > 0 }, { label: "Name your zine", done: title !== "Untitled canvas" }];

  if (!loaded && saveState !== "error") return <div className="p-16 text-center font-semibold">Opening your canvas…</div>;
  return <main className="min-h-screen bg-[#E9E7DF] text-[#171717]">
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b-2 border-black bg-[#FFFDF5] px-4 py-3 sm:px-7">
      <div><a href="/zinemat" className="text-xs font-bold uppercase tracking-widest">← ZineMat</a><h1 className="text-lg font-bold">{title}</h1></div>
      <div className="flex rounded-xl border-2 border-black bg-white p-1" aria-label="Editor view">
        <button onClick={() => setMode("page")} className={clsx("rounded-lg px-4 py-2 text-sm font-bold", mode === "page" && "bg-black text-white")}>▣ Page view</button>
        <button onClick={() => setMode("top")} className={clsx("rounded-lg px-4 py-2 text-sm font-bold", mode === "top" && "bg-[#AAEEFF]")}>⊞ Top view</button>
      </div>
      <div className={clsx("text-xs font-bold", saveState === "error" ? "text-red-600" : "text-gray-600")}><span className={clsx("mr-2 inline-block h-2 w-2 rounded-full", saveState === "saved" ? "bg-green-500" : saveState === "error" ? "bg-red-500" : "animate-pulse bg-amber-500")} />{saveState === "saved" ? "All changes saved" : saveState === "error" ? "Autosave failed" : "Autosaving…"}</div>
    </header>

    <div className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[260px_1fr_280px] lg:p-6">
      <aside className="space-y-5 rounded-2xl border-2 border-black bg-[#FFFDF5] p-4">
        <div><p className="eyebrow">1 · Images</p><label className="mt-2 block cursor-pointer rounded-xl border-2 border-dashed border-black bg-white p-4 text-center text-sm font-bold hover:bg-[#AAEEFF]">Choose up to 8 images<input type="file" accept="image/*" multiple className="sr-only" onChange={event => chooseImages(event.target.files)} /></label><p className="mt-2 text-xs text-gray-500">Images fill pages 1–8 in selection order.</p></div>
        {mode === "page" ? <div><p className="eyebrow">2 · Frame</p><div className="mt-2 grid grid-cols-2 gap-2">{frames.map(frame => <button key={frame.id} onClick={() => update(current => ({ ...current, pages: current.pages.map((item, index) => index === page ? { ...item, frame: frame.id, frameSet: true } : item) }))} className={clsx("rounded-lg border-2 p-2 text-left", state.pages[page].frameSet && state.pages[page].frame === frame.id ? "border-black bg-[#FFEA69]" : "border-gray-300 bg-white")}><span className="block text-xs font-bold">{frame.label}</span><span className="text-[10px] text-gray-500">{frame.hint}</span></button>)}</div></div> : <div className="rounded-xl bg-[#AAEEFF] p-3 text-sm"><b>Top view is for type.</b><br />Switch to Page view to crop and frame individual images.</div>}
        <div><p className="eyebrow">3 · Global background</p><div className="mt-2 flex items-center gap-3"><input type="color" value={state.background} onChange={event => update(current => ({ ...current, background: event.target.value, backgroundSet: true }))} className="h-11 w-14 cursor-pointer rounded border"/><p className="text-xs text-gray-500">Applies consistently to all 8 pages.</p></div></div>
      </aside>

      <section className="min-w-0">
        {mode === "page" ? <>
          <div className="mb-3 flex items-center justify-between"><button onClick={() => movePage(page, -1)} disabled={page === 0} className="editor-button">← Move</button><b>{pageLabel(page + 1)} · {page + 1} of {SHEET.pages}</b><button onClick={() => movePage(page, 1)} disabled={page === 7} className="editor-button">Move →</button></div>
          <div className="mx-auto max-h-[680px] overflow-hidden border-2 border-black shadow-[8px_8px_0_#000]" style={{ aspectRatio: PANEL_ASPECT, background: state.background }}><PageImage item={state.pages[page]} /></div>
          <div className="mt-5 grid grid-cols-8 gap-2">{state.pages.map((item, index) => <button key={index} onClick={() => setPage(index)} className={clsx("overflow-hidden border-2", page === index ? "border-black ring-2 ring-[#65CBF1]" : "border-gray-400")} style={{ aspectRatio: PANEL_ASPECT, background: state.background }}><PageImage item={item} /><span className="sr-only">Page {index + 1}</span></button>)}</div>
        </> : <>
          <div className="mb-3"><b>Top view · the printed sheet</b><p className="text-xs text-gray-600">This is the paper, not the reading order. Pages 4–7 sit upside down because that is what the fold requires — print it, fold it, and it reads 1 to 8.</p></div>
          <div ref={sheetRef} className="relative grid grid-cols-4 grid-rows-2 overflow-hidden border-2 border-black shadow-[8px_8px_0_#000]" style={{ aspectRatio: `${SHEET.width} / ${SHEET.height}`, background: state.background }}>
            {GRID_ORDER.map(cell => (
              <div key={cell.page} className="relative overflow-hidden">
                <div className={clsx("h-full w-full", cell.flipped && "rotate-180")}><PageImage item={state.pages[cell.page - 1]} /></div>
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">{cell.page}{cell.flipped ? " \u2191\u2193" : ""}</span>
              </div>
            ))}

            {/* Creases, and the one cut. The cut is solid and heavier because it
                is the only line on the sheet that a knife goes near. */}
            {GUIDES.folds.vertical.map(fraction => (
              <div key={fraction} className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-black/40" style={{ left: `${fraction * 100}%` }} />
            ))}
            {GUIDES.folds.horizontalSegments.map(segment => (
              <div key={segment.from} className="pointer-events-none absolute border-t border-dashed border-black/40" style={{ top: "50%", left: `${segment.from * 100}%`, width: `${(segment.to - segment.from) * 100}%` }} />
            ))}
            <div className="pointer-events-none absolute bg-black" style={{ top: "50%", height: 2, marginTop: -1, left: `${GUIDES.cut.from * 100}%`, width: `${(GUIDES.cut.to - GUIDES.cut.from) * 100}%` }} />

            {state.texts.map(text => <div key={text.id} className="absolute cursor-move border border-dashed border-black/40 bg-white/30 px-1 font-bold leading-none" style={{ left: `${text.x}%`, top: `${text.y}%`, fontSize: `${Math.max(6, text.size * typeScale)}px`, fontFamily: SHEET_FONT }}>{text.text}</div>)}
          </div>
          <p className="mt-2 text-xs text-gray-600"><b>Heavy line = cut.</b> Dashed = fold. Type sits on the sheet, so it does not turn with the pages.</p>
        </>}
      </section>

      <aside className="rounded-2xl border-2 border-black bg-[#FFFDF5] p-4"><p className="eyebrow">4 · Type layer</p>{mode === "top" ? <><textarea value={textDraft} onChange={event => setTextDraft(event.target.value)} placeholder="Write something…" className="mt-2 w-full rounded-lg border-2 border-black p-3 text-sm"/><button onClick={addText} className="mt-2 w-full rounded-lg border-2 border-black bg-[#AAEEFF] py-2 text-sm font-bold">+ Add to sheet</button><div className="mt-4 space-y-4">{state.texts.map(text => <div key={text.id} className="rounded-lg border bg-white p-2"><div className="flex justify-between text-xs font-bold"><span className="truncate">{text.text}</span><button onClick={() => update(current => ({ ...current, texts: current.texts.filter(item => item.id !== text.id) }))}>×</button></div><label className="mt-2 block text-[10px]">Horizontal<input type="range" min="0" max="85" value={text.x} onChange={e => positionText(text.id, "x", +e.target.value)} className="w-full"/></label><label className="block text-[10px]">Vertical<input type="range" min="0" max="85" value={text.y} onChange={e => positionText(text.id, "y", +e.target.value)} className="w-full"/></label></div>)}</div></> : <div className="mt-2 rounded-xl bg-gray-100 p-4 text-sm">Type is edited only in <b>Top view</b>, so it can move freely across page boundaries.<button onClick={() => setMode("top")} className="mt-3 block font-bold underline">Open top view →</button></div>}</aside>
    </div>

    <footer className="sticky bottom-0 z-20 border-t-2 border-black bg-[#171717] px-4 py-3 text-white"><div className="mx-auto flex max-w-[1450px] flex-wrap items-center gap-2"><b className="mr-2 text-sm">Canvas checklist</b>{steps.map((step, index) => <span key={step.label} className={clsx("rounded-full border px-3 py-1 text-xs", step.done ? "border-green-400 bg-green-400/20" : "border-white/30 text-white/60")}>{step.done ? "✓" : index + 1} {step.label} {step.detail}</span>)}<button disabled={imageCount === 0 || exporting !== null} onClick={downloadSheet} className="ml-auto rounded-lg border-2 border-white/40 px-4 py-2 text-sm font-bold text-white disabled:border-white/10 disabled:text-white/30">{exporting ?? "Download print sheet (PDF)"}</button><button disabled={!readyToName} onClick={() => setNaming(true)} className="rounded-lg bg-[#FFEA69] px-4 py-2 text-sm font-bold text-black disabled:bg-gray-600 disabled:text-gray-300">Finish & name →</button></div></footer>
    {naming && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><div className="w-full max-w-md rounded-2xl border-2 border-black bg-[#FFFDF5] p-6 shadow-[8px_8px_0_#AAEEFF]"><p className="eyebrow">Final step</p><h2 className="mt-1 text-2xl font-bold">Name your mini zine</h2><p className="mt-2 text-sm text-gray-600">Your canvas already exists and is saved. This name will identify it in your library.</p><input autoFocus value={title === "Untitled canvas" ? "" : title} onChange={e => setTitle(e.target.value)} placeholder="My brilliant zine" className="mt-5 w-full rounded-lg border-2 border-black p-3"/><div className="mt-4 flex justify-end gap-2"><button onClick={() => setNaming(false)} className="px-4 py-2">Not yet</button><button disabled={!title.trim() || title === "Untitled canvas"} onClick={() => { save(state, title); setNaming(false); }} className="rounded-lg border-2 border-black bg-[#FFEA69] px-4 py-2 font-bold disabled:opacity-40">Name & finish</button></div></div></div>}
  </main>;
}

function PageImage({ item }: { item: Page }) { if (!item.image) return <div className="grid h-full place-items-center text-xs font-bold text-black/30">Add image</div>; return <div className={clsx("h-full w-full", item.frame === "inset" && "p-[10%]", item.frame === "portrait" && "px-[18%] py-[5%]", item.frame === "split" && "pr-[28%] pb-[15%]")}><img src={item.image} alt="Selected zine page" className="h-full w-full border-black object-cover" /></div>; }
