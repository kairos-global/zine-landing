"use client";

import { useEffect, useState } from "react";

interface UploadImageProps {
  index: number;
  file?: File | null;
  onUpload: (index: number, file: File) => void;
  onRemove?: (index: number) => void;
}

export default function UploadImage({ index, file, onUpload, onRemove }: UploadImageProps) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);

      return () => URL.revokeObjectURL(url); // cleanup
    } else {
      setPreview(null);
    }
  }, [file]);

  return (
    <div className="relative w-full h-32 border rounded bg-gray-50 overflow-hidden">
      {/* Upload zone */}
      <label className="flex items-center justify-center w-full h-full cursor-pointer hover:bg-gray-100 text-xs text-gray-600">
        {preview ? (
          <img
            src={preview}
            alt={`Page ${index + 1}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="z-10">+ Page {index + 1}</span>
        )}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            if (e.target.files?.[0]) {
              onUpload(index, e.target.files[0]);
            }
          }}
        />
      </label>

      {/* Remove button (only if file exists) */}
      {file && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-1 right-1 z-20 bg-white/80 rounded-full px-2 py-1 text-xs text-red-600 hover:bg-white hover:text-red-800 shadow"
          title="Remove image"
        >
          ×
        </button>
      )}
    </div>
  );
}
