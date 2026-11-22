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

      <div className="space-y-2">
        <p className="text-sm font-medium">Format</p>
        <div className="rounded-xl border-2 border-[#65CBF1] bg-[#65CBF1]/10 p-3">
          <span className="block text-sm font-semibold">{value.zine_format === "mini" ? "Mini Zine" : "Half Letter Zine"}</span>
          <span className="mt-0.5 block text-xs text-gray-600">
            {value.zine_format === "mini" ? "Letter sheet folded into 8 panels" : "Existing half letter zine"}
          </span>
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
