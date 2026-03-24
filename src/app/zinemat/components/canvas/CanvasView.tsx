"use client";

import { useState } from "react";
import clsx from "clsx";
import MiniZineEditor from "./MiniZineEditor";
import FullZineEditor from "./FullZineEditor";
import MiniTemplatePickerCard from "./MiniTemplatePickerCard";
import type { MiniZineTemplateId } from "./miniZineTemplates";
import {
  FULL_ZINE_TEMPLATES_CATALOG,
  MINI_ZINE_TEMPLATES_CATALOG,
  type TemplateBrowserFilter,
} from "./canvasTemplateCatalog";

type Mode = "SELECT" | "MINI" | "FULL";

export default function CanvasView() {
  const [mode, setMode] = useState<Mode>("SELECT");
  /** Set only when entering Mini from the template browser (not from Formats). */
  const [miniTemplateId, setMiniTemplateId] = useState<MiniZineTemplateId | undefined>(undefined);
  const [templateFilter, setTemplateFilter] = useState<TemplateBrowserFilter>("all");

  const showMiniTemplates = templateFilter === "all" || templateFilter === "mini";
  const showFullTemplates = templateFilter === "all" || templateFilter === "full";

  if (mode === "MINI") {
    return (
      <MiniZineEditor
        onBack={() => {
          setMode("SELECT");
          setMiniTemplateId(undefined);
        }}
        templateId={miniTemplateId}
      />
    );
  }

  if (mode === "FULL") {
    return (
      <FullZineEditor
        onBack={() => {
          setMode("SELECT");
        }}
      />
    );
  }

  function goMiniBlank() {
    setMiniTemplateId(undefined);
    setMode("MINI");
  }

  function goMiniWithTemplate(id: MiniZineTemplateId) {
    setMiniTemplateId(id);
    setMode("MINI");
  }

  function goFullBlank() {
    setMode("FULL");
  }

  return (
    <div className="mx-auto max-w-4xl px-2 py-8 sm:px-4">
      {/* —— Formats: fold / file structure only —— */}
      <section className="mb-10">
        <h2 className="mb-2 text-center text-xl font-semibold text-gray-900">Formats</h2>
        <p className="mx-auto mb-8 max-w-xl text-center text-sm text-gray-600">
          Formats define how the sheet is folded and how the export is structured — not the look of the
          zine. Pick one to open a blank canvas with the classic gray panels.
        </p>
        <div className="flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
          <button
            type="button"
            onClick={goMiniBlank}
            className="rounded-2xl border-2 border-gray-200 bg-white px-8 py-5 text-center shadow-sm transition hover:border-gray-300 hover:bg-gray-50 sm:min-w-[220px]"
          >
            <span className="block text-lg font-semibold text-gray-900">Mini Zine</span>
            <span className="mt-1 block text-sm text-gray-600">8 panels, letter sheet fold</span>
          </button>
          <button
            type="button"
            onClick={goFullBlank}
            className="rounded-2xl border-2 border-gray-200 bg-white px-8 py-5 text-center shadow-sm transition hover:border-gray-300 hover:bg-gray-50 sm:min-w-[220px]"
          >
            <span className="block text-lg font-semibold text-gray-900">Full Zine</span>
            <span className="mt-1 block text-sm text-gray-600">Half-letter spreads</span>
          </button>
        </div>
      </section>

      <div className="my-10 border-t border-gray-200" aria-hidden />

      {/* —— Templates: designed skins (code/SVG first; richer layouts later) —— */}
      <section>
        <h2 className="mb-2 text-center text-xl font-semibold text-gray-900">Templates</h2>
        <p className="mx-auto mb-2 max-w-xl text-center text-sm text-gray-600">
          Browse starter layouts — photo zine, catalog, recipe, poem, and more. These add structure and
          placeholders on top of the fold; your images drop into the open slots.
        </p>
        <p className="mx-auto mb-6 max-w-lg text-center text-xs text-gray-500">
          We&apos;re evolving these into full vector/code layouts so export is one composed file. Filter
          by format to match mini (8-up) or full spreads.
        </p>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-500">Show</span>
          {(
            [
              ["all", "All"],
              ["mini", "Mini zine"],
              ["full", "Full zine"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTemplateFilter(id)}
              className={clsx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                templateFilter === id
                  ? "border-[#3b82f6] bg-blue-50 text-[#1d4ed8]"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {showMiniTemplates && MINI_ZINE_TEMPLATES_CATALOG.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MINI_ZINE_TEMPLATES_CATALOG.map((t) => (
              <MiniTemplatePickerCard key={t.id} template={t} onSelect={() => goMiniWithTemplate(t.id)} />
            ))}
          </div>
        )}

        {showFullTemplates && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-10 text-center">
            {FULL_ZINE_TEMPLATES_CATALOG.length === 0 ? (
              <>
                <p className="text-sm font-medium text-gray-800">Full zine templates coming soon</p>
                <p className="mt-2 text-sm text-gray-600">
                  Designed spreads will appear here as we add SVG/React layouts. Use{" "}
                  <strong className="font-semibold text-gray-800">Formats → Full Zine</strong> for a blank
                  spread for now.
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-600">Full template cards will render here.</p>
            )}
          </div>
        )}

        {templateFilter === "mini" && MINI_ZINE_TEMPLATES_CATALOG.length === 0 && (
          <p className="text-center text-sm text-gray-500">No mini templates in the catalog yet.</p>
        )}
      </section>
    </div>
  );
}
