"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import clsx from "clsx";

// ─── Canvas dimensions: 11 × 8.5 in landscape at 200 dpi ─────────────────────
const CW = 2200;
const CH = 1700;

// ─── Palettes ────────────────────────────────────────────────────────────────
const STROKE_PALETTE = [
  "#1e1e1e", "#868e96", "#e03131", "#e8590c",
  "#f59f00", "#2f9e44", "#0c8599", "#1971c2",
  "#7048e8", "#c2255c",
];

const BG_PALETTE = [
  "none", "#ffffff", "#ffe3e3", "#ffe8cc",
  "#fff3bf", "#d3f9d8", "#d0ebff", "#e5dbff",
];

// ─── Types ────────────────────────────────────────────────────────────────────
type Tool = "select" | "pencil" | "line" | "rect" | "ellipse" | "text" | "eraser";
type FillStyle = "none" | "hachure" | "solid";
type StrokeDash = "solid" | "dashed" | "dotted";
type HandleId = "TL" | "TR" | "BL" | "BR";

interface Pt { x: number; y: number }
interface BBox { x: number; y: number; w: number; h: number }

interface ElBase { id: number; color: string; sw: number; opacity: number }

type El =
  | (ElBase & { type: "pencil"; pts: Pt[] })
  | (ElBase & { type: "line"; x1: number; y1: number; x2: number; y2: number; roughness: number; dash: StrokeDash })
  | (ElBase & { type: "rect"; x: number; y: number; w: number; h: number; roughness: number; dash: StrokeDash; fillStyle: FillStyle; fillColor: string })
  | (ElBase & { type: "ellipse"; cx: number; cy: number; rx: number; ry: number; roughness: number; dash: StrokeDash; fillStyle: FillStyle; fillColor: string })
  | (ElBase & { type: "text"; x: number; y: number; text: string; fs: number })
  | (ElBase & { type: "image"; x: number; y: number; w: number; h: number; src: string });

interface SelAction {
  mode: "moving" | "resizing";
  handle?: HandleId;
  startPt: Pt;
  origEl: El;
}

let _eid = 1;
const newId = () => _eid++;

// ─── Rough.js types (CDN) ─────────────────────────────────────────────────────
interface RoughOpts {
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  seed?: number;
  fill?: string;
  fillStyle?: string;
  strokeLineDash?: number[];
}
interface RoughCanvas {
  line(x1: number, y1: number, x2: number, y2: number, opts?: RoughOpts): void;
  rectangle(x: number, y: number, w: number, h: number, opts?: RoughOpts): void;
  ellipse(cx: number, cy: number, width: number, height: number, opts?: RoughOpts): void;
}
interface RoughLib { canvas(el: HTMLCanvasElement): RoughCanvas }
interface WindowWithRough extends Window { rough?: RoughLib }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function cvtPos(canvas: HTMLCanvasElement, e: React.MouseEvent): Pt {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH };
}

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

function getBBox(el: El): BBox {
  switch (el.type) {
    case "rect": return { x: el.x, y: el.y, w: el.w, h: el.h };
    case "ellipse": return { x: el.cx - Math.abs(el.rx), y: el.cy - Math.abs(el.ry), w: Math.abs(el.rx) * 2, h: Math.abs(el.ry) * 2 };
    case "image": return { x: el.x, y: el.y, w: el.w, h: el.h };
    case "line": return {
      x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2),
      w: Math.abs(el.x2 - el.x1) || 4, h: Math.abs(el.y2 - el.y1) || 4,
    };
    case "pencil": {
      const xs = el.pts.map((p) => p.x); const ys = el.pts.map((p) => p.y);
      const x = Math.min(...xs); const y = Math.min(...ys);
      return { x, y, w: (Math.max(...xs) - x) || 4, h: (Math.max(...ys) - y) || 4 };
    }
    case "text": return { x: el.x, y: el.y, w: 400, h: el.fs * 1.4 };
  }
}

const HANDLE_R = 18; // hit radius in canvas coords
function getHandles(bbox: BBox): Record<HandleId, Pt> {
  return {
    TL: { x: bbox.x, y: bbox.y },
    TR: { x: bbox.x + bbox.w, y: bbox.y },
    BL: { x: bbox.x, y: bbox.y + bbox.h },
    BR: { x: bbox.x + bbox.w, y: bbox.y + bbox.h },
  };
}

function hitHandle(pt: Pt, bbox: BBox): HandleId | null {
  const handles = getHandles(bbox);
  for (const [k, h] of Object.entries(handles)) {
    if (Math.abs(pt.x - h.x) < HANDLE_R && Math.abs(pt.y - h.y) < HANDLE_R) return k as HandleId;
  }
  return null;
}

function hitEl(pt: Pt, el: El): boolean {
  const P = 22;
  switch (el.type) {
    case "rect": return pt.x >= el.x - P && pt.x <= el.x + el.w + P && pt.y >= el.y - P && pt.y <= el.y + el.h + P;
    case "ellipse": {
      const dx = (pt.x - el.cx) / (Math.abs(el.rx) + P);
      const dy = (pt.y - el.cy) / (Math.abs(el.ry) + P);
      return dx * dx + dy * dy <= 1;
    }
    case "image": return pt.x >= el.x - P && pt.x <= el.x + el.w + P && pt.y >= el.y - P && pt.y <= el.y + el.h + P;
    case "line": {
      const dx = el.x2 - el.x1; const dy = el.y2 - el.y1;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) return Math.hypot(pt.x - el.x1, pt.y - el.y1) < P * 2;
      const t = Math.max(0, Math.min(1, ((pt.x - el.x1) * dx + (pt.y - el.y1) * dy) / len2));
      return Math.hypot(pt.x - (el.x1 + t * dx), pt.y - (el.y1 + t * dy)) < P * 2;
    }
    case "pencil": return el.pts.some((p) => Math.hypot(pt.x - p.x, pt.y - p.y) < P * 2);
    case "text": return pt.x >= el.x - P && pt.x <= el.x + 500 && pt.y >= el.y - P && pt.y <= el.y + el.fs * 1.6;
  }
}

function moveEl(el: El, dx: number, dy: number): El {
  switch (el.type) {
    case "rect": return { ...el, x: el.x + dx, y: el.y + dy };
    case "ellipse": return { ...el, cx: el.cx + dx, cy: el.cy + dy };
    case "image": return { ...el, x: el.x + dx, y: el.y + dy };
    case "line": return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case "pencil": return { ...el, pts: el.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case "text": return { ...el, x: el.x + dx, y: el.y + dy };
  }
}

function resizeEl(el: El, handle: HandleId, pt: Pt): El {
  const orig = getBBox(el);
  let { x, y, w, h } = orig;
  if (handle === "TL") { w += (x - pt.x); h += (y - pt.y); x = pt.x; y = pt.y; }
  if (handle === "TR") { w = pt.x - x; h += (y - pt.y); y = pt.y; }
  if (handle === "BL") { w += (x - pt.x); h = pt.y - y; x = pt.x; }
  if (handle === "BR") { w = pt.x - x; h = pt.y - y; }
  w = Math.max(10, w); h = Math.max(10, h);
  switch (el.type) {
    case "rect": return { ...el, x, y, w, h };
    case "ellipse": return { ...el, cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2 };
    case "image": return { ...el, x, y, w, h };
    default: return el;
  }
}

function dashArr(dash: StrokeDash): number[] {
  if (dash === "dashed") return [24, 12];
  if (dash === "dotted") return [6, 10];
  return [];
}

// ─── Draw one element ─────────────────────────────────────────────────────────
function drawEl(ctx: CanvasRenderingContext2D, el: El, rc: RoughCanvas | null, imgs: Map<string, HTMLImageElement>) {
  ctx.save();
  ctx.globalAlpha = el.opacity / 100;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (el.type) {
    case "pencil":
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.sw;
      strokePath(ctx, el.pts);
      break;

    case "line": {
      const lDash = dashArr(el.dash);
      if (rc) {
        rc.line(el.x1, el.y1, el.x2, el.y2, {
          stroke: el.color, strokeWidth: el.sw, roughness: el.roughness, seed: el.id,
          ...(lDash.length ? { strokeLineDash: lDash } : {}),
        });
      } else {
        ctx.strokeStyle = el.color; ctx.lineWidth = el.sw;
        if (lDash.length) ctx.setLineDash(lDash);
        ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke();
      }
      break;
    }

    case "rect": {
      const rDash = dashArr(el.dash);
      if (rc) {
        const opts: RoughOpts = {
          stroke: el.color, strokeWidth: el.sw, roughness: el.roughness, seed: el.id,
          ...(rDash.length ? { strokeLineDash: rDash } : {}),
        };
        if (el.fillStyle !== "none" && el.fillColor !== "none") {
          opts.fill = el.fillColor;
          opts.fillStyle = el.fillStyle === "hachure" ? "hachure" : "solid";
        }
        rc.rectangle(el.x, el.y, el.w, el.h, opts);
      } else {
        ctx.strokeStyle = el.color; ctx.lineWidth = el.sw;
        if (rDash.length) ctx.setLineDash(rDash);
        if (el.fillStyle !== "none" && el.fillColor !== "none") {
          ctx.fillStyle = el.fillColor; ctx.fillRect(el.x, el.y, el.w, el.h);
        }
        ctx.strokeRect(el.x, el.y, el.w, el.h);
      }
      break;
    }

    case "ellipse": {
      const eDash = dashArr(el.dash);
      if (rc) {
        const opts: RoughOpts = {
          stroke: el.color, strokeWidth: el.sw, roughness: el.roughness, seed: el.id,
          ...(eDash.length ? { strokeLineDash: eDash } : {}),
        };
        if (el.fillStyle !== "none" && el.fillColor !== "none") {
          opts.fill = el.fillColor;
          opts.fillStyle = el.fillStyle === "hachure" ? "hachure" : "solid";
        }
        rc.ellipse(el.cx, el.cy, Math.abs(el.rx) * 2, Math.abs(el.ry) * 2, opts);
      } else {
        ctx.strokeStyle = el.color; ctx.lineWidth = el.sw;
        if (eDash.length) ctx.setLineDash(eDash);
        if (el.fillStyle !== "none" && el.fillColor !== "none") {
          ctx.fillStyle = el.fillColor;
          ctx.beginPath(); ctx.ellipse(el.cx, el.cy, Math.abs(el.rx), Math.abs(el.ry), 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath(); ctx.ellipse(el.cx, el.cy, Math.abs(el.rx), Math.abs(el.ry), 0, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }

    case "text":
      ctx.fillStyle = el.color;
      ctx.font = `${el.fs}px sans-serif`;
      ctx.textBaseline = "top";
      for (const [i, line] of el.text.split("\n").entries()) ctx.fillText(line, el.x, el.y + i * el.fs * 1.2);
      break;

    case "image": {
      const img = imgs.get(el.src);
      if (img) ctx.drawImage(img, el.x, el.y, el.w, el.h);
      break;
    }
  }
  ctx.restore();
}

// ─── Draw selection handles ───────────────────────────────────────────────────
const SEL_PAD = 10;
const HSIZE = 20;

function drawSelection(ctx: CanvasRenderingContext2D, el: El) {
  const bb = getBBox(el);
  const x = bb.x - SEL_PAD, y = bb.y - SEL_PAD, w = bb.w + SEL_PAD * 2, h = bb.h + SEL_PAD * 2;
  ctx.save();
  ctx.strokeStyle = "#65CBF1";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  const handles = getHandles({ x, y, w, h });
  for (const hp of Object.values(handles)) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(hp.x - HSIZE / 2, hp.y - HSIZE / 2, HSIZE, HSIZE);
    ctx.strokeRect(hp.x - HSIZE / 2, hp.y - HSIZE / 2, HSIZE, HSIZE);
  }
  ctx.restore();
}

// ─── Toolbar icons ────────────────────────────────────────────────────────────
function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TOOLS: { id: Tool; label: string; key: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select", key: "V", icon: <Icon d="M4.5 3l11 7.5-5.5 1.5L8.5 17 4.5 3z" /> },
  { id: "pencil", label: "Draw", key: "P", icon: <Icon d="M14 3a1.5 1.5 0 012.12 2.12L6.5 14.62l-3.5 1 1-3.5L14 3z" /> },
  {
    id: "eraser", label: "Eraser", key: "X",
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><path d="M3 17h8" strokeLinecap="round" /><path d="M12.5 4.5l3 3-7 7-4-1 1-4 7-5z" strokeLinejoin="round" /><path d="M9.5 7.5l3 3" /></svg>,
  },
  {
    id: "line", label: "Line", key: "L",
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><line x1="3.5" y1="16.5" x2="16.5" y2="3.5" strokeLinecap="round" /></svg>,
  },
  {
    id: "rect", label: "Rectangle", key: "R",
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><rect x="3" y="5" width="14" height="10" rx="1.5" /></svg>,
  },
  {
    id: "ellipse", label: "Ellipse", key: "E",
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><ellipse cx="10" cy="10" rx="7" ry="5" /></svg>,
  },
  {
    id: "text", label: "Text", key: "T",
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17"><path d="M3 5h14M10 5v12M7 17h6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ZineCanvas({ format = "mini" }: { format?: "mini" | "half_letter" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drawing state
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#1e1e1e");
  const [fillColor, setFillColor] = useState("none");
  const [fillStyle, setFillStyle] = useState<FillStyle>("none");
  const [sw, setSw] = useState(2);
  const [roughness, setRoughness] = useState(1.2);
  const [dash, setDash] = useState<StrokeDash>("solid");
  const [opacity, setOpacity] = useState(100);

  const [els, setEls] = useState<El[]>([]);
  const [history, setHistory] = useState<El[][]>([]);
  const [selId, setSelId] = useState<number | null>(null);

  // Refs that mirror state for use in event handlers / redraw (avoid stale closures)
  const elsRef = useRef<El[]>([]);
  const selIdRef = useRef<number | null>(null);
  const colorRef = useRef(color);
  const swRef = useRef(sw);
  const opacityRef = useRef(opacity);
  const roughLib = useRef<RoughLib | null>(null);
  const imgs = useRef<Map<string, HTMLImageElement>>(new Map());

  // Drawing refs
  const isDrawing = useRef(false);
  const origin = useRef<Pt>({ x: 0, y: 0 });
  const live = useRef<El | null>(null);

  // Selection drag refs
  const selAction = useRef<SelAction | null>(null);
  const selLive = useRef<El | null>(null); // dragged element before committing to state

  // Keep refs in sync
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { swRef.current = sw; }, [sw]);
  useEffect(() => { opacityRef.current = opacity; }, [opacity]);

  // Text overlay
  const [txt, setTxt] = useState({ visible: false, cx: 0, cy: 0, left: 0, top: 0, scale: 1, val: "" });

  // Save modal
  const [modal, setModal] = useState({ open: false, title: "" });
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Load rough.js ─────────────────────────────────────────────────────────
  useEffect(() => {
    if ((window as WindowWithRough).rough) { roughLib.current = (window as WindowWithRough).rough ?? null; return; }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/roughjs@4.6.4/bundled/rough.js";
    s.onload = () => { roughLib.current = (window as WindowWithRough).rough ?? null; redraw(); };
    document.head.appendChild(s);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redraw (reads all refs directly) ─────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CW, CH);
    const rc = roughLib.current ? roughLib.current.canvas(canvas) : null;

    // Use live-dragged version of selected element if dragging
    const displayEls = selLive.current
      ? elsRef.current.map((e) => (e.id === selLive.current!.id ? selLive.current! : e))
      : elsRef.current;

    const all = [...displayEls, ...(live.current ? [live.current] : [])];
    all.forEach((el) => drawEl(ctx, el, rc, imgs.current));

    // Draw selection on top
    if (selIdRef.current !== null) {
      const sel = displayEls.find((e) => e.id === selIdRef.current);
      if (sel) drawSelection(ctx, sel);
    }
  }, []);

  useEffect(() => {
    elsRef.current = els;
    els.forEach((el) => {
      if (el.type === "image" && !imgs.current.has(el.src)) {
        const img = new Image();
        img.onload = () => { imgs.current.set(el.src, img); redraw(); };
        img.src = el.src;
      }
    });
    redraw();
  }, [els, redraw]);

  // Keep selIdRef in sync with state
  useEffect(() => { selIdRef.current = selId; redraw(); }, [selId, redraw]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const toolMap: Record<string, Tool> = { v: "select", p: "pencil", l: "line", r: "rect", e: "ellipse", t: "text", x: "eraser" };
    function onKey(ev: KeyboardEvent) {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      const k = ev.key.toLowerCase();
      if (toolMap[k]) { setTool(toolMap[k] as Tool); return; }
      if ((ev.metaKey || ev.ctrlKey) && k === "z") { ev.preventDefault(); undo(); return; }
      if ((ev.key === "Backspace" || ev.key === "Delete") && selIdRef.current !== null) {
        const id = selIdRef.current;
        selIdRef.current = null;
        setSelId(null);
        setEls((prev) => { setHistory((h) => [...h, prev]); return prev.filter((e) => e.id !== id); });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Patch selected element ────────────────────────────────────────────────
  function patchSel(patch: Record<string, unknown>) {
    if (selIdRef.current === null) return;
    setEls((prev) => prev.map((e) => (e.id === selIdRef.current ? { ...e, ...patch } as El : e)));
  }

  // ── Text commit ───────────────────────────────────────────────────────────
  const committing = useRef(false);
  const commitTxt = useCallback(() => {
    if (committing.current) return;
    committing.current = true;
    setTxt((s) => {
      committing.current = false;
      if (!s.visible) return s;
      if (!s.val.trim()) return { ...s, visible: false, val: "" };
      const el: El = { id: newId(), type: "text", x: s.cx, y: s.cy, text: s.val, color: colorRef.current, fs: 72, sw: swRef.current, opacity: opacityRef.current };
      setEls((prev) => { setHistory((h) => [...h, prev]); return [...prev, el]; });
      return { ...s, visible: false, val: "" };
    });
  }, []);

  // ── Mouse handlers ────────────────────────────────────────────────────────
  function onDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const pt = cvtPos(canvas, e);

    if (tool === "select") {
      // Check if on a handle of selected element
      if (selIdRef.current !== null) {
        const selEl = elsRef.current.find((el) => el.id === selIdRef.current);
        if (selEl) {
          const bb = getBBox(selEl);
          const padBB = { x: bb.x - SEL_PAD, y: bb.y - SEL_PAD, w: bb.w + SEL_PAD * 2, h: bb.h + SEL_PAD * 2 };
          const handle = hitHandle(pt, padBB);
          if (handle) {
            selAction.current = { mode: "resizing", handle, startPt: pt, origEl: selEl };
            return;
          }
        }
      }
      // Hit test elements (top-most first)
      const hit = [...elsRef.current].reverse().find((el) => hitEl(pt, el));
      if (hit) {
        selIdRef.current = hit.id;
        setSelId(hit.id);
        // Sync sidebar to selected element
        setColor(hit.color);
        setSw(hit.sw);
        setOpacity(hit.opacity);
        if ("roughness" in hit) setRoughness(hit.roughness);
        if ("dash" in hit) setDash(hit.dash);
        if ("fillStyle" in hit) setFillStyle(hit.fillStyle);
        if ("fillColor" in hit) setFillColor(hit.fillColor);
        selAction.current = { mode: "moving", startPt: pt, origEl: hit };
      } else {
        selIdRef.current = null;
        setSelId(null);
        selAction.current = null;
      }
      return;
    }

    if (tool === "text") {
      const r = canvas.getBoundingClientRect();
      const scale = r.width / CW;
      setTxt({ visible: true, cx: pt.x, cy: pt.y, left: e.clientX - r.left, top: e.clientY - r.top, scale, val: "" });
      return;
    }

    isDrawing.current = true;
    origin.current = pt;

    if (tool === "pencil" || tool === "eraser") {
      live.current = {
        id: newId(), type: "pencil", pts: [pt],
        color: tool === "eraser" ? "#ffffff" : color,
        sw: tool === "eraser" ? Math.max(sw * 6, 40) : sw,
        opacity,
      };
    }
  }

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    // Handle selection drag/resize
    if (tool === "select" && selAction.current) {
      const canvas = canvasRef.current!;
      const pt = cvtPos(canvas, e);
      const { mode, startPt, origEl, handle } = selAction.current;
      const dx = pt.x - startPt.x;
      const dy = pt.y - startPt.y;
      if (mode === "moving") {
        selLive.current = moveEl(origEl, dx, dy);
      } else if (mode === "resizing" && handle) {
        selLive.current = resizeEl(origEl, handle, pt);
      }
      redraw();
      return;
    }

    if (!isDrawing.current) return;
    const canvas = canvasRef.current!;
    const pt = cvtPos(canvas, e);
    const o = origin.current;

    if (tool === "pencil" || tool === "eraser") {
      const el = live.current as Extract<El, { type: "pencil" }> | null;
      if (el) live.current = { ...el, pts: [...el.pts, pt] };
    } else if (tool === "line") {
      live.current = { id: newId(), type: "line", x1: o.x, y1: o.y, x2: pt.x, y2: pt.y, color, sw, opacity, roughness, dash };
    } else if (tool === "rect") {
      live.current = {
        id: newId(), type: "rect",
        x: Math.min(o.x, pt.x), y: Math.min(o.y, pt.y),
        w: Math.abs(pt.x - o.x), h: Math.abs(pt.y - o.y),
        color, sw, opacity, roughness, dash, fillStyle, fillColor,
      };
    } else if (tool === "ellipse") {
      live.current = {
        id: newId(), type: "ellipse",
        cx: (o.x + pt.x) / 2, cy: (o.y + pt.y) / 2,
        rx: Math.abs(pt.x - o.x) / 2, ry: Math.abs(pt.y - o.y) / 2,
        color, sw, opacity, roughness, dash, fillStyle, fillColor,
      };
    }
    redraw();
  }

  function onUp() {
    // Commit selection drag
    if (tool === "select" && selAction.current && selLive.current) {
      const committed = selLive.current;
      selLive.current = null;
      selAction.current = null;
      setEls((prev) => { setHistory((h) => [...h, prev]); return prev.map((e) => (e.id === committed.id ? committed : e)); });
      return;
    }
    selAction.current = null;

    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (live.current) {
      const committed = live.current;
      live.current = null;
      setEls((prev) => { setHistory((h) => [...h, prev]); return [...prev, committed]; });
    }
  }

  // ── Image helpers ─────────────────────────────────────────────────────────
  function placeImage(src: string, dropPx?: Pt) {
    const img = new Image();
    img.onload = () => {
      const maxW = CW * 0.45;
      const ratio = img.width > maxW ? maxW / img.width : 1;
      const w = img.width * ratio; const h = img.height * ratio;
      const x = dropPx ? dropPx.x - w / 2 : (CW - w) / 2;
      const y = dropPx ? dropPx.y - h / 2 : (CH - h) / 2;
      imgs.current.set(src, img);
      const el: El = { id: newId(), type: "image", x, y, w, h, src, color: "#000000", sw: 0, opacity: 100 };
      setEls((prev) => { setHistory((h) => [...h, prev]); return [...prev, el]; });
    };
    img.src = src;
  }

  function onDrop(ev: React.DragEvent<HTMLDivElement>) {
    ev.preventDefault();
    const file = Array.from(ev.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const dropPx = { x: ((ev.clientX - r.left) / r.width) * CW, y: ((ev.clientY - r.top) / r.height) * CH };
    const reader = new FileReader();
    reader.onload = (ev2) => placeImage(ev2.target!.result as string, dropPx);
    reader.readAsDataURL(file);
  }

  function onImagePick(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev2) => placeImage(ev2.target!.result as string);
    reader.readAsDataURL(file);
    ev.target.value = "";
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
    selIdRef.current = null; setSelId(null);
  }

  // ── Save & Export ─────────────────────────────────────────────────────────
  async function saveAndExport(title: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setSaveResult(null);

    try {
      // Generate PDF bytes
      const { PDFDocument } = await import("pdf-lib");
      const dataUrl = canvas.toDataURL("image/png");
      const b64 = dataUrl.split(",")[1];
      const pngBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const pdf = await PDFDocument.create();
      const pdfImg = await pdf.embedPng(pngBytes);
      const page = pdf.addPage([792, 612]); // 11×8.5 landscape in points
      page.drawImage(pdfImg, { x: 0, y: 0, width: 792, height: 612 });
      const bytes = await pdf.save();

      // Upload to backend
      const slug = (title.trim() || "untitled").replace(/\s+/g, "-");
      const formData = new FormData();
      formData.append("title", title.trim() || "Untitled");
      formData.append("zine_format", format);
      formData.append("pdf", new File([bytes], `${slug}.pdf`, { type: "application/pdf" }));

      const res = await fetch("/api/canvas/save", { method: "POST", body: formData });
      const json = (await res.json()) as { issueId?: string; slug?: string; error?: string };

      if (!res.ok || json.error) throw new Error(json.error ?? "Save failed");

      // Trigger local download
      const blob = new Blob([bytes], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}.pdf`;
      a.click();

      setSaveResult({ ok: true, msg: "Saved to your library! You can find it in My Library." });
    } catch (err) {
      setSaveResult({ ok: false, msg: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  // ── Show fill options in sidebar? ─────────────────────────────────────────
  const showFill = tool === "rect" || tool === "ellipse" ||
    (selId !== null && (() => { const el = els.find((e) => e.id === selId); return el?.type === "rect" || el?.type === "ellipse"; })());
  const showRough = tool === "line" || tool === "rect" || tool === "ellipse" ||
    (selId !== null && (() => { const el = els.find((e) => e.id === selId); return el?.type === "line" || el?.type === "rect" || el?.type === "ellipse"; })());

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
            <button key={t.id} type="button" title={`${t.label} (${t.key})`}
              onClick={() => setTool(t.id)}
              className={clsx("flex h-8 w-8 items-center justify-center rounded-lg transition",
                tool === t.id ? "bg-[#65CBF1] text-white" : "text-gray-600 hover:bg-gray-100")}
            >{t.icon}</button>
          ))}
          {/* Image insert */}
          <button type="button" title="Insert image" onClick={() => fileInputRef.current?.click()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
              <rect x="2" y="4" width="16" height="12" rx="1.5" /><circle cx="7" cy="8.5" r="1.5" />
              <path d="M2 14l4.5-4.5 3 3 2.5-2.5L18 14" strokeLinejoin="round" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImagePick} />
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Undo */}
        <button type="button" title="Undo (⌘Z)" onClick={undo} disabled={!history.length}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:opacity-30">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16">
            <path d="M4.5 8H12a5 5 0 010 10H6.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7.5 5L4.5 8l3 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Clear */}
        <button type="button" onClick={clearAll}
          className="flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600">
          Clear
        </button>

        {/* Save & Export */}
        <button type="button" onClick={() => { setModal({ open: true, title: "" }); setSaveResult(null); }}
          className="ml-auto flex h-8 items-center rounded-lg bg-gray-900 px-4 text-xs font-semibold text-white transition hover:bg-gray-700">
          Save &amp; Export
        </button>
      </div>

      {/* ── Sidebar + Canvas ── */}
      <div className="flex items-start gap-3">

        {/* Left sidebar */}
        <div className="w-40 flex-shrink-0 space-y-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">

          {/* Stroke color */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Stroke</p>
            <div className="grid grid-cols-5 gap-1">
              {STROKE_PALETTE.map((c) => (
                <button key={c} type="button" title={c}
                  onClick={() => { setColor(c); patchSel({ color: c }); }}
                  className={clsx("h-5 w-5 rounded-full border transition",
                    color === c ? "ring-2 ring-[#65CBF1] ring-offset-1" : "border-transparent hover:scale-110")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Background / fill color */}
          {showFill && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Background</p>
              <div className="grid grid-cols-4 gap-1">
                {BG_PALETTE.map((c) => (
                  <button key={c} type="button" title={c === "none" ? "No fill" : c}
                    onClick={() => { setFillColor(c); patchSel({ fillColor: c }); }}
                    className={clsx("relative h-5 w-5 rounded border transition",
                      c === "none" ? "border-gray-300" : "border-transparent",
                      fillColor === c ? "ring-2 ring-[#65CBF1] ring-offset-1" : "hover:scale-110")}
                    style={{ backgroundColor: c === "none" ? "#fff" : c }}>
                    {c === "none" && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <svg viewBox="0 0 10 10" width="10" height="10"><line x1="1" y1="9" x2="9" y2="1" stroke="#e03131" strokeWidth="1.5" /></svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fill style */}
          {showFill && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Fill</p>
              <div className="flex gap-1">
                {(["none", "hachure", "solid"] as FillStyle[]).map((fs) => (
                  <button key={fs} type="button" title={fs}
                    onClick={() => { setFillStyle(fs); patchSel({ fillStyle: fs }); }}
                    className={clsx("flex h-7 flex-1 items-center justify-center rounded border text-[10px] transition",
                      fillStyle === fs ? "border-[#65CBF1] bg-[#e8f8fd]" : "border-gray-200 hover:border-gray-300")}>
                    {fs === "none" && <svg viewBox="0 0 14 14" width="12" height="12"><rect x="1" y="1" width="12" height="12" rx="1" stroke="#374151" strokeWidth="1.5" fill="none" /><line x1="1" y1="13" x2="13" y2="1" stroke="#e03131" strokeWidth="1" /></svg>}
                    {fs === "hachure" && <svg viewBox="0 0 14 14" width="12" height="12"><rect x="1" y="1" width="12" height="12" rx="1" stroke="#374151" strokeWidth="1.5" fill="none" />{[3, 6, 9, 12].map((x) => <line key={x} x1={x - 4} y1="13" x2={x} y2="1" stroke="#374151" strokeWidth="1" />)}</svg>}
                    {fs === "solid" && <svg viewBox="0 0 14 14" width="12" height="12"><rect x="1" y="1" width="12" height="12" rx="1" stroke="#374151" strokeWidth="1.5" fill="#374151" /></svg>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stroke width */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Width</p>
            <div className="flex gap-1">
              {[{ v: 2, dot: 4 }, { v: 5, dot: 6 }, { v: 10, dot: 9 }].map((s) => (
                <button key={s.v} type="button" title={`${s.v}px`}
                  onClick={() => { setSw(s.v); patchSel({ sw: s.v }); }}
                  className={clsx("flex h-7 flex-1 items-center justify-center rounded border transition",
                    sw === s.v ? "border-[#65CBF1] bg-[#e8f8fd]" : "border-gray-200 hover:border-gray-300")}>
                  <span className="rounded-full bg-gray-700" style={{ width: s.dot, height: s.dot }} />
                </button>
              ))}
            </div>
          </div>

          {/* Stroke style */}
          {showRough && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Stroke style</p>
              <div className="flex gap-1">
                {(["solid", "dashed", "dotted"] as StrokeDash[]).map((d) => (
                  <button key={d} type="button" title={d}
                    onClick={() => { setDash(d); patchSel({ dash: d }); }}
                    className={clsx("flex h-7 flex-1 items-center justify-center rounded border transition",
                      dash === d ? "border-[#65CBF1] bg-[#e8f8fd]" : "border-gray-200 hover:border-gray-300")}>
                    <svg viewBox="0 0 20 4" width="16" height="4">
                      <line x1="0" y1="2" x2="20" y2="2" stroke="#374151" strokeWidth="1.5"
                        strokeDasharray={d === "solid" ? undefined : d === "dashed" ? "5,3" : "1.5,3"}
                        strokeLinecap="round" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Roughness */}
          {showRough && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Roughness</p>
              <div className="flex gap-1">
                {[{ v: 0, label: "A" }, { v: 1.2, label: "~" }, { v: 2.8, label: "≋" }].map((r) => (
                  <button key={r.v} type="button" title={r.label}
                    onClick={() => { setRoughness(r.v); patchSel({ roughness: r.v }); }}
                    className={clsx("flex h-7 flex-1 items-center justify-center rounded border text-xs font-mono transition",
                      roughness === r.v ? "border-[#65CBF1] bg-[#e8f8fd]" : "border-gray-200 hover:border-gray-300")}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opacity */}
          <div>
            <p className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              <span>Opacity</span><span className="font-normal normal-case tabular-nums">{opacity}%</span>
            </p>
            <input type="range" min={10} max={100} step={5} value={opacity}
              onChange={(e) => { const v = Number(e.target.value); setOpacity(v); patchSel({ opacity: v }); }}
              className="w-full accent-[#65CBF1]" />
          </div>
        </div>

        {/* Canvas area */}
        <div className="min-w-0 flex-1">
          <div
            ref={containerRef}
            className="relative rounded-sm shadow-[0_4px_28px_rgba(0,0,0,0.12)]"
            onDrop={onDrop}
            onDragOver={(ev) => ev.preventDefault()}
          >
            <canvas
              ref={canvasRef}
              width={CW}
              height={CH}
              style={{ cursor: tool === "select" && selId !== null ? "move" : cursors[tool], width: "100%", height: "auto", display: "block" }}
              className="rounded-sm"
              onMouseDown={onDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onMouseLeave={onUp}
            />

            {/* Text input overlay */}
            {txt.visible && (
              <textarea
                autoFocus rows={1} value={txt.val}
                onChange={(ev) => { ev.target.style.height = "auto"; ev.target.style.height = ev.target.scrollHeight + "px"; setTxt((s) => ({ ...s, val: ev.target.value })); }}
                onKeyDown={(ev) => {
                  if (ev.key === "Escape") setTxt((s) => ({ ...s, visible: false, val: "" }));
                  if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) commitTxt();
                }}
                onBlur={commitTxt}
                style={{
                  position: "absolute", left: txt.left, top: txt.top,
                  fontSize: `${Math.round(72 * txt.scale)}px`, fontFamily: "sans-serif",
                  lineHeight: 1.2, color, background: "rgba(255,255,255,0.88)",
                  border: "1.5px dashed #aaa", outline: "none", padding: "2px 6px",
                  minWidth: 120, resize: "none", overflow: "hidden", zIndex: 10,
                }}
              />
            )}
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            V · P · L · R · E · T · X — shortcuts &nbsp;·&nbsp; ⌘Z undo &nbsp;·&nbsp; Del removes selected &nbsp;·&nbsp; drag images onto canvas
          </p>
        </div>
      </div>

      {/* ── Save & Export modal ── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">Save &amp; Export</h3>
            <p className="mb-4 text-sm text-gray-500">Give your zine a title — it will be saved to your library and downloaded as a PDF.</p>
            <input
              autoFocus
              value={modal.title}
              onChange={(ev) => setModal((s) => ({ ...s, title: ev.target.value }))}
              onKeyDown={(ev) => { if (ev.key === "Enter" && !saving) saveAndExport(modal.title); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#65CBF1] focus:ring-2 focus:ring-[#65CBF1]/30"
              placeholder="My zine title"
              disabled={saving}
            />

            {saveResult && (
              <p className={clsx("mt-3 rounded-lg px-3 py-2 text-sm", saveResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
                {saveResult.msg}
                {saveResult.ok && (
                  <a href="/dashboard/library" className="ml-2 font-semibold underline">Go to library →</a>
                )}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setModal((s) => ({ ...s, open: false }))}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100" disabled={saving}>
                Cancel
              </button>
              <button type="button" onClick={() => saveAndExport(modal.title)} disabled={saving || !modal.title.trim()}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
                {saving && <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25" /><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>}
                {saving ? "Saving…" : "Save & Export PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
