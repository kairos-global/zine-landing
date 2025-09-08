"use client";

export default function UploadsSection({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm">Cover image (jpg/png/webp) — optional</label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="w-full"
      />
      {file ? (
        <div className="text-xs text-gray-600">Selected: {file.name}</div>
      ) : (
        <div className="text-xs text-gray-500">No file selected</div>
      )}
    </div>
  );
}
