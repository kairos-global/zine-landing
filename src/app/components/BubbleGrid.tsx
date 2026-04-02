"use client";

import { useAuth } from "@clerk/nextjs";
import Bubble from "./Bubble";

const BubbleGrid = () => {
  const { isLoaded } = useAuth();

  const bubbles = [
    { label: "Map", color: "F26565", href: "/map" },
    { label: "Upload Zine", color: "65CBF1", href: "/zinemat", forceRedirectUrl: "/zinemat" },
    { label: "About", color: "FFFFFF", href: "/about" },
    { label: "Market", color: "82E385", href: "/dashboard/market", forceRedirectUrl: "/dashboard/market" },
    { label: "My Library", color: "F2DC6F", href: "/dashboard/library", forceRedirectUrl: "/dashboard/library" },
    { label: "Distribute", color: "D16FF2", href: "/dashboard/distributor", forceRedirectUrl: "/dashboard/distributor" },
    { label: "Browse Zines", color: "A4A4A4", href: "/browse-zines" },
  ];

  // Returns animation style for a row. delayMs=0 → bottom row (first in), higher → later.
  const rowStyle = (delayMs: number): React.CSSProperties =>
    isLoaded
      ? { animation: `bubbleFadeIn 0.5s ease forwards`, animationDelay: `${delayMs}ms`, opacity: 0 }
      : { opacity: 0 };

  return (
    <>
      <style>{`
        @keyframes bubbleFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section className="relative w-full z-10">
        {/* Mobile: 5-row pattern from your sketch */}
        <div className="md:hidden flex flex-col gap-5 px-4 py-6">
          {/* Row 1 (top): Map | About — last to appear */}
          <div className="grid grid-cols-2 gap-4 place-items-center" style={rowStyle(400)}>
            <div className="justify-self-start">
              <Bubble {...bubbles[0]} /> {/* Map */}
            </div>
            <div className="justify-self-end">
              <Bubble {...bubbles[2]} /> {/* About */}
            </div>
          </div>

          {/* Row 2: Browse Zines */}
          <div className="flex justify-center" style={rowStyle(300)}>
            <Bubble {...bubbles[6]} /> {/* Browse Zines */}
          </div>

          {/* Row 3: Upload Zine | Market */}
          <div className="grid grid-cols-2 gap-4 place-items-center" style={rowStyle(200)}>
            <div className="justify-self-start">
              <Bubble {...bubbles[1]} /> {/* Upload Zine */}
            </div>
            <div className="justify-self-end">
              <Bubble {...bubbles[3]} /> {/* Market */}
            </div>
          </div>

          {/* Row 4: Distribute */}
          <div className="flex justify-center" style={rowStyle(100)}>
            <Bubble {...bubbles[5]} /> {/* Distribute */}
          </div>

          {/* Row 5 (bottom): My Library — first to appear */}
          <div className="flex justify-center" style={rowStyle(0)}>
            <Bubble {...bubbles[4]} /> {/* My Library */}
          </div>
        </div>

        {/* Desktop: absolute hex layout */}
        <div className="hidden md:block relative w-full h-[500px]">
          {/* Bottom row (top-[400px]) — first to appear, delay 0ms */}
          <div className="absolute top-[400px] left-[300px]" style={rowStyle(0)}>
            <Bubble {...bubbles[4]} /> {/* My Library */}
          </div>
          <div className="absolute top-[400px] left-[550px]" style={rowStyle(0)}>
            <Bubble {...bubbles[5]} /> {/* Distribute */}
          </div>

          {/* Middle row (top-[200px]) — delay 200ms */}
          <div className="absolute top-[200px] left-[175px]" style={rowStyle(200)}>
            <Bubble {...bubbles[1]} /> {/* Upload Zine */}
          </div>
          <div className="absolute top-[200px] left-[425px]" style={rowStyle(200)}>
            <Bubble {...bubbles[6]} /> {/* Browse Zines */}
          </div>
          <div className="absolute top-[200px] left-[675px]" style={rowStyle(200)}>
            <Bubble {...bubbles[3]} /> {/* Market */}
          </div>

          {/* Top row (top-[0px]) — last to appear, delay 400ms */}
          <div className="absolute top-[0px] left-[300px]" style={rowStyle(400)}>
            <Bubble {...bubbles[0]} /> {/* Map */}
          </div>
          <div className="absolute top-[0px] left-[550px]" style={rowStyle(400)}>
            <Bubble {...bubbles[2]} /> {/* About */}
          </div>
        </div>
      </section>
    </>
  );
};

export default BubbleGrid;
