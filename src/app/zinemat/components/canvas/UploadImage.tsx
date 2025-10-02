"use client";

import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";

interface UploadImageProps {
  index: number;
  file?: File | null;
  onUpload: (index: number, file: File) => void;
  onRemove?: (index: number) => void;
  rotated?: boolean; // ⬅️ NEW: rotate content for the top row
}

export default function UploadImage({
  index,
  file,
  onUpload,
  onRemove,
  rotated = false,
}: UploadImageProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreview(null);
      setSelected(false);
    }
  }, [file]);

  // Init box once
  useEffect(() => {
    if (!containerRef.current || box) return;
    const rect = containerRef.current.getBoundingClientRect();
    setBox({ x: 0, y: 0, w: rect.width, h: rect.height });
  }, [box]);

  // Deselect on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setSelected(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      onMouseDown={() => preview && setSelected(true)}
    >
      {!preview && (
        <label className="block w-full h-full cursor-pointer">
          <div
            className={`flex items-center justify-center w-full h-full bg-gray-200 border-2 border-dashed border-gray-400 rounded-md text-sm font-semibold text-gray-600 ${
              rotated ? "rotate-180" : ""
            }`}
          >
            + Page {index + 1}
          </div>
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) onUpload(index, e.target.files[0]);
            }}
          />
        </label>
      )}

      {preview && box && (
        <Rnd
          size={{ width: box.w, height: box.h }}
          position={{ x: box.x, y: box.y }}
          // Keep resize centered so it feels identical on both rows
          onResizeStop={(e, dir, ref, delta, pos) => {
            const newW = parseFloat(ref.style.width);
            const newH = parseFloat(ref.style.height);
            const centerX = box.x + box.w / 2;
            const centerY = box.y + box.h / 2;
            setBox({
              x: centerX - newW / 2,
              y: centerY - newH / 2,
              w: newW,
              h: newH,
            });
          }}
          dragAxis="none"          // no dragging
          bounds="parent"          // keep within slot for position; overflow can still happen via size
          lockAspectRatio
          enableResizing={
            selected
              ? {
                  topLeft: true,
                  topRight: true,
                  bottomLeft: true,
                  bottomRight: true,
                }
              : false
          }
          style={{
            // Rnd wrapper is NOT rotated — so handle directions are normal
            border: selected ? "2px solid #3B82F6" : "none",
            borderRadius: "0.375rem",
            boxSizing: "border-box",
          }}
          resizeHandleStyles={
            selected
              ? {
                  topLeft: handleStyle,
                  topRight: handleStyle,
                  bottomLeft: handleStyle,
                  bottomRight: handleStyle,
                }
              : {}
          }
        >
          {/* Only the content is rotated for the top row */}
          <img
            src={preview}
            alt={`Page ${index + 1}`}
            className={`w-full h-full object-contain rounded-md select-none ${
              rotated ? "rotate-180" : ""
            }`}
            draggable={false}
          />
        </Rnd>
      )}

      {file && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="absolute top-1 right-1 z-20 bg-white/80 rounded-full w-6 h-6 flex items-center justify-center text-xs text-red-600 hover:bg-white hover:text-red-800 shadow"
          title="Remove image"
        >
          ×
        </button>
      )}
    </div>
  );
}

const handleStyle: React.CSSProperties = {
  width: "10px",
  height: "10px",
  background: "#3B82F6",
  borderRadius: "2px",
  border: "1px solid white",
};
