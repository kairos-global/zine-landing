"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ZineCanvas from "../zinemat/components/canvas/ZineCanvas";

function CanvasPage() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) return <main className="mx-auto max-w-xl p-12 text-center"><h1 className="text-2xl font-bold">No canvas selected</h1><a className="mt-4 inline-block underline" href="/zinemat">Create one in ZineMat</a></main>;
  return <ZineCanvas issueId={id} />;
}

export default function Page() {
  return <Suspense fallback={<div className="p-12 text-center">Opening canvas…</div>}><CanvasPage /></Suspense>;
}
