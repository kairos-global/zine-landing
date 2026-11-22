"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { openZinePdf, renderPdfPage } from "@/lib/zine-pdf";
import { mapFromPdfUrl, miniPanel } from "@/lib/zine-view-map";

const MINI_LABELS = ["Front Cover", "Page 1", "Page 2", "Page 3", "Page 4", "Page 5", "Page 6", "Back Cover"];

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
  const viewMap = mapFromPdfUrl(pdfUrl) ?? (zineFormat === "mini" ? "mini-center" : "pages");
  const isMini = viewMap !== "pages";

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);           // virtual page count
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCache, setPageCache] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [flipping, setFlipping] = useState<"forward" | "backward" | null>(null);
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const miniSheet = useRef<Promise<HTMLCanvasElement> | null>(null);
  const requestedPages = useRef(new Set<number>());

  useEffect(() => {
    let active = true;
    let task: Awaited<ReturnType<typeof openZinePdf>> | undefined;
    setLoading(true);
    setError(null);
    setPdf(null);
    setPageCache(new Map());
    setCurrentPage(1);
    miniSheet.current = null;
    requestedPages.current = new Set();
    void (async () => {
      try {
        task = await openZinePdf(pdfUrl);
        if (!active) {
          await task.destroy();
          return;
        }
        const doc = await task.promise;
        if (!active) return;
        setPdf(doc);
        setNumPages(isMini ? 8 : doc.numPages);
      } catch {
        if (active) setError("Could not load PDF.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (task) void task.destroy().catch(() => {});
    };
  }, [pdfUrl, isMini]);

  const renderVirtualPage = useCallback(async (page: number) => {
    if (!pdf) return "";
    try {
      if (viewMap === "pages") return (await renderPdfPage(pdf, page)).canvas.toDataURL("image/jpeg", 0.92);
      miniSheet.current ??= renderPdfPage(pdf, 1, 2200).then(result => result.canvas);
      return miniPanel(await miniSheet.current, viewMap, page).toDataURL("image/jpeg", 0.93);
    } catch {
      return "";
    }
  }, [pdf, viewMap]);

  // ── Pre-render current + neighbours ──────────────────────────────────────
  useEffect(() => {
    if (!pdf) return;
    const needed = [currentPage - 1, currentPage, currentPage + 1, currentPage + 2]
      .filter((p) => p >= 1 && p <= numPages);

    const requests = requestedPages.current;
    for (const page of needed) {
      if (requests.has(page)) continue;
      requests.add(page);
      void renderVirtualPage(page).then(url => {
        if (requests !== requestedPages.current) return;
        if (url) setPageCache(cache => new Map(cache).set(page, url));
        else requests.delete(page);
      });
    }
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
      }, 420);
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
  const pageLabel   = isMini ? MINI_LABELS[currentPage - 1] ?? "" : "";

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading && !error) {
    return (
      <>
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

          {/* Page stage — slide reveal, no 3D */}
          <div className="relative flex-1 max-w-sm overflow-hidden rounded-sm">
            {/* Depth shadow */}
            <div className="absolute inset-0 rounded shadow-[0_24px_80px_rgba(0,0,0,0.85)] pointer-events-none z-10" />

            {/* Incoming page — sits underneath, revealed as current page slides off */}
            {flipping && (
              <div className="absolute inset-0 z-0">
                {pendingImg
                  ? <PageImg src={pendingImg} alt="Next page" />
                  : <PageSkeleton isMini={isMini} />}
              </div>
            )}

            {/* Current page — slides off left (forward) or right (backward) */}
            <div
              className="relative z-[1]"
              style={{
                transform:
                  flipping === "forward"   ? "translateX(-105%)"
                  : flipping === "backward" ? "translateX(105%)"
                  : "translateX(0)",
                transition: flipping
                  ? "transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)"
                  : "none",
              }}
            >
              {currentImg
                ? <PageImg src={currentImg} alt={isMini ? pageLabel : `Page ${currentPage}`} />
                : <PageSkeleton isMini={isMini} />}
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
                    aria-label={`Go to ${isMini ? MINI_LABELS[i] : `page ${pg}`}`}
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
