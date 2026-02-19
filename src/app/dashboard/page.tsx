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
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>

        <SignOutButton redirectUrl="/">
          <button className="rounded-md border border-black bg-white px-3 py-2 text-sm">
            Sign out
          </button>
        </SignOutButton>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/zinemat"
          className="rounded-xl p-4 bg-white hover:bg-black transition group"
        >
          <div className="text-lg font-semibold text-black group-hover:text-white">
            Make a Zine
          </div>
          <div className="text-sm text-gray-600 group-hover:text-gray-200">
            Open ZineMat
          </div>
        </Link>

        <Link
          href="/dashboard/library"
          className="rounded-xl p-4 bg-white hover:bg-black transition group"
        >
          <div className="text-lg font-semibold text-black group-hover:text-white">
            My Library
          </div>
          <div className="text-sm text-gray-600 group-hover:text-gray-200">
            Drafts & published (we’ll scope to your account once issues have a
            user_id)
          </div>
        </Link>

        <Link
          href="/dashboard/analytics"
          className="rounded-xl p-4 bg-white hover:bg-black transition group"
        >
          <div className="text-lg font-semibold text-black group-hover:text-white">
            Analytics
          </div>
          <div className="text-sm text-gray-600 group-hover:text-gray-200">
            QR scan tracking by issue
          </div>
        </Link>

        <Link
          href="/dashboard/distributor"
          className="rounded-xl p-4 bg-white hover:bg-black transition group"
        >
          <div className="text-lg font-semibold text-black group-hover:text-white">
            Distributor Portal
          </div>
          <div className="text-sm text-gray-600 group-hover:text-gray-200">
            Register as a distributor, manage stock, and place orders
          </div>
        </Link>

        <Link
          href="/dashboard/ad-bounties"
          className="rounded-xl p-4 bg-white hover:bg-black transition group"
        >
          <div className="text-lg font-semibold text-black group-hover:text-white">
            Ad Bounties
          </div>
          <div className="text-sm text-gray-600 group-hover:text-gray-200">
            Browse live creative briefs or launch a new advertising bounty
          </div>
        </Link>

        {/* Admin Dashboard - only visible to admins */}
        {userIsAdmin && (
          <Link
            href="/dashboard/admin"
            className="rounded-xl p-4 bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 transition group"
          >
            <div className="text-lg font-semibold text-white">
              Admin Dashboard
            </div>
            <div className="text-sm text-purple-100">
              Manage distributors, users, and platform settings
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
