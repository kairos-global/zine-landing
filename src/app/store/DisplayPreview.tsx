"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const TURN_COUNT = 24;

export default function DisplayPreview() {
  const [frame, setFrame] = useState(0);
  const [interactive, setInteractive] = useState(false);
  const gesture = useRef<{ x: number; frame: number } | null>(null);

  function showFrame(next: number) {
    setInteractive(true);
    setFrame((next % TURN_COUNT + TURN_COUNT) % TURN_COUNT);
  }

  return (
    <div className="relative grid min-h-[270px] place-items-center overflow-hidden bg-[#e7d2f8] sm:min-h-[340px]">
      <div
        className="relative aspect-square w-full max-w-[380px] touch-pan-y cursor-grab select-none active:cursor-grabbing"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          gesture.current = { x: event.clientX, frame };
        }}
        onPointerMove={(event) => {
          if (!gesture.current || !event.isPrimary) return;
          const steps = Math.trunc((event.clientX - gesture.current.x) / 12);
          if (steps) showFrame(gesture.current.frame + steps);
        }}
        onLostPointerCapture={() => { gesture.current = null; }}
      >
        <Image src="/store/mini-zine-display.webp" alt="Mini Zine Display, rendered from its 3D model" fill sizes="380px" priority className="pointer-events-none object-contain" />
        {interactive && <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[#e7d2f8] bg-no-repeat"
          style={{
            backgroundImage: "url(/store/mini-zine-display-spin.webp)",
            backgroundSize: "600% 400%",
            backgroundPosition: `${(frame % 6) * 20}% ${Math.floor(frame / 6) * 100 / 3}%`,
          }}
        />}
      </div>
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
        <span className="rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-bold">Drag to rotate</span>
        <div className="flex gap-1.5">
          <button className="zg-button !min-h-8" aria-label="Rotate left" type="button" onClick={() => showFrame(frame - 1)}>←</button>
          <button className="zg-button !min-h-8" aria-label="Rotate right" type="button" onClick={() => showFrame(frame + 1)}>→</button>
        </div>
      </div>
    </div>
  );
}
