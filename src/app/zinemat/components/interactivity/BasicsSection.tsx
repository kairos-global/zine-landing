"use client";

import { ZINE_CATEGORIES, ZineCategoryKey } from "@/lib/zine-categories";

export type ZineFormat = "mini" | "half_letter";
export type Basics = {
  title: string;
  zine_format: ZineFormat;
  category: ZineCategoryKey | null;
};

export default function BasicsSection({
  value,
  onChange,
}: {
  value: Basics;
  onChange: (next: Basics) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Title *</label>
        <input
          className="w-full rounded-xl border px-3 py-2"
          value={value.title}
          placeholder="Enter your zine title"
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          required
        />
      </div>

      {/* Format */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Format *</label>
        <div className="grid grid-cols-2 gap-2">
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

      {/* Category — optional */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Category <span className="text-gray-400 font-normal">— optional</span>
        </label>
        <select
          className="w-full rounded-xl border px-3 py-2 bg-white text-sm"
          value={value.category ?? ""}
          onChange={(e) => {
            const next = e.target.value;
            onChange({
              ...value,
              category: next === "" ? null : (next as ZineCategoryKey),
            });
          }}
        >
          <option value="">— None —</option>
          {ZINE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          Helps readers and distributors browse by type.
        </p>
      </div>
    </div>
  );
}
