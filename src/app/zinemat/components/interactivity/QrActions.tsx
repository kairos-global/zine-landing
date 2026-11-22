"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { qrPngOptions } from "@/lib/zine-qr";

export function ActionIcon({ name }: { name: "download" | "place" | "close" }) {
  const paths = {
    download: "M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5",
    place: "M9 4H4v5m11-5h5v5m0 6v5h-5M4 15v5h5m0-8h6m-3-3v6",
    close: "m6 6 12 12M6 18 18 6",
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

export function QrActions({ url, label, canPlace, prepare, onPlace }: {
  url: string;
  label: string;
  canPlace: boolean;
  prepare: () => Promise<boolean>;
  onPlace: (src: string, label: string) => void;
}) {
  const [image, setImage] = useState<{ url: string; src: string } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const src = image?.url === url ? image.src : "";
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, { ...qrPngOptions, type: "image/png" }).then(src => {
      if (active) setImage({ url, src });
    }).catch(() => {
      if (active) setError("Couldn’t generate the QR code.");
    });
    return () => { active = false; };
  }, [url]);

  async function run(placing: boolean) {
    if (!src) return;
    setWaiting(true);
    setError("");
    try {
      if (!await prepare()) throw new Error("Couldn’t register the tracking link. Try again.");
      if (placing) onPlace(src, label);
      else {
        const download = document.createElement("a");
        download.href = src;
        download.download = `qr-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "code"}.png`;
        download.click();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t prepare the QR code.");
    } finally {
      setWaiting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} width={88} height={88} alt={`${label} QR code`} className="order-last rounded-md border border-green-200 bg-white" />
      )}
      <button type="button" disabled={!src || waiting} onClick={() => void run(false)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#82E385] px-3 text-sm font-medium text-green-950 hover:bg-green-300 disabled:opacity-50">
        <ActionIcon name="download" /> {waiting ? "Preparing…" : "Download QR"}
      </button>
      {canPlace && (
        <button type="button" disabled={!src || waiting} onClick={() => void run(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-green-300 px-3 text-sm font-medium hover:bg-green-50 disabled:opacity-50">
          <ActionIcon name="place" /> Place on file
        </button>
      )}
      {error && <p role="alert" className="w-full text-xs text-red-700">{error}</p>}
    </div>
  );
}
