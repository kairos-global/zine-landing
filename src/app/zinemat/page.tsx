"use client";

import { Suspense } from "react";
import { useUser } from "@clerk/nextjs";
import Tabs from "./components/Tabs";

export default function ZineMatPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-600">Loading…</div>}>
      <ZineMatPage />
    </Suspense>
  );
}

function ZineMatPage() {
  const { isSignedIn } = useUser();

  if (isSignedIn === false) {
    return <div className="flex items-center justify-center min-h-screen text-gray-700">Redirecting to sign in…</div>;
  }
  if (isSignedIn === undefined) {
    return <div className="flex items-center justify-center min-h-screen text-gray-600">Loading…</div>;
  }

  return (
    <div className="relative min-h-screen text-black">
      {/* Background grid */}
      <div
        className="hidden sm:block fixed inset-0 -z-10 pointer-events-none"
        style={{
          backgroundColor: "#E2E2E2",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px",
        }}
      />

      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page header */}
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">ZineMat</h1>
        </div>

        {/* 🔹 Tabs: Interactivity + Canvas */}
        <div className="rounded-2xl border shadow-inner overflow-hidden bg-white/80 backdrop-blur-[1px]">
          <div className="p-4 sm:p-5 space-y-4">
            <Tabs />
          </div>
        </div>
      </div>
    </div>
  );
}
