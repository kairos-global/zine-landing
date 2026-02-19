"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface IssueQRCodeProps {
  fullRedirectUrl: string;
  label: string;
}

/**
 * Renders a QR code that encodes the given full redirect URL.
 * Used on the issue view page so scans always go to the correct origin (no undefined).
 */
export function IssueQRCode({ fullRedirectUrl, label }: IssueQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fullRedirectUrl) return;
    QRCode.toDataURL(fullRedirectUrl, { width: 400 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [fullRedirectUrl]);

  if (!dataUrl) return <div className="w-full aspect-square bg-neutral-100 rounded animate-pulse" aria-hidden />;

  return (
    <img
      src={dataUrl}
      alt={`QR code for ${label || "link"}`}
      className="w-full aspect-square"
    />
  );
}
