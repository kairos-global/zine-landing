"use client";

import { useState } from "react";
import clsx from "clsx";
import ZineCanvas from "./ZineCanvas";

type Format = "mini" | "half_letter";

export default function CanvasView() {
  const [format, setFormat] = useState<Format>("mini");

  return (
    <div className="mx-auto max-w-5xl px-2 py-8 sm:px-4">
      {/* Format selector */}
      <section className="mb-10">
        <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">Formats</h2>
        <div className="flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
          <button
            type="button"
            onClick={() => setFormat("mini")}
            className={clsx(
              "rounded-2xl border-2 px-8 py-5 text-center shadow-sm transition sm:min-w-[220px]",
              format === "mini"
                ? "border-[#65CBF1] bg-[#e8f8fd]"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            <span className="block text-lg font-semibold text-gray-900">Mini Zine</span>
            <span className="mt-1 block text-sm text-gray-600">8 panels, letter sheet fold</span>
          </button>
          <button
            type="button"
            onClick={() => setFormat("half_letter")}
            className={clsx(
              "rounded-2xl border-2 px-8 py-5 text-center shadow-sm transition sm:min-w-[220px]",
              format === "half_letter"
                ? "border-[#65CBF1] bg-[#e8f8fd]"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            <span className="block text-lg font-semibold text-gray-900">Half Letter Zine</span>
            <span className="mt-1 block text-sm text-gray-600">Letter sheet folded in half</span>
          </button>
        </div>
      </section>

      <div className="my-10 border-t border-gray-200" aria-hidden />

      {/* Canvas editor */}
      <section>
        <ZineCanvas format={format} />
      </section>
    </div>
  );
}
