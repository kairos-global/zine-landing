"use client";

export type Basics = { title: string; date?: string | null };
``
export default function BasicsSection({
  value,
  onChange,
}: {
  value: Basics;
  onChange: (next: Basics) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm">Title *</label>
      <input
        className="w-full rounded-xl border px-3 py-2"
        value={value.title}
        placeholder="Issue title"
        onChange={(e) => onChange({ ...value, title: e.target.value })}
      />
      <label className="text-sm">Date (optional)</label>
      <input
        type="date"
        className="w-full rounded-xl border px-3 py-2"
        value={value.date ?? ""}
        onChange={(e) => onChange({ ...value, date: e.target.value || null })}
      />
    </div>
  );
}
