"use client";

import { useState } from "react";
import MiniZineEditor from "./MiniZineEditor";
import FullZineEditor from "./FullZineEditor";

type Mode = "SELECT" | "MINI" | "FULL";

export default function CanvasView() {
  const [mode, setMode] = useState<Mode>("SELECT");

  if (mode === "MINI") return <MiniZineEditor onBack={() => setMode("SELECT")} />;
  if (mode === "FULL") return <FullZineEditor onBack={() => setMode("SELECT")} />;

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <h2 className="text-xl font-semibold mb-6">Pick a format to start creating</h2>
      <div className="flex gap-6">
        <button
          onClick={() => setMode("MINI")}
          className="px-6 py-4 rounded-xl border bg-white shadow hover:bg-gray-50"
        >
          Mini Zine
        </button>
        <button
          onClick={() => setMode("FULL")}
          className="px-6 py-4 rounded-xl border bg-white shadow hover:bg-gray-50"
        >
          Full Zine
        </button>
      </div>
    </div>
  );
}
