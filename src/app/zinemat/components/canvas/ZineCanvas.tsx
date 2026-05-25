"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import clsx from "clsx";

// ─── Canvas dimensions: 11 × 8.5 inches landscape at 200 dpi ─────────────────
const CW = 2200;
const CH = 1700;

// ─── Open Colors palette (Excalidraw's picks) ─────────────────────────────────
const PALETTE = [
  "#1e1e1e", // near-black
  "#868e96", // gray
  "#e03131", // red
  "#e8590c", // orange
  "#f59f00", // yellow
  "#2f9e44", // green
  "#0c8599", // teal
  "#1971c2", // blue
  "#7048e8", // violet
  "#c2255c", // pink
  "#ffffff", // white
];

const STROKE_SIZES = [
  { value: 2, dot: 4 },
  { value: 5, dot: 6 },
  { value: 10, dot: 9 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = "select" | "pencil" | "line" | "rect" | "ellipse" | "text" | "eraser";

interface Pt { x: number; y: number }

type El =
  | { id: number; type: "pencil"; pts: Pt[]; color: string; sw: number }
  | { id: number; type: "line"; x1: number; y1: number; x2: number; y2: number; color: string; sw: number }
  | { id: number; type: "rect"; x: number; y: number; w: number; h: number; color: string; sw: number }
  | { id: number; type: "ellipse"; cx: number; cy: number; rx: number; ry: number; color: string; sw: number }
  | { id: number; type: "text"; x: number; y: number; text: string; color: string; fs: number }
  | { id: number; type: "image"; x: number; y: number; w: number; h: number; src: string };

let _eid = 1;
const newId = () => _eid++;

// ─── Rough.js minimal interface (loaded via CDN) ──────────────────────────────

interface RoughOpts {
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  seed?: number;
  fill?: string;
}

interface RoughCanvas {
  line(x1: number, y1: number, x2: number, y2: number, opts?: RoughOpts): void;
  rectangle(x: number, y: number, w: number, h: number, opts?: RoughOpts): void;
  ellipse(cx: number, cy: number, width: number, height: number, opts?: RoughOpts): void;
}

interface RoughLib {
  canvas(el: HTMLCanvasElement): RoughCanvas;
}

interface WindowWithRough extends Window {
  rough?: RoughLib;
}

// ─── Coordinate helper ────────────────────────────────────────────────────────

function cvtPos(canvas: HTMLCanvasElement, e: React.MouseEvent): Pt {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH };
}

// ─── Smooth freehand via quadratic bezier midpoints ───────────────────────────

function strokePath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
  ctx.stroke();
}

// ─── Element renderer ─────────────────────────────────────────────────────────

function draw(ctx: CanvasRenderingContext2D, el: El, rc: RoughCanvas | null, imgs: Map<string, HTMLImageElement>) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (el.type) {
    case "pencil":
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.sw;
      strokePath(ctx, el.pts);
      break;

    case "line":
      if (rc) {
        rc.line(el.x1, el.y1, el.x2, el.y2, {
          stroke: el.color, strokeWidth: el.sw, roughness: 1.2, seed: el.id,
        });
      } else {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.sw;
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
      }
      break;

    case "rect":
      if (rc) {
        rc.rectangle(el.x, el.y, el.w, el.h, {
          stroke: el.color, strokeWidth: el.sw, roughness: 1.2, seed: el.id, fill: "none",
        });
      } else {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.sw;
        ctx.strokeRect(el.x, el.y, el.w, el.h);
      }
      break;

    case "ellipse":
      if (rc) {
        rc.ellipse(el.cx, el.cy, Math.abs(el.rx) * 2, Math.abs(el.ry) * 2, {
          stroke: el.color, strokeWidth: el.sw, roughness: 1.2, seed: el.id, fill: "none",
        });
      } else {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.sw;
        ctx.beginPath();
        ctx.ellipse(el.cx, el.cy, Math.abs(el.rx), Math.abs(el.ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;

    case "text":
      ctx.fillStyle = el.color;
      ctx.font = `${el.fs}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(el.text, el.x, el.y);
      break;

    case "image": {
      const img = imgs.get(el.src);
      if (img) ctx.drawImage(img, el.x, el.y, el.w, el.h);
      break;
    }
  }

  ctx.restore();
}

// ─── Toolbar icons ─────────────────────────────────────────────────────────────

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TOOLS: { id: Tool; label: string; key: string; icon: React.ReactNode }[] = [
  {
    id: "select", label: "Select", key: "V",
    icon: <Icon d="M4.5 3l11 7.5-5.5 1.5L8.5 17 4.5 3z" />,
  },
  {
    id: "pencil", label: "Draw", key: "P",
    icon: <Icon d="M14 3a1.5 1.5 0 012.12 2.12L6.5 14.62l-3.5 1 1-3.5L14 3z" />,
  },
  {
    id: "eraser", label: "Eraser", key: "X",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <path d="M3 17h8" strokeLinecap="round" />
        <path d="M12.5 4.5l3 3-7 7-4-1 1-4 7-5z" strokeLinejoin="round" />
        <path d="M9.5 7.5l3 3" />
      </svg>
    ),
  },
  {
    id: "line", label: "Line", key: "L",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <line x1="3.5" y1="16.5" x2="16.5" y2="3.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "rect", label: "Rectangle", key: "R",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <rect x="3" y="5" width="14" height="10" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "ellipse", label: "Ellipse", key: "E",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <ellipse cx="10" cy="10" rx="7" ry="5" />
      </svg>
    ),
  },
  {
    id: "text", label: "Text", key: "T",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <path d="M3 5h14M10 5v12M7 17h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ZineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#1e1e1e");
  const [sw, setSw] = useState(2);
  const [els, setEls] = useState<El[]>([]);
  const [history, setHistory] = useState<El[][]>([]);

  // Drawing refs (no re-render needed)
  const isDrawing = useRef(false);
  const origin = useRef<Pt>({ x: 0, y: 0 });
  const live = useRef<El | null>(null);
  const roughLib = useRef<RoughLib | null>(null);
  const imgs = useRef<Map<string, HTMLImageElement>>(new Map());
  const elsRef = useRef<El[]>([]);
  const colorRef = useRef(color);

  useEffect(() => { colorRef.current = color; }, [color]);

  // Text overlay state
  const [txt, setTxt] = useState({
    visible: false, cx: 0, cy: 0, left: 0, top: 0, scale: 1, val: "",
  });

  // Export modal
  const [modal, setModal] = useState({ open: false, title: "untitled-1" });

  // ── Load rough.js 4.6.4 from CDN ─────────────────────────────────────────

  useEffect(() => {
    if ((window as WindowWithRough).rough) { roughLib.current = (window as WindowWithRough).rough ?? null; return; }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/roughjs@4.6.4/bundled/rough.js";
    s.onload = () => {
      roughLib.current = (window as WindowWithRough).rough ?? null;
      redraw(elsRef.current, null);
    };
    document.head.appendChild(s);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redraw ───────────────────────────────────────────────────────────────

  const redraw = useCallback((committed: El[], current: El | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CW, CH);

    const rc = roughLib.current ? roughLib.current.canvas(canvas) : null;
    [...committed, ...(current ? [current] : [])].forEach((el) => draw(ctx, el, rc, imgs.current));
  }, []);

  useEffect(() => {
    elsRef.current = els;
    // Preload images
    els.forEach((el) => {
      if (el.type === "image" && !imgs.current.has(el.src)) {
        const img = new Image();
        img.onload = () => { imgs.current.set(el.src, img); redraw(elsRef.current, null); };
        img.src = el.src;
      }
    });
    redraw(els, null);
  }, [els, redraw]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const map: Record<string, Tool> = { v: "select", p: "pencil", l: "line", r: "rect", e: "ellipse", t: "text", x: "eraser" };
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (map[e.key.toLowerCase()]) { setTool(map[e.key.toLowerCase()] as Tool); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        setHistory((prev) => {
          if (!prev.length) return prev;
          const next = [...prev];
          setEls(next.pop()!);
          return next;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Text commit ───────────────────────────────────────────────────────────

  const committing = useRef(false);

  const commitTxt = useCallback(() => {
    if (committing.current) return;
    committing.current = true;
    setTxt((s) => {
      committing.current = false;
      if (!s.visible) return s;
      if (!s.val.trim()) return { ...s, visible: false, val: "" };
      const el: El = { id: newId(), type: "text", x: s.cx, y: s.cy, text: s.val, color: colorRef.current, fs: 72 };
      setEls((prev) => { setHistory((h) => [...h, prev]); return [...prev, el]; });
      return { ...s, visible: false, val: "" };
    });
  }, []);

  // ── Mouse handlers ────────────────────────────────────────────────────────

  function onDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool === "select") return;

    const canvas = canvasRef.current!;
    const pt = cvtPos(canvas, e);

    if (tool === "text") {
      const r = canvas.getBoundingClientRect();
      const scale = r.width / CW;
      setTxt({
        visible: true,
        cx: pt.x, cy: pt.y,
        left: e.clientX - r.left,
        top: e.clientY - r.top,
        scale, val: "",
      });
      return;
    }

    isDrawing.current = true;
    origin.current = pt;

    if (tool === "pencil" || tool === "eraser") {
      live.current = {
        id: newId(), type: "pencil", pts: [pt],
        color: tool === "eraser" ? "#ffffff" : color,
        sw: tool === "eraser" ? Math.max(sw * 6, 40) : sw,
      };
    }
  }

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current!;
    const pt = cvtPos(canvas, e);
    const o = origin.current;

    if (tool === "pencil" || tool === "eraser") {
      const el = live.current as Extract<El, { type: "pencil" }> | null;
      if (el) live.current = { ...el, pts: [...el.pts, pt] };
    } else if (tool === "line") {
      live.current = { id: newId(), type: "line", x1: o.x, y1: o.y, x2: pt.x, y2: pt.y, color, sw };
    } else if (tool === "rect") {
      live.current = {
        id: newId(), type: "rect",
        x: Math.min(o.x, pt.x), y: Math.min(o.y, pt.y),
        w: Math.abs(pt.x - o.x), h: Math.abs(pt.y - o.y),
        color, sw,
      };
    } else if (tool === "ellipse") {
      live.current = {
        id: newId(), type: "ellipse",
        cx: (o.x + pt.x) / 2, cy: (o.y + pt.y) / 2,
        rx: Math.abs(pt.x - o.x) / 2, ry: Math.abs(pt.y - o.y) / 2,
        color, sw,
      };
    }

    redraw(elsRef.current, live.current);
  }

  function onUp() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (live.current) {
      const committed = live.current;
      live.current = null;
      setEls((prev) => { setHistory((h) => [...h, prev]); return [...prev, committed]; });
    }
  }

  // ── Image helpers ─────────────────────────────────────────────────────────

  function placeImage(src: string, dropPx?: { x: number; y: number }) {
    const img = new Image();
    img.onload = () => {
      const maxW = CW * 0.45;
      const ratio = img.width > maxW ? maxW / img.width : 1;
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = dropPx ? dropPx.x - w / 2 : (CW - w) / 2;
      const y = dropPx ? dropPx.y - h / 2 : (CH - h) / 2;
      imgs.current.set(src, img);
      const el: El = { id: newId(), type: "image", x, y, w, h, src };
      setEls((prev) => { setHistory((h) => [...h, prev]); return [...prev, el]; });
    };
    img.src = src;
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const dropPx = {
      x: ((e.clientX - r.left) / r.width) * CW,
      y: ((e.clientY - r.top) / r.height) * CH,
    };
    const reader = new FileReader();
    reader.onload = (ev) => placeImage(ev.target!.result as string, dropPx);
    reader.readAsDataURL(file);
  }

  function onImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => placeImage(ev.target!.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── Undo / Clear ──────────────────────────────────────────────────────────

  function undo() {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      setEls(next.pop()!);
      return next;
    });
  }

  function clearAll() {
    setEls((prev) => { setHistory((h) => [...h, prev]); return []; });
  }

  // ── PDF export ────────────────────────────────────────────────────────────

  async function exportPDF(title: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const { PDFDocument } = await import("pdf-lib");
      const dataUrl = canvas.toDataURL("image/png");
      const b64 = dataUrl.split(",")[1];
      const pngBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const pdf = await PDFDocument.create();
      const img = await pdf.embedPng(pngBytes);
      // 11 × 8.5 landscape in PDF points (72 pt/inch)
      const page = pdf.addPage([792, 612]);
      page.drawImage(img, { x: 0, y: 0, width: 792, height: 612 });
      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(title.trim() || "untitled").replace(/\s+/g, "-")}.pdf`;
      a.click();
    } catch (err) {
      console.error("PDF export failed:", err);
    }
    setModal({ open: false, title: "untitled-1" });
  }

  // ── Cursors ───────────────────────────────────────────────────────────────

  const cursors: Record<Tool, string> = {
    select: "default", pencil: "crosshair", eraser: "crosshair",
    line: "crosshair", rect: "crosshair", ellipse: "crosshair", text: "text",
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">

        {/* Drawing tools */}
        <div className="flex items-center gap-0.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={`${t.label}  (${t.key})`}
              onClick={() => setTool(t.id)}
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                tool === t.id ? "bg-[#65CBF1] text-white" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {t.icon}
            </button>
          ))}

          {/* Image insert */}
          <button
            type="button"
            title="Insert image"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
              <rect x="2" y="4" width="16" height="12" rx="1.5" />
              <circle cx="7" cy="8.5" r="1.5" />
              <path d="M2 14l4.5-4.5 3 3 2.5-2.5L18 14" strokeLinejoin="round" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImagePick} />
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Color swatches */}
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => setColor(c)}
              className={clsx(
                "h-5 w-5 rounded-full border transition",
                c === "#ffffff" ? "border-gray-300" : "border-transparent",
                color === c && "ring-2 ring-[#65CBF1] ring-offset-1"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Stroke sizes */}
        <div className="flex items-center gap-0.5">
          {STROKE_SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              title={`Stroke ${s.value}px`}
              onClick={() => setSw(s.value)}
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                sw === s.value ? "bg-[#65CBF1]" : "hover:bg-gray-100"
              )}
            >
              <span
                className="rounded-full"
                style={{
                  width: s.dot,
                  height: s.dot,
                  backgroundColor: sw === s.value ? "white" : "#374151",
                }}
              />
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Undo */}
        <button
          type="button"
          title="Undo  (⌘Z)"
          onClick={undo}
          disabled={!history.length}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:opacity-30"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16">
            <path d="M4.5 8H12a5 5 0 010 10H6.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7.5 5L4.5 8l3 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Clear */}
        <button
          type="button"
          onClick={clearAll}
          className="flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600"
        >
          Clear
        </button>

        {/* Save Draft */}
        <button
          type="button"
          onClick={() => setModal({ open: true, title: "untitled-1" })}
          className="ml-auto flex h-8 items-center rounded-lg bg-gray-900 px-4 text-xs font-semibold text-white transition hover:bg-gray-700"
        >
          Save Draft
        </button>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        className="relative rounded-sm shadow-[0_4px_28px_rgba(0,0,0,0.12)]"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{ cursor: cursors[tool], width: "100%", height: "auto", display: "block" }}
          className="rounded-sm"
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        />

        {/* Text input — absolutely positioned within container */}
        {txt.visible && (
          <textarea
            autoFocus
            rows={1}
            value={txt.val}
            onChange={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
              setTxt((s) => ({ ...s, val: e.target.value }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setTxt((s) => ({ ...s, visible: false, val: "" }));
              // Ctrl/Cmd+Enter commits; plain Enter adds newline for multi-line text
              if ((e.key === "Enter" && (e.metaKey || e.ctrlKey))) commitTxt();
            }}
            onBlur={commitTxt}
            style={{
              position: "absolute",
              left: txt.left,
              top: txt.top,
              fontSize: `${Math.round(72 * txt.scale)}px`,
              fontFamily: "sans-serif",
              lineHeight: 1.2,
              color: color,
              background: "rgba(255,255,255,0.88)",
              border: "1.5px dashed #aaa",
              outline: "none",
              padding: "2px 6px",
              minWidth: 120,
              resize: "none",
              overflow: "hidden",
              zIndex: 10,
            }}
          />
        )}
      </div>

      {/* Hint */}
      <p className="text-center text-xs text-gray-400">
        V · P · L · R · E · T · X — shortcuts · ⌘Z undo · drag images onto canvas
      </p>

      {/* ── Save Draft modal ── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">Save draft</h3>
            <p className="mb-4 text-sm text-gray-500">
              Give your zine a title — it will download as a PDF.
            </p>
            <input
              autoFocus
              value={modal.title}
              onChange={(e) => setModal((s) => ({ ...s, title: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") exportPDF(modal.title); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#65CBF1] focus:ring-2 focus:ring-[#65CBF1]/30"
              placeholder="untitled-1"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal((s) => ({ ...s, open: false }))}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => exportPDF(modal.title)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              >
                Export PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
