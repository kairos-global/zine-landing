"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ZineIcon from "@/components/ZineIcon";

const poster = "/store/mini-zine-display.webp";
const description = "Mini Zine Display, rendered from its 3D model";

export default function DisplayPreview() {
  const video = useRef<HTMLVideoElement>(null);
  const [pausedByUser, setPausedByUser] = useState<boolean>();
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const media = video.current;
    if (!media) return;

    // WebKit uses HEVC alpha. Chromium and Firefox use VP9 alpha.
    const applePlayback = navigator.vendor === "Apple Computer, Inc."
      && media.canPlayType('video/mp4; codecs="hvc1"');
    media.src = applePlayback
      ? "/store/mini-zine-display-alpha.mov"
      : "/store/mini-zine-display-alpha.webm";
  }, []);

  useEffect(() => {
    const media = video.current;
    if (!media) return;

    let visible = false;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      if (visible && !(pausedByUser ?? motion.matches)) {
        void media.play().catch(() => {});
      } else {
        media.pause();
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    });
    observer.observe(media);
    motion.addEventListener("change", syncPlayback);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", syncPlayback);
    };
  }, [pausedByUser, unavailable]);

  function togglePlayback() {
    const media = video.current;
    if (!media) return;
    setPausedByUser(!media.paused);
    if (media.paused) {
      void media.play().catch(() => {});
    } else {
      media.pause();
    }
  }

  return (
    <div className="relative grid min-h-[270px] place-items-center overflow-hidden bg-[#e7d2f8] sm:min-h-[340px]">
      {unavailable ? (
        <Image src={poster} alt={description} width={480} height={480} className="aspect-square w-full max-w-[380px] object-contain" />
      ) : (
        <>
          <video
            ref={video}
            poster={poster}
            aria-label={description}
            className="aspect-square w-full max-w-[380px] object-contain"
            preload="none"
            muted
            loop
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setUnavailable(true)}
          />
          <button type="button" className="zg-button absolute right-3 bottom-3 size-11" aria-label={playing ? "Pause rotation" : "Play rotation"} onClick={togglePlayback}>
            <ZineIcon name={playing ? "pause" : "play"} />
          </button>
        </>
      )}
    </div>
  );
}
