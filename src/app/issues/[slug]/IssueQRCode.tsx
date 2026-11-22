"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function IssueQRCode({ fullRedirectUrl, label }: { fullRedirectUrl: string; label: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(fullRedirectUrl, { width: 320, margin: 4, errorCorrectionLevel: "M" })
      .then(value => { if (active) setSrc(value); })
      .catch(() => { if (active) setSrc(undefined); });
    return () => { active = false; };
  }, [fullRedirectUrl]);

  if (!src) return <div className="aspect-square w-full bg-neutral-100" aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`QR code for ${label}`} className="aspect-square w-full" />;
}
