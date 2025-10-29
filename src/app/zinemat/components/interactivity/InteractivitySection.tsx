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

    const next: InteractiveLink = {
      id: crypto.randomUUID(),
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

  const baseUrl = siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "";
  const issueUrl = issueId ? `${baseUrl}/issue/${slug || issueId}` : "";
  const linktreeUrl = issueId ? `${issueUrl}/linktree` : "";
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
            placeholder="Label"
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
              disabled={!issueId}
            >
              Add
            </button>
          </div>
        </form>

        {/* 🔗 Link List */}
        <div className="space-y-2 mb-6">
          {links.length === 0 ? (
            <div className="text-xs text-gray-500">No links yet</div>
          ) : (
            links.map((l) => (
              <div
                key={l.id}
                className="rounded-lg border p-2 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
              >
                <div className="font-medium break-words">
                  {l.label || "Unnamed Link"}
                </div>
                <a
                  className="text-xs underline break-all"
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {l.url}
                </a>
                <div className="flex items-center gap-2">
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={l.generateQR}
                      onChange={() => toggleQR(l.id)}
                    />
                    QR
                  </label>
                  <button
                    onClick={() => remove(l.id)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-white"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 🧾 QR Section */}
        <div className="space-y-3">
          {issueId && (
            <div className="grid sm:grid-cols-2 gap-4 mb-2">
              <QRPreview
                title="Issue QR"
                url={issueUrl}
                color="border-blue-300 bg-blue-50"
              />
              <QRPreview
                title="Linktree QR"
                url={linktreeUrl}
                color="border-green-300 bg-green-50"
              />
            </div>
          )}

          {qrLinks.length === 0 ? (
            <div className="text-sm text-gray-600">
              No QR links yet. Toggle them on in Interactivity.
            </div>
          ) : (
            <div className="space-y-3">
              {qrLinks.map((link) => {
                const redirectUrl = link.redirect_path
                  ? `${baseUrl}${link.redirect_path}`
                  : link.url;
                const qrImage = link.qr_path
                  ? link.qr_path
                  : generateQRDataURL(redirectUrl);

                return (
                  <div
                    key={link.id}
                    className="rounded-lg border px-4 py-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-base text-black">
                        {link.label || "Unnamed Link"}
                      </div>
                      <div className="text-sm text-gray-600 break-words">
                        {link.url}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
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
      </div>
    </div>
  );
}

// ✅ Reusable QR Preview
function QRPreview({
  title,
  url,
  color,
}: {
  title: string;
  url: string;
  color?: string;
}) {
  const qr = QRCode(0, "L");
  qr.addData(url);
  qr.make();
  const qrData = qr.createDataURL(4);

  return (
    <div
      className={`rounded-lg border px-4 py-3 shadow-sm ${color || ""}`}
      style={{ borderColor: "#ccc" }}
    >
      <div className="text-sm font-semibold mb-1">{title}</div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="text-xs text-gray-600 break-all">{url}</div>
        </div>
        <img
          src={qrData}
          alt="QR Code"
          className="w-16 h-16 border border-gray-300 rounded object-contain"
        />
      </div>
    </div>
  );
}
