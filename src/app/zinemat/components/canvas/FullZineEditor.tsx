"use client";

import { useState } from "react";
import UploadImage from "./UploadImage";

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

  const handleSheetChange = (delta: number) => {
    const newSheets = Math.max(1, sheets + delta);
    setSheets(newSheets);
    setImages(Array(newSheets * 4).fill(null));
  };

  const handleDone = () => {
    // TODO: generate booklet PDF + save to Supabase + redirect to library
    console.log("Full zine completed:", images);
  };

  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-4 text-sm underline">
        ← Back
      </button>
      <h2 className="text-lg font-semibold mb-4">Full Zine (Booklet)</h2>

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => handleSheetChange(-1)} className="px-3 py-1 border rounded">
          - Sheet
        </button>
        <span>{sheets} sheet(s) = {sheets * 4} pages</span>
        <button onClick={() => handleSheetChange(1)} className="px-3 py-1 border rounded">
          + Sheet
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {images.map((img, idx) => (
          <UploadImage key={idx} index={idx} onUpload={handleUpload} />
        ))}
      </div>

      <button
        onClick={handleDone}
        disabled={images.every((img) => !img)}
        className="px-6 py-2 rounded-lg bg-blue-500 text-white disabled:opacity-50"
      >
        Done
      </button>
    </div>
  );
} 