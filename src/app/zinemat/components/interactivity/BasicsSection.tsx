"use client";

export type Basics = { title: string };

export default function BasicsSection({
  value,
  onChange,
}: {
  value: Basics;
  onChange: (next: Basics) => void;
}) {
  return (
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
  );
}
