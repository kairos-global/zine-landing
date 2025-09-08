// src/app/dashboard/page.tsx
"use client";

import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <SignOutButton redirectUrl="/">
          <button className="rounded-md border border-black bg-white px-3 py-2 text-sm">
            Sign out
          </button>
        </SignOutButton>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/zinemat" className="rounded-xl border p-4 bg-white hover:bg-black/5">
          <div className="text-lg font-semibold">Make a Zine</div>
          <div className="text-sm text-gray-600">Open ZineMat</div>
        </Link>

        <Link href="/dashboard/library" className="rounded-xl border p-4 bg-white hover:bg-black/5">
          <div className="text-lg font-semibold">My Library</div>
          <div className="text-sm text-gray-600">
            Drafts & published (we’ll scope to your account once issues have a user_id)
          </div>
        </Link>

        <Link href="/dashboard/analytics" className="rounded-xl border p-4 bg-white hover:bg-black/5">
          <div className="text-lg font-semibold">Analytics</div>
          <div className="text-sm text-gray-600">Coming soon</div>
        </Link>
      </div>
    </div>
  );
}
