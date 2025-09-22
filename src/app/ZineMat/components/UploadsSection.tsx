"use client";

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
  return (
    <div className="space-y-6">
      {/* Cover Image Upload */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Cover image (jpg/png/webp) — optional</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onCoverChange(e.target.files?.[0] ?? null)}
          className="w-full"
        />
        {coverFile ? (
          <div className="text-xs text-gray-600">Selected: {coverFile.name}</div>
        ) : (
          <div className="text-xs text-gray-500">No file selected</div>
        )}
      </div>

      {/* PDF Upload */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Digital zine copy (PDF) — optional</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => onPdfChange(e.target.files?.[0] ?? null)}
          className="w-full"
        />
        {pdfFile ? (
          <div className="text-xs text-gray-600">Selected: {pdfFile.name}</div>
        ) : (
          <div className="text-xs text-gray-500">No file selected</div>
        )}
      </div>
    </div>
  );
}
