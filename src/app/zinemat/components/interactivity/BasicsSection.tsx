"use client";

import { ZINE_CATEGORIES, type ZineCategoryKey } from "@/lib/zine-categories";

export type ZineFormat = "mini" | "half_letter";
export type Basics = { title: string; zine_format: ZineFormat };

export default function BasicsSection({
  value,
  onChange,
  category,
  onCategoryChange,
}: {
  value: Basics;
  onChange: (next: Basics) => void;
  category: ZineCategoryKey | null;
  onCategoryChange: (category: ZineCategoryKey | null) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <label htmlFor="zinemat-title" className="text-sm font-medium">Title *</label>
        <input
          id="zinemat-title"
          className="min-h-11 w-full rounded-xl border px-3 py-2 text-base"
          value={value.title}
          placeholder="Enter your zine title"
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          required
        />
      </div>

      {/* Format */}
      <div className="space-y-2">
        <p id="zinemat-format" className="text-sm font-medium">Format *</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="zinemat-format">
          {(
            [
              {
                id: "mini" as ZineFormat,
                label: "Mini Zine",
                desc: "Letter sheet folded into 8 panels",
              },
              {
                id: "half_letter" as ZineFormat,
                label: "Half Letter Zine",
                desc: "Letter sheet folded in half",
              },
            ] as const
          ).map(({ id, label, desc }) => {
            const selected = value.zine_format === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...value, zine_format: id })}
                className={`rounded-xl border-2 p-3 text-left transition ${
                  selected
                    ? "border-[#65CBF1] bg-[#65CBF1]/10"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{desc}</span>
              </button>
            );
          })}
        </div>
      </div>
      <label className="block text-sm font-medium">
        Category <span className="font-normal text-gray-500">· Optional</span>
        <select
          value={category ?? ""}
          onChange={event => onCategoryChange(event.target.value ? event.target.value as ZineCategoryKey : null)}
          className="mt-2 block min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-base"
        >
          <option value="">No category</option>
          {ZINE_CATEGORIES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
    </div>
  );
}
