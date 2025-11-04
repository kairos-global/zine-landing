"use client";

import { useState, useRef } from "react";
import UploadImage from "./UploadImage";
import { PDFDocument, degrees, rgb, PDFPage, RGB } from "pdf-lib";

interface MiniZineEditorProps {
  onBack: () => void;
}

export default function MiniZineEditor({ onBack }: MiniZineEditorProps) {
  const [images, setImages] = useState<(File | null)[]>(Array(8).fill(null));
  const [includeGrid, setIncludeGrid] = useState<boolean>(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleUpload = (index: number, file: File) => {
    const updated = [...images];
    updated[index] = file;
    setImages(updated);
  };

  const handleRemove = (index: number) => {
    const updated = [...images];
    updated[index] = null;
    setImages(updated);
  };

  const handleMultiUpload = (files: FileList) => {
    const updated = [...images];
    Array.from(files).forEach((file, idx) => {
      if (idx < 8) updated[idx] = file;
    });
    setImages(updated.slice(0, 8));
  };

  const resetAll = () => {
    setImages(Array(8).fill(null));
  };

  // helper: draw dashed line (for optional PDF grid)
  const drawDashedLine = (
    page: PDFPage,
    start: { x: number; y: number },
    end: { x: number; y: number },
    dashLength: number,
    gapLength: number,
    color: RGB,
    thickness: number
  ) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(len / (dashLength + gapLength));
    const ux = dx / len;
    const uy = dy / len;

    for (let i = 0; i < steps; i++) {
      const x1 = start.x + (i * (dashLength + gapLength)) * ux;
      const y1 = start.y + (i * (dashLength + gapLength)) * uy;
      const x2 = x1 + dashLength * ux;
      const y2 = y1 + dashLength * uy;
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness,
        color,
        opacity: 0.6,
      });
    }
  };

  // Build the PDF by reading actual DOM geometry (exact WYSIWYG placement)
  const buildPdf = async () => {
    const root = canvasRef.current;
    if (!root) throw new Error("Canvas root not found");

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([792, 612]); // 11x8.5 inches landscape
    const { width: pageW, height: pageH } = page.getSize();

    // DOM geometry
    const rootRect = root.getBoundingClientRect();
    const scaleX = pageW / rootRect.width;
    const scaleY = pageH / rootRect.height;

    // Optional PDF grid guides
    if (includeGrid) {
      const guideColor = rgb(0.6, 0.6, 0.6);
      const lineWidth = 0.5;
      const dash = 6;
      const gap = 4;
      // 4 cols, 2 rows like the canvas
      const slotW = pageW / 4;
      const slotH = pageH / 2;
      for (let i = 1; i < 4; i++) {
        const x = i * slotW;
        drawDashedLine(page, { x, y: 0 }, { x, y: pageH }, dash, gap, guideColor, lineWidth);
      }
      drawDashedLine(page, { x: 0, y: slotH }, { x: pageW, y: slotH }, dash, gap, guideColor, lineWidth);
    }

    // Query each slot container in DOM order (top row, then bottom row)
    const slotEls = Array.from(
      root.querySelectorAll<HTMLElement>("[data-slot-idx]")
    );

    for (let slotPos = 0; slotPos < slotEls.length; slotPos++) {
      const slotEl = slotEls[slotPos];
      const idxAttr = slotEl.getAttribute("data-slot-idx");
      if (!idxAttr) continue;

      const idx = Number(idxAttr);
      const file = images[idx];
      if (!file) continue;

      // Prefer the displayed <img> rect if present (preserves user scaling/placement inside the slot)
      const imgEl = slotEl.querySelector("img") as HTMLImageElement | null;
      const rect = (imgEl ?? slotEl).getBoundingClientRect();

      // Convert DOM pixels -> PDF points (and flip Y-axis)
      const x = (rect.left - rootRect.left) * scaleX;
      const y = (rootRect.bottom - rect.bottom) * scaleY;
      const w = rect.width * scaleX;
      const h = rect.height * scaleY;

      const bytes = new Uint8Array(await file.arrayBuffer());
      const img = await pdfDoc.embedPng(bytes).catch(async () => {
        return await pdfDoc.embedJpg(bytes);
      });

      // Determine if this slot is visually in the top row (DOM order: first 4 = top)
      const isTopRow = slotPos < 4;

      // For a 180° rotation around the same visual box, adjust origin by (w, h)
      const drawX = isTopRow ? x + w : x;
      const drawY = isTopRow ? y + h : y;

      page.drawImage(img, {
        x: drawX,
        y: drawY,
        width: w,
        height: h,
        rotate: isTopRow ? degrees(180) : undefined,
      });
    }

    return pdfDoc;
  };

  const handleExport = async () => {
    try {
      const pdfDoc = await buildPdf();
    const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      link.download = `zinemat-${yyyy}${mm}${dd}.pdf`;
    link.click();
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Export failed:", err.message);
      } else {
        console.error("Export failed:", err);
      }
    }
  };

  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-4 text-sm underline">
        ← Back
      </button>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Mini Zine (8 panels)</h2>
        <button
          onClick={handleExport}
          disabled={images.every((img) => !img)}
          className="px-6 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ backgroundColor: "#3b82f6" }}
        >
          Export PDF
        </button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <label className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <span>+ Select all 8</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleMultiUpload(e.target.files);
            }}
          />
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={includeGrid}
            onChange={(e) => setIncludeGrid(e.target.checked)}
            className="rounded"
          />
          Include grid lines in export
        </label>

        <button
          onClick={resetAll}
          className="px-3 py-1 text-sm border rounded-lg bg-gray-50 hover:bg-gray-100"
        >
          Reset
        </button>
      </div>

      <div
        ref={canvasRef}
        className="relative mx-auto border border-gray-400 rounded-lg bg-white aspect-[11/8.5] max-w-2xl"
      >
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-2">
          {[6, 5, 4, 3, 7, 0, 1, 2].map((idx, i) => (
            <div
              key={idx}
              data-slot-idx={idx}
              className={`relative w-full h-full ${includeGrid ? "border border-gray-300" : ""}`}
            >
              <UploadImage
                index={idx}
                file={images[idx]}
                onUpload={handleUpload}
                onRemove={handleRemove}
                rotated={i < 4}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
