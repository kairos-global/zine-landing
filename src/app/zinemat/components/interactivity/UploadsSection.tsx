"use client";

import { useRef } from "react";

export default function UploadsSection({
  coverFile,
  pdfFile,
  onCoverChange,
  onPdfChange,
}: {
  coverFile: File | null;
  pdfFile: File | null;
  onCoverChange: (f: File | null) => void;
  onPdfChange: (f: File | null) => void;
}) {
  const coverRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Cover Upload */}
      <div className="flex-1 rounded-md border border-yellow-300 bg-yellow-50 p-4 shadow-sm relative">
        <label className="block text-sm font-semibold text-yellow-900 mb-2">
          Cover image (jpg/png/webp) — optional
        </label>

        <div
          onClick={() => coverRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-yellow-300 rounded-md p-4 text-center hover:bg-yellow-100 transition"
        >
          {coverFile ? (
            <p className="text-sm text-yellow-900">📸 Selected: {coverFile.name}</p>
          ) : (
            <p className="text-sm text-yellow-500">Click to upload an image file</p>
          )}
        </div>

        {coverFile && (
          <button
            type="button"
            onClick={() => onCoverChange(null)}
            className="absolute top-4 right-4 text-xs bg-yellow-200 hover:bg-yellow-300 text-yellow-900 font-medium px-2 py-0.5 rounded transition"
          >
            Remove
          </button>
        )}

        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          onChange={(e) => onCoverChange(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>

      {/* PDF Upload */}
      <div className="flex-1 rounded-md border border-gray-300 bg-gray-50 p-4 shadow-sm relative">
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          Digital zine copy (PDF) — optional
        </label>

        <div
          onClick={() => pdfRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-gray-300 rounded-md p-4 text-center hover:bg-gray-100 transition"
        >
          {pdfFile ? (
            <p className="text-sm text-gray-800">📄 Selected: {pdfFile.name}</p>
          ) : (
            <p className="text-sm text-gray-500">Click to upload your zine PDF</p>
          )}
        </div>

        {pdfFile && (
          <button
            type="button"
            onClick={() => onPdfChange(null)}
            className="absolute top-4 right-4 text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-2 py-0.5 rounded transition"
          >
            Remove
          </button>
        )}

        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => onPdfChange(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>
    </div>
  );
}
