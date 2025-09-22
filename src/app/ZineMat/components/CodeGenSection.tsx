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
    <div className="space-y-4">
      <p className="text-sm text-gray-700 leading-snug">
        QR codes will be auto-generated for any links you've selected. Use this section to preview which links will get codes on <b>Save/Publish</b>.
      </p>

      {qrLinks.length === 0 ? (
        <div className="text-sm text-gray-600">No QR links yet. Toggle them on in <b>Interactivity</b>.</div>
      ) : (
        <div className="space-y-3">
          {qrLinks.map((link) => (
            <div
              key={link.id}
              className="rounded-lg border px-4 py-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              {/* Left side */}
              <div className="flex-1">
                <div className="font-semibold text-base text-black">
                  {link.label || "Unnamed Link"}
                </div>
                <div className="text-sm text-gray-600 break-words">{link.url}</div>
              </div>

              {/* Right side */}
              <div className="flex flex-col items-center gap-2">
                <button
                  className="px-3 py-1.5 text-sm bg-black text-white rounded"
                  onClick={() => alert("QR preview coming soon")}
                >
                  Generate QR Code
                </button>
                <div className="w-20 h-20 border border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
                  QR
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-500 pt-1">
        QR Codes Selected: <b>{qrLinks.length}</b> / {links.length}
      </div>
    </div>
  );
}
