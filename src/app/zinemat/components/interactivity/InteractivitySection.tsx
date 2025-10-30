"use client";

import { useRef } from "react";
import QRCode from "qrcode-generator";

export type InteractiveLink = {
  id: string;
  label: string;
  url: string;
  generateQR: boolean;
  redirect_path?: string | null;
  qr_path?: string | null;
};

export default function InteractivitySection({
  links,
  onChange,
  issueId,
  slug,
  siteUrl,
}: {
  links: InteractiveLink[];
  onChange: (next: InteractiveLink[]) => void;
  issueId?: string | null;
  slug?: string | null;
  siteUrl?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const maxLinks = 8;

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (links.length >= maxLinks) return;
    const fd = new FormData(e.currentTarget);
    const label = (fd.get("label") as string)?.trim() ?? "";
    let url = (fd.get("url") as string)?.trim() ?? "";
    const generateQR = fd.get("qr") === "on";

    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    const linkId = crypto.randomUUID();
    const next: InteractiveLink = {
      id: linkId,
      label,
      url,
      generateQR,
      redirect_path: null,
      qr_path: null,
    };
    onChange([...links, next]);
    e.currentTarget.reset();
  }

  const remove = (id: string) => onChange(links.filter((l) => l.id !== id));
  const toggleQR = (id: string) =>
    onChange(
      links.map((l) => (l.id === id ? { ...l, generateQR: !l.generateQR } : l))
    );

  const generateQRDataURL = (url: string): string => {
    try {
      const qr = QRCode(0, "L");
      qr.addData(url);
      qr.make();
      return qr.createDataURL(4);
    } catch (err) {
      return "";
    }
  };

  const downloadQR = (dataURL: string, label: string) => {
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `qr-${label.toLowerCase().replace(/\s+/g, "-") || "code"}.png`;
    link.click();
  };

  const baseUrl = siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://zineground.com";
  const qrLinks = links.filter((l) => l.generateQR);

  return (
    <div className="relative">
      {/* 🔒 Overlay if draft not saved */}
      {!issueId && (
        <div className="absolute inset-0 z-10 flex items-start justify-center backdrop-blur-sm bg-white/80 rounded-md pointer-events-none">
          <div className="mt-6 bg-green-100 text-green-900 text-sm px-4 py-2 rounded shadow">
            💡 Save your draft before adding links or generating QR codes.
          </div>
        </div>
      )}

      <div className={!issueId ? "opacity-40 pointer-events-none" : ""}>
        {/* 🧩 Add Link Form */}
        <form
          ref={formRef}
          onSubmit={add}
          className="grid gap-2 md:grid-cols-4 items-end mb-4"
        >
          <input
            name="label"
            className="rounded-xl border px-3 py-2"
            placeholder="Label (e.g. Link 1)"
            disabled={!issueId}
          />
          <input
            name="url"
            className="rounded-xl border px-3 py-2 md:col-span-2"
            placeholder="https://your-link"
            disabled={!issueId}
          />
          <div className="flex items-center gap-3">
            <label className="text-md flex items-center gap-2">
              <input type="checkbox" name="qr" defaultChecked disabled={!issueId} />
              QR
            </label>
            <button
              className="ml-auto rounded-xl bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
              type="submit"
              disabled={!issueId || links.length >= maxLinks}
            >
              Add
            </button>
          </div>
        </form>

        {links.length >= maxLinks && (
          <div className="text-xs text-orange-600 mb-2">
            Maximum {maxLinks} links reached
          </div>
        )}

        {/* 🔗 Link List */}
        <div className="space-y-2 mb-6">
          {links.length === 0 ? (
            <div className="text-xs text-gray-500">No links yet (max {maxLinks})</div>
          ) : (
            links.map((l, index) => (
              <div
                key={l.id}
                className="rounded-lg border p-3 text-sm flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium mb-1">
                      {l.label || `Link ${index + 1}`}
                    </div>
                    <a
                      className="text-xs text-blue-600 underline break-all"
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {l.url}
                    </a>
                  </div>
                  <button
                    onClick={() => remove(l.id)}
                    className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={l.generateQR}
                      onChange={() => toggleQR(l.id)}
                    />
                    Generate QR Code
                  </label>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 📊 QR Code Preview & Download */}
        {issueId && qrLinks.length > 0 && (
          <div className="rounded-lg border bg-gray-50 p-4">
            <h4 className="text-sm font-semibold mb-3">QR Codes</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {qrLinks.map((l, index) => {
                // Generate QR URL: /qr/[issueId]/[linkId]
                const qrRedirectUrl = `${baseUrl}/qr/${issueId}/${l.id}`;
                const dataURL = generateQRDataURL(qrRedirectUrl);

                return (
                  <div key={l.id} className="bg-white rounded-lg border p-3 flex flex-col items-center">
                    <div className="text-xs font-medium mb-2 text-center">
                      {l.label || `Link ${index + 1}`}
                    </div>
                    {dataURL && (
                      <>
                        <img
                          src={dataURL}
                          alt={`QR for ${l.label}`}
                          className="w-full aspect-square mb-2"
                        />
                        <button
                          onClick={() => downloadQR(dataURL, l.label || `link-${index + 1}`)}
                          className="w-full text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition"
                        >
                          Download QR
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-gray-600 bg-blue-50 p-2 rounded">
              <strong>How it works:</strong> QR codes redirect to{" "}
              <code className="bg-blue-100 px-1 py-0.5 rounded">
                zineground.com/qr/[issueId]/[linkId]
              </code>
              , which tracks the scan and redirects to your actual URL. You can edit links anytime and the QR code will point to the updated URL!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
