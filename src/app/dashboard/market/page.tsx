"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

export default function MarketPage() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Loading…
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-700">
        Sign in to view the Market.
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-black bg-[#E2E2E2]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-black mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Market</h1>
          <p className="text-gray-600 mt-1">
            Purchase design services from creators, or sell your own.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 py-24 px-6 flex flex-col items-center justify-center text-center">
          <h2 className="text-2xl font-bold text-gray-900">Coming soon</h2>
          <p className="text-gray-500 mt-2 max-w-md">
            The Market is being built. Soon you&apos;ll be able to purchase design
            services from creators, or sell your own.
          </p>
        </div>
      </div>
    </div>
  );
}
