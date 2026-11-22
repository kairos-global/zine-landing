"use client";

import { useSearchParams } from "next/navigation";
import InteractivityView from "./interactivity/InteractivityView";

export default function Tabs() {
  const params = useSearchParams();
  const mode = params.get("mode");
  return <InteractivityView key={mode ?? "default"} editId={params.get("id")} initialMode={mode === "create" ? "create" : "upload"} />;
}
