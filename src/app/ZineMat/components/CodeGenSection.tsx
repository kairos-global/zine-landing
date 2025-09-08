// src/app/zinemat/components/CodeGenSection.tsx
"use client";

import type { InteractiveLink } from "../page";

export default function CodeGenSection({
  links,
  onChangeLinks,
}: {
  links: InteractiveLink[];
  onChangeLinks: (next: InteractiveLink[]) => void;
}) {
  const qrLinks = links.filter((l) => l.generateQR);

  const toggleQR = (id: string) =>
    onChangeLinks(
      links.map((l) => (l.id === id ? { ...l, generateQR: !l.generateQR } : l))
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">
        Choose which links should get a QR. We’ll generate them automatically on{" "}
        <b>Save/Publish</b>.
      </p>

      {links.length === 0 ? (
        <div className="text-sm text-gray-600">
          No links yet. Add some in <b>Interactivity</b>.
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((l) => (
            <div
              key={l.id}
              className="rounded-lg border p-2 text-sm flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {l.type}{l.label ? ` — ${l.label}` : ""}
                </div>
                <div className="text-xs text-gray-600 break-all">{l.url}</div>
              </div>
              <label className="text-xs flex items-center gap-2 ml-3 shrink-0">
                <input
                  type="checkbox"
                  checked={l.generateQR}
                  onChange={() => toggleQR(l.id)}
                />
                QR
              </label>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-600">
        Selected for QR: <b>{qrLinks.length}</b> / {links.length}
      </div>
    </div>
  );
}
