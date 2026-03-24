"use client";

import { useState } from "react";
import clsx from "clsx";
import MiniZineEditor from "./MiniZineEditor";
import FullZineEditor from "./FullZineEditor";
import MiniTemplatePickerCard from "./MiniTemplatePickerCard";
import {
  DEFAULT_MINI_TEMPLATE_ID,
  MINI_ZINE_TEMPLATES,
  type MiniZineTemplateId,
} from "./miniZineTemplates";

type Mode = "SELECT" | "MINI" | "FULL";
type FormatChoice = "MINI" | "FULL" | null;

export default function CanvasView() {
  const [mode, setMode] = useState<Mode>("SELECT");
  const [format, setFormat] = useState<FormatChoice>(null);
  const [miniTemplateId, setMiniTemplateId] = useState<MiniZineTemplateId | null>(null);

  if (mode === "MINI") {
    const tid = miniTemplateId ?? DEFAULT_MINI_TEMPLATE_ID;
    return (
      <MiniZineEditor
        onBack={() => {
          setMode("SELECT");
        }}
        templateId={tid}
      />
    );
  }

  if (mode === "FULL") {
    return <FullZineEditor onBack={() => setMode("SELECT")} />;
  }

  const showMiniTemplates = format === "MINI";
  const canStart =
    format === "FULL" || (format === "MINI" && miniTemplateId !== null);

  function handleStart() {
    if (!canStart || !format) return;
    if (format === "FULL") {
      setMode("FULL");
      return;
    }
    setMode("MINI");
  }

  return (
    <div className="mx-auto max-w-4xl px-2 py-8 sm:px-4">
      <h2 className="mb-2 text-center text-xl font-semibold text-gray-900">Pick a format</h2>
      <p className="mb-8 text-center text-sm text-gray-600">
        Choose Mini or Full zine. For mini zines, pick a canvas template to begin — Zineground templates
        are free to use.
      </p>

      <div className="mb-10 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
        <button
          type="button"
          onClick={() => {
            setFormat("MINI");
          }}
          className={clsx(
            "rounded-2xl border-2 px-8 py-5 text-center shadow-sm transition sm:min-w-[220px]",
            format === "MINI"
              ? "border-[#3b82f6] bg-blue-50/80 ring-2 ring-[#3b82f6]/25"
              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
          )}
        >
          <span className="block text-lg font-semibold text-gray-900">Mini Zine</span>
          <span className="mt-1 block text-sm text-gray-600">8 panels, letter sheet fold</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setFormat("FULL");
            setMiniTemplateId(null);
          }}
          className={clsx(
            "rounded-2xl border-2 px-8 py-5 text-center shadow-sm transition sm:min-w-[220px]",
            format === "FULL"
              ? "border-[#3b82f6] bg-blue-50/80 ring-2 ring-[#3b82f6]/25"
              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
          )}
        >
          <span className="block text-lg font-semibold text-gray-900">Full Zine</span>
          <span className="mt-1 block text-sm text-gray-600">Half-letter spreads</span>
        </button>
      </div>

      {showMiniTemplates && (
        <section className="mb-10">
          <h3 className="mb-1 text-center text-base font-semibold text-gray-900">Choose a canvas template</h3>
          <p className="mb-6 text-center text-sm text-gray-600">
            Tap a template — your uploads will layer on top in the editor.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MINI_ZINE_TEMPLATES.map((t) => (
              <MiniTemplatePickerCard
                key={t.id}
                template={t}
                selected={miniTemplateId === t.id}
                onSelect={() => setMiniTemplateId(t.id)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className={clsx(
            "rounded-xl px-10 py-3 text-sm font-semibold text-white shadow transition",
            canStart ? "bg-[#3b82f6] hover:bg-[#2563eb]" : "cursor-not-allowed bg-gray-300 text-gray-500"
          )}
        >
          {format === "FULL" ? "Start Full Zine" : format === "MINI" ? "Start with this template" : "Continue"}
        </button>
        {!format && (
          <p className="text-center text-xs text-gray-500">Select a format above to continue.</p>
        )}
        {format === "MINI" && !miniTemplateId && (
          <p className="text-center text-xs text-gray-500">Select a template to enable start.</p>
        )}
      </div>
    </div>
  );
}
