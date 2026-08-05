"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InteractivityView } from "./interactivity";

export default function Tabs() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function createCanvas() {
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/canvas", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create canvas");
      router.push(`/canvas?id=${data.issueId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create canvas");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 rounded-2xl border-2 border-black bg-[#AAEEFF] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[.2em]">Zineground canvas</p>
          <h2 className="text-2xl font-bold">Build an 8-page mini zine</h2>
          <p className="mt-2 max-w-xl text-sm">Choose images, frame every page, set the color, then add type across the complete sheet.</p>
          {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
        </div>
        <button onClick={createCanvas} disabled={creating} className="shrink-0 rounded-xl border-2 border-black bg-[#FFEA69] px-6 py-3 font-bold shadow-[4px_4px_0_#000] transition hover:-translate-y-0.5 disabled:opacity-60">
          {creating ? "Creating file…" : "+ New Canvas"}
        </button>
      </section>
      <div>
        <div className="mb-4 border-b-2 border-black pb-3">
          <h2 className="text-lg font-bold">Upload & file settings</h2>
          <p className="text-sm text-gray-600">Manage an existing PDF zine and its interactive links.</p>
        </div>
        <InteractivityView />
      </div>
    </div>
  );
}
