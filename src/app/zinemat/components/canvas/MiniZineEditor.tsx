"use client";

import { useState } from "react";
import UploadImage from "./UploadImage";
import { PDFDocument, degrees, rgb } from "pdf-lib";

interface MiniZineEditorProps {
  onBack: () => void;
}

export default function MiniZineEditor({ onBack }: MiniZineEditorProps) {
  const [images, setImages] = useState<(File | null)[]>(Array(8).fill(null));
  const [includeGrid, setIncludeGrid] = useState<boolean>(false);

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
      if (idx < 8) {
        updated[idx] = file;
      }
    });
    setImages(updated);
  };

  // helper: draw dashed line
  const drawDashedLine = (
    page: any,
    start: { x: number; y: number },
    end: { x: number; y: number },
    dashLength: number,
    gapLength: number,
    color: any,
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

  const handleDone = async () => {
    // 📝 Letter size: 8.5 × 11 in = 612 × 792 points
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();

    const slotWidth = width / 4; // 153 pts
    const slotHeight = height / 2; // 396 pts

    if (includeGrid) {
      const guideColor = rgb(0.6, 0.6, 0.6);
      const lineWidth = 0.5;
      const dash = 6;
      const gap = 4;

      // Vertical guides
      for (let i = 1; i < 4; i++) {
        const x = i * slotWidth;
        drawDashedLine(
          page,
          { x, y: 0 },
          { x, y: height },
          dash,
          gap,
          guideColor,
          lineWidth
        );
      }

      // Horizontal guide
      drawDashedLine(
        page,
        { x: 0, y: slotHeight },
        { x: width, y: slotHeight },
        dash,
        gap,
        guideColor,
        lineWidth
      );
    }

    // --- Place images ---
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      if (!file) continue;

      const bytes = new Uint8Array(await file.arrayBuffer());
      const img = await pdfDoc.embedPng(bytes).catch(async () => {
        return await pdfDoc.embedJpg(bytes);
      });

      let x = 0;
      let y = 0;
      let rotate180 = false;

      if ([6, 5, 4, 3].includes(i)) {
        // Top row (rotated)
        const col = [6, 5, 4, 3].indexOf(i);
        x = col * slotWidth;
        y = slotHeight;
        rotate180 = true;
      } else {
        // Bottom row
        const col = [7, 0, 1, 2].indexOf(i);
        x = col * slotWidth;
        y = 0;
      }

      page.drawImage(img, {
        x,
        y,
        width: slotWidth,
        height: slotHeight,
        rotate: rotate180 ? degrees(180) : undefined,
      });
    }

    // --- Save and download ---
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mini-zine.pdf";
    link.click();
  };

  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-4 text-sm underline">
        ← Back
      </button>
      <h2 className="text-lg font-semibold mb-4">Mini Zine (8 panels)</h2>

      {/* Controls row */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Select all 8 uploader */}
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

        {/* Grid checkbox */}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={includeGrid}
            onChange={(e) => setIncludeGrid(e.target.checked)}
            className="rounded"
          />
          Include grid lines in export
        </label>
      </div>

      {/* Grid */}
      <div className="space-y-6">
        {/* Top row: 7, 6, 5, 4 (rotated) */}
        <div className="grid grid-cols-4 gap-3">
          {[6, 5, 4, 3].map((idx) => (
            <div key={idx} className="relative rotate-180">
              <UploadImage
                index={idx}
                file={images[idx]}
                onUpload={handleUpload}
                onRemove={handleRemove}
              />
            </div>
          ))}
        </div>

        {/* Bottom row: 8, 1, 2, 3 */}
        <div className="grid grid-cols-4 gap-3">
          {[7, 0, 1, 2].map((idx) => (
            <UploadImage
              key={idx}
              index={idx}
              file={images[idx]}
              onUpload={handleUpload}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </div>

      <button
        onClick={handleDone}
        disabled={images.every((img) => !img)}
        className="mt-6 px-6 py-2 rounded-lg bg-blue-500 text-white disabled:opacity-50"
      >
        Export PDF
      </button>
    </div>
  );
}
