"use client";

import { useRef, useState } from "react";
import QRCode from "qrcode-generator";

export type InteractiveLink = {
  id: string;
  label: string;
  url: string;
  generateQR: boolean;
  redirect_path?: string | null;
  qr_path?: string | null;
};

// Interactivity section accent (green)
const GREEN = "#82E385";
const GREEN_DARK = "#2A6B2C";

// ─── Small pill toggle ────────────────────────────────────────────────────────
function PillToggle({
  checked,
  onChange,
  label,
  accent = GREEN,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-1.5 select-none"
      aria-pressed={checked}
    >
      <div
        className="relative w-8 h-[18px] rounded-full transition-colors duration-200 flex-shrink-0"
        style={{ backgroundColor: checked ? accent : "#D1D5DB" }}
      >
        <div
          className="absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full shadow-sm transition-all duration-200"
          style={{ left: checked ? "18px" : "2px" }}
        />
      </div>
      {label && (
        <span className="text-xs" style={{ color: checked ? GREEN_DARK : "#6B7280" }}>
          {label}
        </span>
      )}
    </button>
  );
}

// ─── QR data URL generator ────────────────────────────────────────────────────
function generateQRDataURL(url: string): string {
  try {
    const qr = QRCode(0, "L");
    qr.addData(url);
    qr.make();
    return qr.createDataURL(4);
  } catch {
    return "";
  }
}

function downloadQR(dataURL: string, label: string) {
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = `qr-${label.toLowerCase().replace(/\s+/g, "-") || "code"}.png`;
  link.click();
}

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
  const [formQR, setFormQR] = useState(true);
  const maxLinks = 8;

  // Separate issue QR link from user links
  const issueQrLink = links.find((l) => l.label === "__issue_qr__");
  const regularLinks = links.filter((l) => l.label !== "__issue_qr__");

  const baseUrl = siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://zineground.com";

  // Issue QR display: prefer stored qr_path, fall back to client-side preview
  const issueQrImageUrl = issueQrLink?.qr_path
    ? issueQrLink.qr_path
    : slug
    ? generateQRDataURL(`${baseUrl}/issues/${slug}`)
    : "";

  const issueQrRedirectUrl = issueQrLink
    ? `${baseUrl}${issueQrLink.redirect_path}`
    : null;

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (regularLinks.length >= maxLinks) return;
    const fd = new FormData(e.currentTarget);
    const label = (fd.get("label") as string)?.trim() ?? "";
    let url = (fd.get("url") as string)?.trim() ?? "";

    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    const linkId = crypto.randomUUID();
    const next: InteractiveLink = {
      id: linkId,
      label,
      url,
      generateQR: formQR,
      redirect_path: null,
      qr_path: null,
    };
    onChange([...links, next]);
    e.currentTarget.reset();
    setFormQR(true);
  }

  const remove = async (id: string) => {
    const linkToRemove = regularLinks.find((l) => l.id === id);
    if (linkToRemove && issueId) {
      try {
        const response = await fetch(
          `/api/zinemat/deletelink?linkId=${id}&issueId=${issueId}`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          const errorData = await response.json();
          console.error("❌ [InteractivitySection] Delete error:", errorData);
          alert("Failed to delete link. Please try again.");
          return;
        }
      } catch (err) {
        console.error("❌ [InteractivitySection] Unexpected error:", err);
        alert("Failed to delete link. Please try again.");
        return;
      }
    }
    onChange(links.filter((l) => l.id !== id));
  };

  const toggleQR = (id: string) =>
    onChange(
      links.map((l) => (l.id === id ? { ...l, generateQR: !l.generateQR } : l))
    );

  return (
    <div className="relative">
      {/* 🔒 Overlay if draft not saved */}
      {!issueId && (
        <div className="absolute inset-0 z-10 flex items-start justify-center backdrop-blur-sm bg-white/80 rounded-md pointer-events-none">
          <div
            className="mt-6 text-sm px-4 py-2 rounded shadow"
            style={{
              backgroundColor: `${GREEN}22`,
              border: `1px solid ${GREEN}88`,
              color: GREEN_DARK,
            }}
          >
            💡 Save your draft before adding links or generating QR codes.
          </div>
        </div>
      )}

      <div className={!issueId ? "opacity-40 pointer-events-none" : ""}>

        {/* ── Issue QR Block ──────────────────────────────────────────────── */}
        <div
          className="rounded-xl border-2 p-3 mb-4 flex items-start gap-3"
          style={{
            borderColor: `${GREEN}88`,
            backgroundColor: `${GREEN}0F`,
          }}
        >
          {/* QR image */}
          <div className="flex-shrink-0">
            {issueQrImageUrl ? (
              <img
                src={issueQrImageUrl}
                alt="Issue QR Code"
                className="w-[72px] h-[72px] rounded-md border"
                style={{ borderColor: `${GREEN}55` }}
              />
            ) : (
              <div
                className="w-[72px] h-[72px] rounded-md border flex items-center justify-center text-xs text-center"
                style={{ borderColor: `${GREEN}55`, color: GREEN_DARK }}
              >
                QR pending
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold mb-0.5" style={{ color: GREEN_DARK }}>
              Issue QR Code
            </div>
            <div className="text-xs text-gray-500 mb-1.5">
              Scans redirect to your published zine via Zineground. Print it in your zine
              or share it anywhere.
            </div>
            {!issueQrLink && (
              <div className="text-[10px]" style={{ color: `${GREEN_DARK}99` }}>
                ⏳ Will activate after your first save
              </div>
            )}
            {issueQrLink && issueQrImageUrl && (
              <button
                type="button"
                onClick={() =>
                  downloadQR(
                    issueQrLink.qr_path || issueQrImageUrl,
                    slug || "issue"
                  )
                }
                className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                style={{
                  backgroundColor: GREEN,
                  color: "white",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor = GREEN_DARK)
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor = GREEN)
                }
              >
                ↓ Download
              </button>
            )}
          </div>
        </div>

        {/* ── Add Link Form ────────────────────────────────────────────────── */}
        <form ref={formRef} onSubmit={add} className="mb-4 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            {/* Label input */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Label</label>
              <input
                name="label"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="e.g. My Instagram"
                disabled={!issueId}
              />
            </div>

            {/* URL input */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-gray-600">Link URL</label>
              <input
                name="url"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="https://your-link.com"
                disabled={!issueId}
              />
            </div>

            {/* QR toggle + Add button */}
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">QR</label>
                <div className="flex items-center h-[38px]">
                  <PillToggle
                    checked={formQR}
                    onChange={setFormQR}
                    label={formQR ? "On" : "Off"}
                  />
                </div>
              </div>
              <button
                className="ml-auto rounded-xl px-3 py-2 text-sm text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "black" }}
                type="submit"
                disabled={!issueId || regularLinks.length >= maxLinks}
              >
                Add
              </button>
            </div>
          </div>

          {regularLinks.length >= maxLinks && (
            <div className="text-xs text-orange-600">
              Maximum {maxLinks} links reached
            </div>
          )}
        </form>

        {/* ── Added Links ──────────────────────────────────────────────────── */}
        {regularLinks.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">
              Added Links ({regularLinks.length}/{maxLinks})
            </div>
            <div className="space-y-2">
              {regularLinks.map((l, index) => {
                // QR for this link: prefer stored qr_path, fall back to client-side
                const qrUrl = l.qr_path
                  ? l.qr_path
                  : l.redirect_path
                  ? generateQRDataURL(`${baseUrl}${l.redirect_path}`)
                  : l.generateQR
                  ? generateQRDataURL(l.url)
                  : "";

                return (
                  <div
                    key={l.id}
                    className="rounded-xl border bg-white p-3 flex gap-3 items-start"
                  >
                    {/* Link info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm mb-0.5">
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

                      <div className="mt-2">
                        <PillToggle
                          checked={l.generateQR}
                          onChange={() => toggleQR(l.id)}
                          label="Generate QR"
                        />
                      </div>
                    </div>

                    {/* Inline QR preview when enabled */}
                    {l.generateQR && qrUrl && (
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <img
                          src={qrUrl}
                          alt={`QR for ${l.label}`}
                          className="w-[60px] h-[60px] rounded border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            downloadQR(qrUrl, l.label || `link-${index + 1}`)
                          }
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors"
                          style={{ backgroundColor: GREEN, color: "white" }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.backgroundColor =
                              GREEN_DARK)
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.backgroundColor =
                              GREEN)
                          }
                        >
                          ↓ DL
                        </button>
                      </div>
                    )}

                    {/* Remove */}
                    <button
                      onClick={() => remove(l.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {regularLinks.length === 0 && issueId && (
          <div className="text-xs text-gray-400 text-center py-3">
            No links added yet — use the form above to add your first link.
          </div>
        )}
      </div>
    </div>
  );
}
