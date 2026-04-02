"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Script from "next/script";
import Link from "next/link";

// ─── PDF.js via CDN (no npm install needed) ────────────────────────────────
const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { pdfjsLib: any; }
}

// ─── Mini-zine panel map ────────────────────────────────────────────────────
// Physical layout on a letter sheet (4 cols × 2 rows):
//   Row 0 (top, UPSIDE DOWN):  [Pg6] [Pg5] [Pg4] [Pg3]
//   Row 1 (bottom, right-up):  [Back][Front][Pg1] [Pg2]
//
// Reading order → virtual page index 1-8:
const MINI_PANELS = [
  { row: 1, col: 1, rotate: 0,   label: "Front Cover" },
  { row: 1, col: 2, rotate: 0,   label: "Page 1"      },
  { row: 1, col: 3, rotate: 0,   label: "Page 2"      },
  { row: 0, col: 3, rotate: 180, label: "Page 3"      },
  { row: 0, col: 2, rotate: 180, label: "Page 4"      },
  { row: 0, col: 1, rotate: 180, label: "Page 5"      },
  { row: 0, col: 0, rotate: 180, label: "Page 6"      },
  { row: 1, col: 0, rotate: 0,   label: "Back Cover"  },
] as const;

/** Crop one panel out of a full-sheet canvas and optionally rotate 180°. */
function extractPanel(
  src: HTMLCanvasElement,
  row: number,
  col: number,
  rotate: number
): string {
  const cw = Math.floor(src.width / 4);
  const ch = Math.floor(src.height / 2);
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  const ctx = out.getContext("2d")!;
  if (rotate === 180) {
    ctx.translate(cw, ch);
    ctx.rotate(Math.PI);
  }
  ctx.drawImage(src, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
  return out.toDataURL("image/jpeg", 0.93);
}

// ─── Props ─────────────────────────────────────────────────────────────────
interface FlipViewerProps {
  pdfUrl: string;
  title: string;
  slug: string;
  zineFormat?: "mini" | "half_letter";
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function FlipViewer({
  pdfUrl,
  title,
  slug,
  zineFormat = "half_letter",
}: FlipViewerProps) {
  const isMini = zineFormat === "mini";

  const [scriptLoaded, setScriptLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);           // virtual page count
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCache, setPageCache] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [flipping, setFlipping] = useState<"forward" | "backward" | null>(null);
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load PDF once script is ready ────────────────────────────────────────
  useEffect(() => {
    if (!scriptLoaded || !pdfUrl) return;
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;

    lib.getDocument({ url: pdfUrl, withCredentials: false }).promise
      .then(async (doc: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        setPdf(doc);
        // For mini: always 8 virtual pages; for half-letter: real page count
        setNumPages(isMini ? 8 : doc.numPages);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(`Could not load PDF: ${err.message}`);
        setLoading(false);
      });
  }, [scriptLoaded, pdfUrl, isMini]);

  // ── Render helpers ────────────────────────────────────────────────────────

  /** Render PDF page N to an off-screen canvas and return it. */
  const renderPdfPageToCanvas = useCallback(
    async (pageNum: number): Promise<HTMLCanvasElement | null> => {
      if (!pdf) return null;
      try {
        const page = await pdf.getPage(pageNum);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2.0, 1200 / base.width);   // high-res for mini cropping
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        return canvas;
      } catch {
        return null;
      }
    },
    [pdf]
  );

  /**
   * Produce a data-URL for virtual page `vp` (1-indexed).
   *  - Mini:       render the one PDF page → extract the right panel.
   *  - Half-letter: render PDF page vp directly.
   */
  const renderVirtualPage = useCallback(
    async (vp: number): Promise<string> => {
      if (!pdf) return "";
      if (isMini) {
        const panel = MINI_PANELS[vp - 1];
        if (!panel) return "";
        const canvas = await renderPdfPageToCanvas(1); // mini is always 1 PDF page
        if (!canvas) return "";
        return extractPanel(canvas, panel.row, panel.col, panel.rotate);
      } else {
        const canvas = await renderPdfPageToCanvas(vp);
        if (!canvas) return "";
        return canvas.toDataURL("image/jpeg", 0.92);
      }
    },
    [pdf, isMini, renderPdfPageToCanvas]
  );

  // ── Pre-render current + neighbours ──────────────────────────────────────
  useEffect(() => {
    if (!pdf) return;
    const needed = [currentPage - 1, currentPage, currentPage + 1, currentPage + 2]
      .filter((p) => p >= 1 && p <= numPages);

    needed.forEach((vp) => {
      setPageCache((prev) => {
        if (prev.has(vp)) return prev;
        renderVirtualPage(vp).then((url) => {
          if (!url) return;
          setPageCache((c) => {
            if (c.has(vp)) return c;
            const next = new Map(c);
            next.set(vp, url);
            return next;
          });
        });
        return prev;
      });
    });
  }, [pdf, currentPage, numPages, renderVirtualPage]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigateTo = useCallback(
    (page: number, dir: "forward" | "backward") => {
      if (page < 1 || page > numPages || flipping) return;
      setPendingPage(page);
      setFlipping(dir);
      if (flipTimeout.current) clearTimeout(flipTimeout.current);
      flipTimeout.current = setTimeout(() => {
        setCurrentPage(page);
        setFlipping(null);
        setPendingPage(null);
      }, 480);
    },
    [numPages, flipping]
  );

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        navigateTo(currentPage + 1, "forward");
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        navigateTo(currentPage - 1, "backward");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPage, navigateTo]);

  // Touch / swipe
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50)
      navigateTo(currentPage + (dx < 0 ? 1 : -1), dx < 0 ? "forward" : "backward");
    touchStartX.current = null;
  };

  // ── Derived display values ────────────────────────────────────────────────
  const currentImg  = pageCache.get(currentPage) ?? "";
  const pendingImg  = pendingPage ? (pageCache.get(pendingPage) ?? "") : "";
  const pageLabel   = isMini ? MINI_PANELS[currentPage - 1]?.label ?? "" : "";

  // ── Loading / error ───────────────────────────────────────────────────────
  const scriptTag = (
    <Script
      src={`${PDFJS_CDN}/pdf.min.js`}
      strategy="afterInteractive"
      onLoad={() => setScriptLoaded(true)}
      onError={() => setError("Failed to load PDF viewer.")}
    />
  );

  if (loading && !error) {
    return (
      <>
        {scriptTag}
        <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white gap-4">
          <Spinner />
          <p className="text-sm text-white/50">Loading {title}…</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <Link href={`/issues/${slug}`} className="text-sm underline opacity-60 hover:opacity-100">
          ← Back to issue
        </Link>
      </div>
    );
  }

  // ── Main viewer ───────────────────────────────────────────────────────────
  return (
    <>
      {scriptTag}
      <div
        className="flex min-h-screen flex-col bg-black select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <Link
            href={`/issues/${slug}`}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
          >
            ← {title}
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs rounded-full border border-white/20 px-2 py-0.5 text-white/40">
              {isMini ? "mini zine" : "half letter"}
            </span>
            <span className="text-sm text-white/40 tabular-nums">
              {currentPage} / {numPages}
            </span>
          </div>
        </header>

        {/* Page label for mini (Front Cover / Page N / Back Cover) */}
        {isMini && pageLabel && (
          <div className="text-center pt-4 text-xs font-medium tracking-widest uppercase text-white/30">
            {pageLabel}
          </div>
        )}

        {/* Flip stage */}
        <main className="flex flex-1 items-center justify-center px-4 py-6 gap-4">
          {/* Prev */}
          <NavBtn
            dir="prev"
            disabled={currentPage <= 1 || !!flipping}
            onClick={() => navigateTo(currentPage - 1, "backward")}
          />

          {/* Flip card */}
          <div className="relative flex-1 max-w-sm" style={{ perspective: "1400px" }}>
            {/* Depth shadow */}
            <div className="absolute inset-0 rounded shadow-[0_24px_80px_rgba(0,0,0,0.85)] pointer-events-none" />

            <div
              style={{
                transformStyle: "preserve-3d",
                transform:
                  flipping === "forward"   ? "rotateY(-180deg)"
                  : flipping === "backward" ? "rotateY(180deg)"
                  : "rotateY(0deg)",
                transition: flipping
                  ? "transform 0.48s cubic-bezier(0.645,0.045,0.355,1)"
                  : "none",
              }}
            >
              {/* Front — current page */}
              <div style={{ backfaceVisibility: "hidden" }}>
                {currentImg
                  ? <PageImg src={currentImg} alt={isMini ? pageLabel : `Page ${currentPage}`} />
                  : <PageSkeleton isMini={isMini} />}
              </div>

              {/* Back — target page (revealed mid-flip) */}
              <div
                className="absolute inset-0"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                {pendingImg
                  ? <PageImg src={pendingImg} alt="Next page" />
                  : <PageSkeleton isMini={isMini} />}
              </div>
            </div>
          </div>

          {/* Next */}
          <NavBtn
            dir="next"
            disabled={currentPage >= numPages || !!flipping}
            onClick={() => navigateTo(currentPage + 1, "forward")}
          />
        </main>

        {/* Page dots / progress */}
        <footer className="flex justify-center items-center gap-2 pb-6 px-4">
          {numPages <= 20 ? (
            <div className="flex gap-1.5 flex-wrap justify-center">
              {Array.from({ length: numPages }, (_, i) => {
                const pg = i + 1;
                return (
                  <button
                    key={pg}
                    aria-label={`Go to ${isMini ? MINI_PANELS[i]?.label : `page ${pg}`}`}
                    onClick={() => navigateTo(pg, pg > currentPage ? "forward" : "backward")}
                    className={`rounded-full transition-all duration-200 ${
                      pg === currentPage
                        ? "w-4 h-2 bg-white"
                        : "w-2 h-2 bg-white/25 hover:bg-white/50"
                    }`}
                  />
                );
              })}
            </div>
          ) : (
            <div className="w-48 h-1 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-white/70 rounded-full transition-all duration-300"
                style={{ width: `${(currentPage / numPages) * 100}%` }}
              />
            </div>
          )}
        </footer>
      </div>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PageImg({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-auto rounded-sm block"
      draggable={false}
    />
  );
}

function PageSkeleton({ isMini }: { isMini: boolean }) {
  // Mini panels are portrait ~2:5.5 ratio; half-letter is 8.5:5.5
  const aspect = isMini ? "aspect-[2/5.5]" : "aspect-[8.5/5.5]";
  return (
    <div className={`w-full ${aspect} bg-neutral-800 rounded-sm flex items-center justify-center`}>
      <Spinner small />
    </div>
  );
}

function NavBtn({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={dir === "prev" ? "Previous page" : "Next page"}
      onClick={onClick}
      disabled={disabled}
      className="flex-shrink-0 w-10 h-10 rounded-full border border-white/15 text-white/60
                 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition-colors"
    >
      {dir === "prev" ? "←" : "→"}
    </button>
  );
}

function Spinner({ small }: { small?: boolean }) {
  const size = small ? "h-5 w-5" : "h-10 w-10";
  return (
    <svg
      className={`animate-spin ${size} text-white/30`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
