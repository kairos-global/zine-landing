"use client";

import QRCode from "qrcode-generator";
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

  const generateQRDataURL = (url: string): string => {
    try {
      const qr = QRCode(0, "L");
      qr.addData(url);
      qr.make();
      return qr.createDataURL(4); // size multiplier
    } catch (err) {
      return "";
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700 leading-snug">
        QR codes will be auto-generated for any links you&apos;ve selected. Use this
        section to preview which links will get codes on <b>Save/Publish</b>.
      </p>

      {qrLinks.length === 0 ? (
        <div className="text-sm text-gray-600">
          No QR links yet. Toggle them on in <b>Interactivity</b>.
        </div>
      ) : (
        <div className="space-y-3">
          {qrLinks.map((link) => {
            // Prefer redirect_path if available, else raw url
            const targetUrl = link.redirect_path
              ? `${process.env.NEXT_PUBLIC_SITE_URL}${link.redirect_path}`
              : link.url;

            // If backend already gave us a qr_path, show that
            const qrImage = link.qr_path
              ? link.qr_path
              : generateQRDataURL(targetUrl);

            return (
              <div
                key={link.id}
                className="rounded-lg border px-4 py-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                {/* Left side */}
                <div className="flex-1">
                  <div className="font-semibold text-base text-black">
                    {link.label || "Unnamed Link"}
                  </div>
                  <div className="text-sm text-gray-600 break-words">
                    {link.url}
                  </div>
                  {link.redirect_path && (
                    <div className="text-xs text-gray-500 break-words">
                      Redirect: {link.redirect_path}
                    </div>
                  )}
                </div>

                {/* Right side */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    className="px-3 py-1.5 text-sm bg-black text-white rounded"
                    onClick={() => toggleQR(link.id)}
                  >
                    {link.generateQR ? "Remove QR" : "Generate QR"}
                  </button>

                  {qrImage ? (
                    <img
                      src={qrImage}
                      alt="QR Code"
                      className="w-20 h-20 border border-gray-300 rounded object-contain"
                    />
                  ) : (
                    <div className="w-20 h-20 border border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
                      QR
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-gray-500 pt-1">
        QR Codes Selected: <b>{qrLinks.length}</b> / {links.length}
      </div>
    </div>
  );
}
