"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Script from "next/script";
import Link from "next/link";

// PDF.js loaded from CDN — no npm install needed
const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfjsLib: any;
  }
}

interface FlipViewerProps {
  pdfUrl: string;
  title: string;
  slug: string;
  zineFormat?: "mini" | "full";
}

export default function FlipViewer({
  pdfUrl,
  title,
  slug,
  zineFormat = "full",
}: FlipViewerProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCache, setPageCache] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [flipping, setFlipping] = useState<"forward" | "backward" | null>(null);
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Once PDF.js script is loaded, open the document
  useEffect(() => {
    if (!scriptLoaded || !pdfUrl) return;
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;

    lib
      .getDocument({ url: pdfUrl, withCredentials: false })
      .promise.then((doc: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        setPdf(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(`Could not load PDF: ${err.message}`);
        setLoading(false);
      });
  }, [scriptLoaded, pdfUrl]);

  // Render a single PDF page to a JPEG data-URL
  const renderPage = useCallback(
    async (pageNum: number): Promise<string> => {
      if (!pdf) return "";
      try {
        const page = await pdf.getPage(pageNum);
        // Scale to ~1.5× for sharpness; clamp width to ~900px on large screens
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, 900 / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL("image/jpeg", 0.92);
      } catch {
        return "";
      }
    },
    [pdf]
  );

  // Pre-render current page and neighbours eagerly
  useEffect(() => {
    if (!pdf) return;
    const needed = [currentPage - 1, currentPage, currentPage + 1, currentPage + 2].filter(
      (p) => p >= 1 && p <= numPages
    );
    needed.forEach((pageNum) => {
      setPageCache((prev) => {
        if (prev.has(pageNum)) return prev;
        // Kick off async render; update cache when done
        renderPage(pageNum).then((dataUrl) => {
          if (dataUrl) {
            setPageCache((c) => {
              if (c.has(pageNum)) return c;
              const next = new Map(c);
              next.set(pageNum, dataUrl);
              return next;
            });
          }
        });
        return prev; // optimistic no-change while rendering
      });
    });
  }, [pdf, currentPage, numPages, renderPage]);

  // Navigate with flip animation
  const navigateTo = useCallback(
    (page: number, direction: "forward" | "backward") => {
      if (page < 1 || page > numPages || flipping) return;
      setPendingPage(page);
      setFlipping(direction);
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = setTimeout(() => {
        setCurrentPage(page);
        setFlipping(null);
        setPendingPage(null);
      }, 480);
    },
    [numPages, flipping]
  );

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        navigateTo(currentPage + 1, "forward");
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        navigateTo(currentPage - 1, "backward");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPage, navigateTo]);

  // Swipe support
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) navigateTo(currentPage + 1, "forward");
      else navigateTo(currentPage - 1, "backward");
    }
    touchStartX.current = null;
  };

  const currentImg = pageCache.get(currentPage) ?? "";
  const pendingImg = pendingPage ? (pageCache.get(pendingPage) ?? "") : "";

  // ── Loading / error states ──────────────────────────────────────────────
  if (loading && !error) {
    return (
      <>
        <Script
          src={`${PDFJS_CDN}/pdf.min.js`}
          strategy="afterInteractive"
          onLoad={() => setScriptLoaded(true)}
          onError={() => setError("Failed to load PDF viewer library.")}
        />
        <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white gap-4">
          <svg
            className="animate-spin h-10 w-10 text-white/60"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
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

  // ── Main viewer ─────────────────────────────────────────────────────────
  return (
    <>
      {/* PDF.js script — loads once, triggers document open via onLoad */}
      <Script
        src={`${PDFJS_CDN}/pdf.min.js`}
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        onError={() => setError("Failed to load PDF viewer library.")}
      />

      <div
        className="flex min-h-screen flex-col bg-black select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* ── Top bar ── */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <Link
            href={`/issues/${slug}`}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
          >
            <span aria-hidden>←</span> {title}
          </Link>
          <div className="flex items-center gap-3">
            {zineFormat === "mini" && (
              <span className="text-xs rounded-full border border-white/20 px-2 py-0.5 text-white/40">
                mini zine
              </span>
            )}
            <span className="text-sm text-white/40 tabular-nums">
              {currentPage} / {numPages}
            </span>
          </div>
        </header>

        {/* ── Flip stage ── */}
        <main className="flex flex-1 items-center justify-center px-4 py-8 gap-4">
          {/* Prev button */}
          <button
            aria-label="Previous page"
            onClick={() => navigateTo(currentPage - 1, "backward")}
            disabled={currentPage <= 1 || !!flipping}
            className="flex-shrink-0 w-10 h-10 rounded-full border border-white/15 text-white/60 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition-colors"
          >
            ←
          </button>

          {/* Flip card */}
          <div
            className="relative flex-1 max-w-lg"
            style={{ perspective: "1400px" }}
          >
            {/* Shadow / book-edge effect */}
            <div className="absolute inset-0 rounded shadow-[0_20px_80px_rgba(0,0,0,0.9)] pointer-events-none" />

            <div
              style={{
                transformStyle: "preserve-3d",
                transform:
                  flipping === "forward"
                    ? "rotateY(-180deg)"
                    : flipping === "backward"
                    ? "rotateY(180deg)"
                    : "rotateY(0deg)",
                transition: flipping
                  ? "transform 0.48s cubic-bezier(0.645, 0.045, 0.355, 1.000)"
                  : "none",
              }}
            >
              {/* Front face — current page */}
              <div style={{ backfaceVisibility: "hidden" }}>
                {currentImg ? (
                  <img
                    src={currentImg}
                    alt={`Page ${currentPage} of ${title}`}
                    className="w-full h-auto rounded-sm block"
                    draggable={false}
                  />
                ) : (
                  <PageSkeleton />
                )}
              </div>

              {/* Back face — target page (revealed when flip completes) */}
              <div
                className="absolute inset-0"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                {pendingImg ? (
                  <img
                    src={pendingImg}
                    alt={`Page ${pendingPage} of ${title}`}
                    className="w-full h-auto rounded-sm block"
                    draggable={false}
                  />
                ) : (
                  <PageSkeleton />
                )}
              </div>
            </div>
          </div>

          {/* Next button */}
          <button
            aria-label="Next page"
            onClick={() => navigateTo(currentPage + 1, "forward")}
            disabled={currentPage >= numPages || !!flipping}
            className="flex-shrink-0 w-10 h-10 rounded-full border border-white/15 text-white/60 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition-colors"
          >
            →
          </button>
        </main>

        {/* ── Page dots (≤ 20 pages) or progress bar ── */}
        <footer className="flex justify-center items-center gap-2 pb-6 px-4">
          {numPages <= 20 ? (
            <div className="flex gap-1.5 flex-wrap justify-center">
              {Array.from({ length: numPages }, (_, i) => {
                const pg = i + 1;
                return (
                  <button
                    key={pg}
                    aria-label={`Go to page ${pg}`}
                    onClick={() =>
                      navigateTo(pg, pg > currentPage ? "forward" : "backward")
                    }
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

function PageSkeleton() {
  return (
    <div className="w-full aspect-[8.5/11] bg-neutral-800 rounded-sm flex items-center justify-center">
      <svg
        className="animate-spin h-6 w-6 text-white/20"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  );
}
