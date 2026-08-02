"use client";

import Link from "next/link";

export default function CanvasView() {
  return (
    <div className="rounded-xl border p-6 text-center"><p>The canvas is now a standalone workspace.</p><Link className="mt-3 inline-block font-bold underline" href="/zinemat">Create a canvas in ZineMat</Link></div>
  );
}
