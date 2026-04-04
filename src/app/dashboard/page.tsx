"use client";

import Link from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/useAdmin";

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const { isAdmin: userIsAdmin } = useAdmin();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Loading...
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Redirecting to sign in...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-black">Dashboard</h1>

        <SignOutButton redirectUrl="/">
          <button className="rounded-md border border-black bg-black text-white px-4 py-2 text-sm font-medium hover:bg-white hover:text-black transition-colors cursor-pointer">
            Sign out
          </button>
        </SignOutButton>
      </div>

      {/* Cards grid */}
      <div className="grid sm:grid-cols-2 gap-4">

        <Link
          href="/zinemat"
          className="rounded-xl p-5 bg-white border border-gray-200 shadow-sm hover:bg-black hover:border-black transition-colors group"
        >
          <div className="text-lg font-semibold text-black group-hover:text-white">
            Make a Zine
          </div>
          <div className="text-sm text-gray-500 mt-1 group-hover:text-gray-300">
            Open ZineMat and build your zine from scratch.
          </div>
        </Link>

        <Link
          href="/dashboard/library"
          className="rounded-xl p-5 bg-white border border-gray-200 shadow-sm hover:bg-black hover:border-black transition-colors group"
        >
          <div className="text-lg font-semibold text-black group-hover:text-white">
            My Library
          </div>
          <div className="text-sm text-gray-500 mt-1 group-hover:text-gray-300">
            Your saved drafts and published issues in one place.
          </div>
        </Link>

        <Link
          href="/dashboard/analytics"
          className="rounded-xl p-5 bg-white border border-gray-200 shadow-sm hover:bg-black hover:border-black transition-colors group"
        >
          <div className="text-lg font-semibold text-black group-hover:text-white">
            Analytics
          </div>
          <div className="text-sm text-gray-500 mt-1 group-hover:text-gray-300">
            Track QR scans and reader engagement across your published issues.
          </div>
        </Link>

        <Link
          href="/dashboard/distributor"
          className="rounded-xl p-5 bg-white border border-gray-200 shadow-sm hover:bg-black hover:border-black transition-colors group"
        >
          <div className="text-lg font-semibold text-black group-hover:text-white">
            Distributor Portal
          </div>
          <div className="text-sm text-gray-500 mt-1 group-hover:text-gray-300">
            Apply to become a Zineground distributor and manage your stock locations.
          </div>
        </Link>

        <Link
          href="/dashboard/creator"
          className="rounded-xl p-5 bg-white border border-gray-200 shadow-sm hover:bg-black hover:border-black transition-colors group"
        >
          <div className="text-lg font-semibold text-black group-hover:text-white">
            Creator Portal
          </div>
          <div className="text-sm text-gray-500 mt-1 group-hover:text-gray-300">
            Manage print orders and fulfillment for your published zines.
          </div>
        </Link>

        <Link
          href="/dashboard/market"
          className="rounded-xl p-5 bg-white border border-gray-200 shadow-sm hover:bg-black hover:border-black transition-colors group"
        >
          <div className="text-lg font-semibold text-black group-hover:text-white">
            Market
          </div>
          <div className="text-sm text-gray-500 mt-1 group-hover:text-gray-300">
            Buy and sell design services within the Zineground community.
          </div>
        </Link>

        {/* Admin Dashboard — only visible to admins */}
        {userIsAdmin && (
          <Link
            href="/dashboard/admin"
            className="rounded-xl p-5 bg-gradient-to-br from-purple-500 to-purple-700 border border-purple-400 shadow-sm hover:from-purple-600 hover:to-purple-800 transition-colors group"
          >
            <div className="text-lg font-semibold text-white">
              Admin Dashboard
            </div>
            <div className="text-sm text-purple-100 mt-1">
              Manage distributors and oversee platform operations.
            </div>
          </Link>
        )}

      </div>
    </div>
  );
}
