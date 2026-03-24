"use client";

import clsx from "clsx";
import type { MiniZineTemplate } from "./miniZineTemplates";

/** Tiny 4×2 grid matching mini zine fold layout — same order as MiniZineEditor. */
const THUMB_ORDER = [6, 5, 4, 3, 7, 0, 1, 2] as const;

interface MiniTemplatePickerCardProps {
  template: MiniZineTemplate;
  selected: boolean;
  onSelect: () => void;
}

export default function MiniTemplatePickerCard({
  template,
  selected,
  onSelect,
}: MiniTemplatePickerCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "group flex w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition",
        selected
          ? "border-[#3b82f6] ring-2 ring-[#3b82f6]/35"
          : "border-gray-200 hover:border-gray-300 hover:shadow-md"
      )}
    >
      <div className="relative aspect-[11/8.5] w-full shrink-0 overflow-hidden rounded-t-2xl border-b border-gray-100">
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 gap-px bg-gray-300/80 p-px">
          {THUMB_ORDER.map((pageIdx, i) => (
            <div
              key={`${template.id}-${pageIdx}`}
              className="min-h-0 min-w-0 overflow-hidden"
              style={template.slotStyle(pageIdx)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 px-3 py-3 sm:px-4">
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-[#F0EBCC] text-lg font-semibold text-gray-800"
            aria-hidden
          >
            Z
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-gray-900">{template.name}</p>
            <p className="mt-0.5 text-xs leading-snug text-gray-500">{template.shortLabel}</p>
          </div>
        </div>
        {template.tagline ? (
          <p className="pl-[2.625rem] text-[11px] leading-relaxed text-gray-400">{template.tagline}</p>
        ) : null}
      </div>
    </button>
  );
}
