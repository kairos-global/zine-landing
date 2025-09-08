"use client";

/** Supports either legacy A–E checklist or the newer {basics, cover, links} shape. */
type LegacyChecklist = Partial<Record<"A" | "B" | "C" | "D" | "E", boolean>>;
type NewChecklist = Partial<{ basics: boolean; cover: boolean; links: boolean }>;

export default function FinalChecklist({
  checklist,
}: {
  checklist: LegacyChecklist | NewChecklist;
}) {
  // Detect format
  const isLegacy =
    "A" in checklist ||
    "B" in checklist ||
    "C" in checklist ||
    "D" in checklist ||
    "E" in checklist;

  const items = isLegacy
    ? ([
        { ok: !!(checklist as LegacyChecklist).A, label: "A) Basics (required)" },
        { ok: !!(checklist as LegacyChecklist).B, label: "B) Files (required)" },
        { ok: !!(checklist as LegacyChecklist).C, label: "C) Tracking Entries (optional)" },
        { ok: !!(checklist as LegacyChecklist).D, label: "D) QR codes (optional)" },
        { ok: !!(checklist as LegacyChecklist).E, label: "E) Final Zine Links (optional)" },
      ] as const)
    : ([
        { ok: !!(checklist as NewChecklist).basics, label: "Basics: Title (required)" },
        { ok: !!(checklist as NewChecklist).cover, label: "Cover (optional)" },
        { ok: !!(checklist as NewChecklist).links, label: "Interactivity (optional)" },
      ] as const);

  return (
    <div>
      <h3 className="font-semibold mb-2">Publish checklist</h3>
      <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-5 text-sm">
        {items.map((it, idx) => (
          <li
            key={idx}
            className={`rounded-lg border px-3 py-2 ${
              it.ok ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
            }`}
          >
            {it.ok ? "✓" : "•"} {it.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
