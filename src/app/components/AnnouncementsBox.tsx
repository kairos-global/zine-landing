"use client";

import { useLayoutEffect, useRef, useState } from "react";

export default function AnnouncementsBox() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const textRef = useRef<HTMLDivElement | null>(null);
    const [fontSizePx, setFontSizePx] = useState<number>(48);

    useLayoutEffect(() => {
      const fitText = () => {
        const container = containerRef.current;
        const textEl = textRef.current;
        if (!container || !textEl) return;

        // Establish bounds for binary search
        let min = 24; // minimum readable size
        // Dynamic upper cap based on container height; allow very large text on wide screens
        const containerStyles = window.getComputedStyle(container);
        const containerPadY = parseFloat(containerStyles.paddingTop) + parseFloat(containerStyles.paddingBottom);
        const containerPadX = parseFloat(containerStyles.paddingLeft) + parseFloat(containerStyles.paddingRight);
        const containerAvailHeight = Math.max(0, container.clientHeight - containerPadY);
        const containerAvailWidth = Math.max(0, container.clientWidth - containerPadX);
        let max = Math.min(220, Math.floor(containerAvailHeight * 0.9));
        let best = min;

        // Ensure wrapping for measurement
        textEl.style.whiteSpace = "pre-wrap";
        textEl.style.wordBreak = "break-word";
        textEl.style.overflow = "hidden";
        textEl.style.lineHeight = "1.15";

        // Binary search for largest font size that fits
        while (min <= max) {
          const mid = Math.floor((min + max) / 2);
          textEl.style.fontSize = `${mid}px`;

          // Force layout by reading measurements
          const styles = window.getComputedStyle(textEl);
          const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
          const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
          const availableWidth = Math.max(0, containerAvailWidth - padX - 2);
          const availableHeight = Math.max(0, containerAvailHeight - padY - 2);

          const fitsWidth = textEl.scrollWidth <= availableWidth;
          const fitsHeight = textEl.scrollHeight <= availableHeight;

          if (fitsWidth && fitsHeight) {
            best = mid;
            min = mid + 1;
          } else {
            max = mid - 1;
          }
        }

        setFontSizePx(best);
      };

      fitText();

      const ro = new ResizeObserver(() => fitText());
      if (containerRef.current) ro.observe(containerRef.current);

      // Observe text content changes as well
      const mo = new MutationObserver(() => fitText());
      if (textRef.current) mo.observe(textRef.current, { childList: true, characterData: true, subtree: true });

      return () => {
        ro.disconnect();
        mo.disconnect();
      };
    }, []);

    return (
      <div
        ref={containerRef}
        className="w-[clamp(180px,90vw,350px)] h-[120px] sm:h-[140px] bg-[#4a4a4a] text-white rounded-4xl border-[3px] border-[#bb86fc] outline outline-[4px] outline-black grid place-items-center text-center mx-auto overflow-hidden"
      >
        <div
          ref={textRef}
          style={{ fontSize: `${fontSizePx}px` }}
          className="font-medium px-4 text-center"
        >
          Sign up to use the Zinemat!
        </div>
      </div>
    );
  }  
