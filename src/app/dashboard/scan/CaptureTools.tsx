"use client";

import { useRef, useState, type RefObject } from "react";
import styles from "./scanner.module.css";

type Shot = { id: string; data: string; width: number; height: number };
type Kind = "pdf" | "pattern";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function CaptureTools({ kind, videoRef, ready }: { kind: Kind; videoRef: RefObject<HTMLVideoElement | null>; ready: boolean }) {
  const [collections, setCollections] = useState<Record<Kind, Shot[]>>({ pdf: [], pattern: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const shots = collections[kind];

  function snapshot(source: CanvasImageSource, width: number, height: number): Shot {
    // Patterns collect a horizontal strip; documents retain the full image.
    const cropHeight = kind === "pattern" ? Math.min(height, width / 3) : height;
    const scale = Math.min(1, 1800 / Math.max(width, cropHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale); canvas.height = Math.round(cropHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image capture unavailable.");
    context.drawImage(source, 0, (height - cropHeight) / 2, width, cropHeight, 0, 0, canvas.width, canvas.height);
    return { id: crypto.randomUUID(), data: canvas.toDataURL("image/jpeg", .9), width: canvas.width, height: canvas.height };
  }

  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || lock.current) return;
    try {
      const shot = snapshot(video, video.videoWidth, video.videoHeight);
      setCollections(all => ({ ...all, [kind]: [...all[kind], shot].slice(0, 20) }));
      setError("");
    } catch { setError("Couldn’t capture. Try again."); }
  }

  async function importPhotos(files: File[]) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const added: Shot[] = [];
    try {
      for (const file of files.slice(0, 20 - shots.length)) {
        if (file.size > 20 * 1024 * 1024) throw new Error("Each image must be smaller than 20 MB.");
        const url = URL.createObjectURL(file);
        try {
          const image = new Image(); image.src = url; await image.decode();
          added.push(snapshot(image, image.naturalWidth, image.naturalHeight));
        } finally { URL.revokeObjectURL(url); }
      }
      setCollections(all => ({ ...all, [kind]: [...all[kind], ...added].slice(0, 20) }));
    } catch (e) { setError(e instanceof Error && e.message.includes("20 MB") ? e.message : "Couldn’t import. Try JPG, PNG, or WebP."); }
    finally { lock.current = false; setBusy(false); }
  }

  async function exportPDF() {
    if (!shots.length || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      for (const shot of shots) {
        const image = await pdf.embedJpg(shot.data);
        const width = 612; const height = width * shot.height / shot.width;
        pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
      }
      const bytes = await pdf.save();
      download(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "zine-scan.pdf");
    } catch { setError("Couldn’t export PDF. Your pages are still here; try again."); }
    finally { lock.current = false; setBusy(false); }
  }

  function move(index: number, direction: number) {
    setCollections(all => {
      const list = [...all[kind]]; const other = index + direction;
      if (other < 0 || other >= list.length) return all;
      [list[index], list[other]] = [list[other], list[index]];
      return { ...all, [kind]: list };
    });
  }

  return <section aria-label={kind === "pdf" ? "Zine pages" : "Pattern collection"}>
    {error && <p className={styles.notice} role="alert">{error}</p>}
    <div className={styles.toolbar}>
      <button className={styles.secondary} onClick={() => input.current?.click()} disabled={busy || shots.length >= 20}>Import</button>
      <button className={styles.primary} onClick={capture} disabled={!ready || busy || shots.length >= 20}>{kind === "pdf" ? "Capture page" : "Capture strip"}</button>
    </div>
    <input ref={input} type="file" accept="image/*" multiple hidden aria-label="Import scanner images" onChange={event => { void importPhotos(Array.from(event.target.files || [])); event.target.value = ""; }} />
    {shots.length > 0 && <details className={styles.review}>
      <summary>{shots.length} {kind === "pdf" ? (shots.length === 1 ? "page" : "pages") : (shots.length === 1 ? "pattern" : "patterns")} · Review</summary>
      <p className={styles.sessionNote}>Kept here until you leave. Export to save.</p>
      <ol>{shots.map((shot, index) => <li key={shot.id}>
        {/* Locally captured data URLs; no remote image loader needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.data} alt={`${kind === "pdf" ? "Page" : "Pattern"} ${index + 1}`} />
        <div className={styles.actions}>
          <span>{index + 1}</span>
          <button className={styles.secondary} disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move image ${index + 1} earlier`}>↑</button>
          <button className={styles.secondary} disabled={busy || index === shots.length - 1} onClick={() => move(index, 1)} aria-label={`Move image ${index + 1} later`}>↓</button>
          <button className={styles.secondary} disabled={busy} onClick={() => setCollections(all => ({ ...all, [kind]: all[kind].filter(item => item.id !== shot.id) }))}>Remove</button>
          {kind === "pattern" && <a className={styles.primary} href={shot.data} download={`pattern-${index + 1}.jpg`}>Save JPG</a>}
        </div>
      </li>)}</ol>
    </details>}
    {kind === "pdf" && shots.length > 0 && <button className={styles.primary} onClick={exportPDF} disabled={busy}>{busy ? "Working…" : `Export PDF (${shots.length})`}</button>}
    {shots.length === 20 && <p className={styles.sessionNote}>20-image limit. Remove an image to add another.</p>}
  </section>;
}
