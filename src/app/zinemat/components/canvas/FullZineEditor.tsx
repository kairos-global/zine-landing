"use client";

import { useState } from "react";
import UploadImage from "./UploadImage";
import { PDFDocument } from "pdf-lib";

interface FullZineEditorProps {
  onBack: () => void;
}

export default function FullZineEditor({ onBack }: FullZineEditorProps) {
  const [sheets, setSheets] = useState(1); // 1 sheet = 4 pages
  const [images, setImages] = useState<(File | null)[]>(Array(4).fill(null));

  const handleUpload = (index: number, file: File) => {
    const updated = [...images];
    updated[index] = file;
    setImages(updated);
  };

  const handleMultiUpload = (files: FileList) => {
    const updated = [...images];
    Array.from(files).forEach((file, idx) => {
      if (idx < images.length) updated[idx] = file;
    });
    setImages(updated.slice(0, images.length));
  };

  const handleReset = () => {
    setImages(Array(sheets * 4).fill(null));
  };

  const handleSheetChange = (delta: number) => {
    const newSheets = Math.max(1, sheets + delta);
    setSheets(newSheets);
    setImages(Array(newSheets * 4).fill(null));
  };

  const handleExport = async () => {
    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < images.length; i++) {
        if (images[i]) {
          const fileData = await images[i]!.arrayBuffer();
          const img = await pdfDoc.embedPng(fileData).catch(() => pdfDoc.embedJpg(fileData));

          const page = pdfDoc.addPage([612, 792]); // standard US Letter portrait
          const { width, height } = img.scaleToFit(612, 792);

          page.drawImage(img, {
            x: (612 - width) / 2, // center horizontally
            y: (792 - height) / 2, // center vertically
            width,
            height,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const link = document.createElement("a");

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");

      link.href = URL.createObjectURL(blob);
      link.download = `fullzine-${yyyy}${mm}${dd}.pdf`;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-4 text-sm underline">
        ← Back
      </button>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Full Zine (Booklet)</h2>
        <button
          onClick={handleExport}
          disabled={images.every((img) => !img)}
          className="px-6 py-2 rounded-lg bg-blue-500 text-white disabled:opacity-50"
        >
          Export PDF
        </button>
      </div>

      {/* Sheet controls */}
      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={() => handleSheetChange(-1)}
          className="px-3 py-1 border rounded-lg bg-gray-50 hover:bg-gray-100"
        >
          - Sheet
        </button>
        <span>{sheets} sheet(s) = {sheets * 4} pages</span>
        <button
          onClick={() => handleSheetChange(1)}
          className="px-3 py-1 border rounded-lg bg-gray-50 hover:bg-gray-100"
        >
          + Sheet
        </button>
      </div>

      {/* Upload All + Reset controls */}
      <div className="flex items-center gap-4 mb-6">
        <label className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <span>Upload All</span>
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

        <button
          onClick={handleReset}
          className="px-3 py-1 text-sm border rounded-lg bg-gray-50 hover:bg-gray-100"
        >
          Reset
        </button>
      </div>

      {/* Page grid: always 4 per row */}
      <div className="space-y-6">
        {Array.from({ length: sheets }).map((_, sheetIdx) => {
          const startIdx = sheetIdx * 4;
          return (
            <div key={sheetIdx} className="grid grid-cols-4 gap-4">
              {images.slice(startIdx, startIdx + 4).map((img, idx) => {
                const pageNumber = startIdx + idx + 1;
                return (
                  <div
                    key={pageNumber}
                    className="relative w-full aspect-[8.5/11] border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center"
                  >
                    <UploadImage
                      index={pageNumber - 1}
                      file={images[pageNumber - 1]}
                      onUpload={handleUpload}
                      onRemove={() => {
                        const updated = [...images];
                        updated[pageNumber - 1] = null;
                        setImages(updated);
                      }}
                    />
                    <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                      Page {pageNumber}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
