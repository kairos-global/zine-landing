"use client";

import { useRef } from "react";
import { ZINE_CATEGORIES, ZineCategoryKey } from "@/lib/zine-categories";

export default function UploadsSection({
  coverFile,
  pdfFile,
  onCoverChange,
  onPdfChange,
  existingCoverUrl,
  existingPdfUrl,
  category,
  onCategoryChange,
}: {
  coverFile: File | null;
  pdfFile: File | null;
  onCoverChange: (f: File | null) => void;
  onPdfChange: (f: File | null) => void;
  existingCoverUrl?: string | null;
  existingPdfUrl?: string | null;
  category: ZineCategoryKey | null;
  onCategoryChange: (next: ZineCategoryKey | null) => void;
}) {
  const coverRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">

        {/* Cover Upload — faded/light yellow */}
        <div className="flex-1 rounded-xl border border-yellow-200 bg-white p-4 shadow-sm relative">
          <label className="block text-sm font-semibold text-yellow-700 mb-2">
            Cover image (jpg/png/webp) — optional
          </label>

          <div
            onClick={() => coverRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-yellow-200 rounded-xl p-4 text-center hover:bg-yellow-50 transition"
          >
            {coverFile ? (
              <p className="text-sm font-bold text-yellow-800">📸 Selected: {coverFile.name}</p>
            ) : existingCoverUrl ? (
              <div className="space-y-2">
                <p className="text-sm font-bold text-yellow-800">✓ Cover uploaded</p>
                <img
                  src={existingCoverUrl}
                  alt="Cover preview"
                  className="max-h-32 mx-auto rounded-lg shadow-sm"
                />
                <p className="text-xs text-yellow-500">Click to replace</p>
              </div>
            ) : (
              <p className="text-sm text-yellow-400">Click to upload an image file</p>
            )}
          </div>

          {coverFile && (
            <button
              type="button"
              onClick={() => onCoverChange(null)}
              className="absolute top-4 right-4 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-medium px-2 py-0.5 rounded transition"
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

        {/* PDF Upload — rich yellow (was gray) */}
        <div className="flex-1 rounded-xl border border-yellow-300 bg-yellow-50 p-4 shadow-sm relative">
          <label className="block text-sm font-semibold text-yellow-900 mb-2">
            Digital zine copy (PDF) — optional
          </label>

          <div
            onClick={() => pdfRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-yellow-300 rounded-xl p-4 text-center hover:bg-yellow-100 transition"
          >
            {pdfFile ? (
              <p className="text-sm font-bold text-yellow-900">📄 Selected: {pdfFile.name}</p>
            ) : existingPdfUrl ? (
              <div className="space-y-2">
                {/* PDF preview card */}
                <div className="flex items-center justify-center gap-3 bg-white rounded-lg border border-yellow-200 px-3 py-3 mx-auto max-w-xs">
                  <span className="text-3xl flex-shrink-0">📄</span>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-bold text-yellow-900 leading-tight">✓ PDF uploaded</p>
                    <a
                      href={existingPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-blue-600 underline hover:text-blue-800 block truncate max-w-[160px]"
                    >
                      View current PDF
                    </a>
                  </div>
                </div>
                <p className="text-xs text-yellow-600">Click to replace</p>
              </div>
            ) : (
              <p className="text-sm text-yellow-500">Click to upload your zine PDF</p>
            )}
          </div>

          {pdfFile && (
            <button
              type="button"
              onClick={() => onPdfChange(null)}
              className="absolute top-4 right-4 text-xs bg-yellow-200 hover:bg-yellow-300 text-yellow-900 font-medium px-2 py-0.5 rounded transition"
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

      {/* Category — optional, styled in the yellow Uploads palette */}
      <div className="rounded-xl border border-yellow-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-semibold text-yellow-700 mb-2">
          Category — optional
        </label>
        <select
          className="w-full rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
          value={category ?? ""}
          onChange={(e) => {
            const next = e.target.value;
            onCategoryChange(next === "" ? null : (next as ZineCategoryKey));
          }}
        >
          <option value="">— None —</option>
          {ZINE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-yellow-700/70">
          Helps readers and distributors browse by type.
        </p>
      </div>
    </div>
  );
}
