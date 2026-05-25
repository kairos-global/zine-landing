"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import clsx from "clsx";

// ---------- Types ----------

type Tool = "select" | "pencil" | "line" | "rect" | "ellipse" | "text" | "eraser";

interface Point {
  x: number;
  y: number;
}

type DrawElement =
  | { id: number; type: "pencil"; points: Point[]; color: string; sw: number }
  | { id: number; type: "line"; x1: number; y1: number; x2: number; y2: number; color: string; sw: number }
  | { id: number; type: "rect"; x: number; y: number; w: number; h: number; color: string; sw: number }
  | { id: number; type: "ellipse"; cx: number; cy: number; rx: number; ry: number; color: string; sw: number }
  | { id: number; type: "text"; x: number; y: number; text: string; color: string; fontSize: number };

// 8.5 × 11 inches at 200 dpi
const CW = 1700;
const CH = 2200;

let eid = 1;
const nextEid = () => eid++;

// ---------- Coordinate helpers ----------

function getCanvasPos(canvas: HTMLCanvasElement, e: React.MouseEvent): Point {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * CW,
    y: ((e.clientY - r.top) / r.height) * CH,
  };
}

// ---------- Rendering ----------

function renderElement(ctx: CanvasRenderingContext2D, el: DrawElement) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (el.type) {
    case "pencil": {
      if (el.points.length < 2) break;
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.sw;
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
      ctx.stroke();
      break;
    }
    case "line": {
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.sw;
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      break;
    }
    case "rect": {
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.sw;
      ctx.strokeRect(el.x, el.y, el.w, el.h);
      break;
    }
    case "ellipse": {
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.sw;
      ctx.beginPath();
      ctx.ellipse(el.cx, el.cy, Math.abs(el.rx), Math.abs(el.ry), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "text": {
      ctx.fillStyle = el.color;
      ctx.font = `${el.fontSize}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(el.text, el.x, el.y);
      break;
    }
  }

  ctx.restore();
}

// ---------- Toolbar definitions ----------

const TOOLS: { id: Tool; label: string; shortcut: string; icon: React.ReactNode }[] = [
  {
    id: "select",
    label: "Select",
    shortcut: "V",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <path d="M4.5 3l11 7.5-5.5 1.5L8.5 17 4.5 3z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "pencil",
    label: "Draw",
    shortcut: "P",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <path d="M14 3a1.5 1.5 0 012.12 2.12L6.5 14.62l-3.5 1 1-3.5L14 3z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "eraser",
    label: "Eraser",
    shortcut: "X",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <path d="M3 17h8M12.5 4.5l3 3-7 7-4-1 1-4 7-5z" strokeLinejoin="round" />
        <path d="M9.5 7.5l3 3" />
      </svg>
    ),
  },
  {
    id: "line",
    label: "Line",
    shortcut: "L",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <line x1="3.5" y1="16.5" x2="16.5" y2="3.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "rect",
    label: "Rectangle",
    shortcut: "R",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <rect x="3" y="5" width="14" height="10" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "ellipse",
    label: "Ellipse",
    shortcut: "E",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <ellipse cx="10" cy="10" rx="7" ry="5" />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    shortcut: "T",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="17" height="17">
        <path d="M3 5h14M10 5v12M7 17h6" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ),
  },
];

const STROKE_WIDTHS = [
  { label: "Thin", value: 2, dot: 3 },
  { label: "Medium", value: 5, dot: 5 },
  { label: "Thick", value: 10, dot: 8 },
];

// ---------- Component ----------

export default function ZineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#000000");
  const [sw, setSw] = useState(2);
  const [elements, setElements] = useState<DrawElement[]>([]);
  const [undoStack, setUndoStack] = useState<DrawElement[][]>([]);

  // Mutable drawing state — never triggers re-render
  const drawing = useRef(false);
  const startPt = useRef<Point>({ x: 0, y: 0 });
  const inProgress = useRef<DrawElement | null>(null);

  // Text tool state
  const [textState, setTextState] = useState<{
    visible: boolean;
    canvasX: number;
    canvasY: number;
    screenX: number;
    screenY: number;
    scale: number;
    value: string;
  }>({ visible: false, canvasX: 0, canvasY: 0, screenX: 0, screenY: 0, scale: 1, value: "" });

  // ---------- Rendering ----------

  const redraw = useCallback((committed: DrawElement[], current: DrawElement | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CW, CH);

    committed.forEach((el) => renderElement(ctx, el));
    if (current) renderElement(ctx, current);
  }, []);

  useEffect(() => {
    redraw(elements, null);
  }, [elements, redraw]);

  // ---------- Keyboard shortcuts ----------

  useEffect(() => {
    const toolMap: Record<string, Tool> = {
      v: "select",
      p: "pencil",
      l: "line",
      r: "rect",
      e: "ellipse",
      t: "text",
      x: "eraser",
    };

    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (toolMap[e.key.toLowerCase()]) {
        setTool(toolMap[e.key.toLowerCase()] as Tool);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        setUndoStack((prev) => {
          if (!prev.length) return prev;
          const next = [...prev];
          const restored = next.pop()!;
          setElements(restored);
          return next;
        });
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- Text commit ----------

  const colorRef = useRef(color);
  useEffect(() => { colorRef.current = color; }, [color]);

  const textCommitting = useRef(false);

  const commitText = useCallback(() => {
    if (textCommitting.current) return;
    textCommitting.current = true;

    setTextState((s) => {
      textCommitting.current = false;
      if (!s.visible) return s;
      if (!s.value.trim()) return { ...s, visible: false, value: "" };

      const el: DrawElement = {
        id: nextEid(),
        type: "text",
        x: s.canvasX,
        y: s.canvasY,
        text: s.value,
        color: colorRef.current,
        fontSize: 72,
      };

      setElements((prev) => {
        setUndoStack((stack) => [...stack, prev]);
        return [...prev, el];
      });

      return { ...s, visible: false, value: "" };
    });
  }, []);

  // ---------- Mouse handlers ----------

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool === "select") return;

    const canvas = canvasRef.current!;
    const pt = getCanvasPos(canvas, e);

    if (tool === "text") {
      const rect = canvas.getBoundingClientRect();
      setTextState({
        visible: true,
        canvasX: pt.x,
        canvasY: pt.y,
        screenX: e.clientX,
        screenY: e.clientY,
        scale: rect.width / CW,
        value: "",
      });
      return;
    }

    drawing.current = true;
    startPt.current = pt;

    if (tool === "pencil" || tool === "eraser") {
      inProgress.current = {
        id: nextEid(),
        type: "pencil",
        points: [pt],
        color: tool === "eraser" ? "#ffffff" : color,
        sw: tool === "eraser" ? Math.max(sw * 5, 30) : sw,
      };
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const pt = getCanvasPos(canvas, e);
    const start = startPt.current;

    if (tool === "pencil" || tool === "eraser") {
      const el = inProgress.current as Extract<DrawElement, { type: "pencil" }> | null;
      if (!el) return;
      inProgress.current = { ...el, points: [...el.points, pt] };
    } else if (tool === "line") {
      inProgress.current = { id: nextEid(), type: "line", x1: start.x, y1: start.y, x2: pt.x, y2: pt.y, color, sw };
    } else if (tool === "rect") {
      inProgress.current = {
        id: nextEid(),
        type: "rect",
        x: Math.min(start.x, pt.x),
        y: Math.min(start.y, pt.y),
        w: Math.abs(pt.x - start.x),
        h: Math.abs(pt.y - start.y),
        color,
        sw,
      };
    } else if (tool === "ellipse") {
      inProgress.current = {
        id: nextEid(),
        type: "ellipse",
        cx: (start.x + pt.x) / 2,
        cy: (start.y + pt.y) / 2,
        rx: Math.abs(pt.x - start.x) / 2,
        ry: Math.abs(pt.y - start.y) / 2,
        color,
        sw,
      };
    }

    redraw(elements, inProgress.current);
  }

  function onMouseUp() {
    if (!drawing.current) return;
    drawing.current = false;

    if (inProgress.current) {
      const committed = inProgress.current;
      inProgress.current = null;
      setElements((prev) => {
        setUndoStack((stack) => [...stack, prev]);
        return [...prev, committed];
      });
    }
  }

  // ---------- Actions ----------

  function undo() {
    setUndoStack((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const restored = next.pop()!;
      setElements(restored);
      return next;
    });
  }

  function clearAll() {
    setElements((prev) => {
      setUndoStack((stack) => [...stack, prev]);
      return [];
    });
  }

  // ---------- Cursor ----------

  const cursorMap: Record<Tool, string> = {
    select: "default",
    pencil: "crosshair",
    eraser: "crosshair",
    line: "crosshair",
    rect: "crosshair",
    ellipse: "crosshair",
    text: "text",
  };

  // ---------- UI ----------

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
        {/* Tools */}
        <div className="flex items-center gap-0.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={`${t.label}  (${t.shortcut})`}
              onClick={() => setTool(t.id)}
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                tool === t.id ? "bg-[#65CBF1] text-white" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="mx-1.5 h-5 w-px bg-gray-200" />

        {/* Color */}
        <label
          title="Stroke color"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100"
        >
          <span
            className="h-5 w-5 rounded-full border-2 border-gray-300"
            style={{ backgroundColor: color }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="sr-only"
          />
        </label>

        {/* Stroke width */}
        <div className="flex items-center gap-0.5 px-0.5">
          {STROKE_WIDTHS.map((w) => (
            <button
              key={w.value}
              type="button"
              title={`${w.label} stroke`}
              onClick={() => setSw(w.value)}
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                sw === w.value ? "bg-[#65CBF1]" : "hover:bg-gray-100"
              )}
            >
              <span
                className="rounded-full bg-current text-gray-700"
                style={{ width: w.dot, height: w.dot }}
              />
            </button>
          ))}
        </div>

        <div className="mx-1.5 h-5 w-px bg-gray-200" />

        {/* Undo */}
        <button
          type="button"
          title="Undo  (⌘Z)"
          onClick={undo}
          disabled={!undoStack.length}
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
          title="Clear canvas"
          onClick={clearAll}
          className="ml-auto flex h-8 items-center rounded-lg px-3 text-xs font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600"
        >
          Clear
        </button>
      </div>

      {/* Canvas */}
      <div className="relative shadow-[0_4px_24px_rgba(0,0,0,0.10)] rounded-sm">
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{ cursor: cursorMap[tool], width: "100%", height: "auto", display: "block" }}
          className="rounded-sm"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />

        {/* Text input overlay */}
        {textState.visible && (
          <input
            autoFocus
            value={textState.value}
            onChange={(e) => setTextState((s) => ({ ...s, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") setTextState((s) => ({ ...s, visible: false, value: "" }));
            }}
            onBlur={commitText}
            style={{
              position: "fixed",
              left: textState.screenX,
              top: textState.screenY,
              fontSize: `${Math.round(72 * textState.scale)}px`,
              fontFamily: "sans-serif",
              color: color,
              background: "rgba(255,255,255,0.85)",
              border: "1.5px dashed #aaa",
              outline: "none",
              padding: "2px 6px",
              minWidth: 120,
              zIndex: 50,
              lineHeight: 1.2,
            }}
          />
        )}
      </div>

      {/* Keyboard hint */}
      <p className="text-center text-xs text-gray-400">
        V · P · L · R · E · T · X &nbsp;—&nbsp; tool shortcuts &nbsp;·&nbsp; ⌘Z undo
      </p>
    </div>
  );
}
