"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

type Frame = "full" | "inset" | "portrait" | "split";
type Page = { image: string; frame: Frame; frameSet: boolean };
type TextLayer = { id: string; text: string; x: number; y: number; size: number };
type CanvasState = { pages: Page[]; background: string; backgroundSet: boolean; texts: TextLayer[] };
type SaveState = "loading" | "saved" | "saving" | "error";

const freshState = (): CanvasState => ({ pages: Array.from({ length: 8 }, () => ({ image: "", frame: "full" as Frame, frameSet: false })), background: "#FFF7D6", backgroundSet: false, texts: [] });
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
  return <main className="min-h-screen bg-[#E9E7DF] pb-24 text-[#171717]">
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b-2 border-black bg-[#FFFDF5] px-4 py-3 sm:px-7">
      <div><a href="/zinemat" className="text-xs font-bold uppercase tracking-widest">← ZineMat</a><h1 className="text-lg font-bold">{title}</h1></div>
      <div className="flex rounded-xl border-2 border-black bg-white p-1" aria-label="Editor view">
        <button onClick={() => setMode("page")} className={clsx("rounded-lg px-4 py-2 text-sm font-bold", mode === "page" && "bg-black text-white")}>▣ Page view</button>
        <button onClick={() => setMode("top")} className={clsx("rounded-lg px-4 py-2 text-sm font-bold", mode === "top" && "bg-[#AAEEFF]")}>⊞ Top view</button>
      </div>
      <div className={clsx("text-xs font-bold", saveState === "error" ? "text-red-600" : "text-gray-600")}><span className={clsx("mr-2 inline-block h-2 w-2 rounded-full", saveState === "saved" ? "bg-green-500" : saveState === "error" ? "bg-red-500" : "animate-pulse bg-amber-500")} />{saveState === "saved" ? "All changes saved" : saveState === "error" ? "Autosave failed" : "Autosaving…"}</div>
    </header>

    <div className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[260px_1fr_280px] lg:p-6">
      <aside className="space-y-3 rounded-2xl border-2 border-black bg-[#FFFDF5] p-3">
        <div className="rounded-xl border-2 border-black bg-white p-3"><p className="eyebrow">Step 1 · Images</p><label className="mt-2 block cursor-pointer rounded-xl border-2 border-dashed border-black bg-[#FFFDF5] p-4 text-center text-sm font-bold hover:bg-[#AAEEFF]">Choose up to 8 images<input type="file" accept="image/*" multiple className="sr-only" onChange={event => chooseImages(event.target.files)} /></label><p className="mt-2 text-xs text-gray-500">Images fill pages 1–8 in selection order.</p></div>
        <div className="rounded-xl border-2 border-black bg-white p-3"><p className="eyebrow">Step 2 · Frame</p><p className="mt-1 text-[11px] text-gray-500">Applies to page {page + 1}. Use Page view for a larger crop preview.</p><div className="mt-2 grid grid-cols-2 gap-2">{frames.map(frame => <button key={frame.id} onClick={() => update(current => ({ ...current, pages: current.pages.map((item, index) => index === page ? { ...item, frame: frame.id, frameSet: true } : item) }))} className={clsx("rounded-lg border-2 p-2 text-left", state.pages[page].frameSet && state.pages[page].frame === frame.id ? "border-black bg-[#FFEA69]" : "border-gray-300 bg-white")}><span className="block text-xs font-bold">{frame.label}</span><span className="text-[10px] text-gray-500">{frame.hint}</span></button>)}</div></div>
        <div className="rounded-xl border-2 border-black bg-white p-3"><p className="eyebrow">Step 3 · Global background</p><div className="mt-2 flex items-center gap-3"><input type="color" value={state.background} onChange={event => update(current => ({ ...current, background: event.target.value, backgroundSet: true }))} className="h-11 w-14 cursor-pointer rounded border"/><p className="text-xs text-gray-500">Applies consistently to all 8 pages.</p></div></div>
      </aside>

      <section className="min-w-0">
        {mode === "page" ? <>
          <div className="mb-3 flex items-center justify-between"><button onClick={() => movePage(page, -1)} disabled={page === 0} className="editor-button">← Move</button><b>Page {page + 1} of 8</b><button onClick={() => movePage(page, 1)} disabled={page === 7} className="editor-button">Move →</button></div>
          <div className="mx-auto aspect-[3/4] max-h-[680px] overflow-hidden border-2 border-black shadow-[8px_8px_0_#000]" style={{ background: state.background }}><PageImage item={state.pages[page]} /></div>
          <div className="mt-5 grid grid-cols-8 gap-2">{state.pages.map((item, index) => <button key={index} onClick={() => setPage(index)} className={clsx("aspect-[3/4] overflow-hidden border-2", page === index ? "border-black ring-2 ring-[#65CBF1]" : "border-gray-400")} style={{ background: state.background }}><PageImage item={item} /><span className="sr-only">Page {index + 1}</span></button>)}</div>
        </> : <>
          <div className="mb-3"><b>Top view · complete print sheet</b><p className="text-xs text-gray-600">Add and position type across the whole layout. Images and frames are locked in this view.</p></div>
          <div className="relative grid aspect-[11/8.5] grid-cols-4 grid-rows-2 overflow-hidden border-2 border-black shadow-[8px_8px_0_#000]" style={{ background: state.background }}>{state.pages.map((item, index) => <div key={index} className="relative overflow-hidden border border-black/20"><PageImage item={item}/><span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] text-white">{index + 1}</span></div>)}{state.texts.map(text => <div key={text.id} className="absolute cursor-move border border-dashed border-black/40 bg-white/30 px-1 font-bold leading-none" style={{ left: `${text.x}%`, top: `${text.y}%`, fontSize: `${Math.max(10, text.size / 2)}px` }}>{text.text}</div>)}</div>
        </>}
      </section>

      <aside className="rounded-2xl border-2 border-black bg-[#FFFDF5] p-3"><div className="rounded-xl border-2 border-black bg-white p-3"><p className="eyebrow">Step 4 · Type layer</p>{mode === "top" ? <><textarea value={textDraft} onChange={event => setTextDraft(event.target.value)} placeholder="Write something…" className="mt-2 w-full rounded-lg border-2 border-black p-3 text-sm"/><button onClick={addText} className="mt-2 w-full rounded-lg border-2 border-black bg-[#AAEEFF] py-2 text-sm font-bold">+ Add to sheet</button><div className="mt-4 space-y-4">{state.texts.map(text => <div key={text.id} className="rounded-lg border bg-white p-2"><div className="flex justify-between text-xs font-bold"><span className="truncate">{text.text}</span><button onClick={() => update(current => ({ ...current, texts: current.texts.filter(item => item.id !== text.id) }))}>×</button></div><label className="mt-2 block text-[10px]">Horizontal<input type="range" min="0" max="85" value={text.x} onChange={e => positionText(text.id, "x", +e.target.value)} className="w-full"/></label><label className="block text-[10px]">Vertical<input type="range" min="0" max="85" value={text.y} onChange={e => positionText(text.id, "y", +e.target.value)} className="w-full"/></label></div>)}</div></> : <div className="mt-2 rounded-xl bg-gray-100 p-4 text-sm">Type is edited in <b>Top view</b>, where it can move freely across page boundaries.<button onClick={() => setMode("top")} className="mt-3 block font-bold underline">Open top view →</button></div>}</div></aside>
    </div>

    <footer className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-black bg-[#171717] px-4 py-3 text-white"><div className="mx-auto flex max-w-[1450px] flex-wrap items-center gap-2"><b className="mr-2 text-sm">Canvas checklist</b>{steps.map((step, index) => <span key={step.label} className={clsx("rounded-full border px-3 py-1 text-xs", step.done ? "border-green-400 bg-green-400/20" : "border-white/30 text-white/60")}>{step.done ? "✓" : index + 1} {step.label} {step.detail}</span>)}<button disabled={!readyToName} onClick={() => setNaming(true)} className="ml-auto rounded-lg bg-[#FFEA69] px-4 py-2 text-sm font-bold text-black disabled:bg-gray-600 disabled:text-gray-300">Finish & name →</button></div></footer>
    {naming && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><div className="w-full max-w-md rounded-2xl border-2 border-black bg-[#FFFDF5] p-6 shadow-[8px_8px_0_#AAEEFF]"><p className="eyebrow">Final step</p><h2 className="mt-1 text-2xl font-bold">Name your mini zine</h2><p className="mt-2 text-sm text-gray-600">Your canvas already exists and is saved. This name will identify it in your library.</p><input autoFocus value={title === "Untitled canvas" ? "" : title} onChange={e => setTitle(e.target.value)} placeholder="My brilliant zine" className="mt-5 w-full rounded-lg border-2 border-black p-3"/><div className="mt-4 flex justify-end gap-2"><button onClick={() => setNaming(false)} className="px-4 py-2">Not yet</button><button disabled={!title.trim() || title === "Untitled canvas"} onClick={() => { save(state, title); setNaming(false); }} className="rounded-lg border-2 border-black bg-[#FFEA69] px-4 py-2 font-bold disabled:opacity-40">Name & finish</button></div></div></div>}
  </main>;
}

function PageImage({ item }: { item: Page }) { if (!item.image) return <div className="grid h-full place-items-center text-xs font-bold text-black/30">Add image</div>; return <div className={clsx("h-full w-full", item.frame === "inset" && "p-[10%]", item.frame === "portrait" && "px-[18%] py-[5%]", item.frame === "split" && "pr-[28%] pb-[15%]")}><img src={item.image} alt="Selected zine page" className="h-full w-full border-black object-cover" /></div>; }
