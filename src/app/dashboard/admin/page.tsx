"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/useAdmin";

type Stats = {
  totalUsers: number;
  totalIssues: number;
  totalDistributors: number;
  pendingDistributors: number;
  approvedDistributors: number;
  totalQRScans: number;
  totalPaidCreators: number;
  pendingPaidCreators: number;
  approvedPaidCreators: number;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { isAdmin: userIsAdmin, loading: adminLoading } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminLoading && !userIsAdmin) {
      router.push("/dashboard");
    }
  }, [adminLoading, userIsAdmin, router]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Error fetching admin stats:", err);
      } finally {
        setLoading(false);
      }
    }
    if (userIsAdmin) fetchStats();
  }, [userIsAdmin]);

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Loading...
      </div>
    );
  }

  if (!userIsAdmin) return null;

  const pendingDist = stats?.pendingDistributors ?? 0;
  const pendingCreators = stats?.pendingPaidCreators ?? 0;

  return (
    <div className="min-h-screen bg-[#F0EBCC] text-black">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-black mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Admin</h1>
        </div>

        {/* ── Top 3 platform stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Total Users</div>
            <div className="text-4xl font-bold">{stats?.totalUsers ?? 0}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Published Issues</div>
            <div className="text-4xl font-bold">{stats?.totalIssues ?? 0}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">QR Code Scans</div>
            <div className="text-4xl font-bold">{stats?.totalQRScans ?? 0}</div>
          </div>
        </div>

        {/* ── Split stat cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {/* Distributors */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex">
            <div
              className={`flex-1 p-5 border-r border-gray-100 ${
                pendingDist > 0 ? "bg-amber-50" : ""
              }`}
            >
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Distributors — Pending
              </div>
              <div
                className={`text-4xl font-bold ${
                  pendingDist > 0 ? "text-amber-600" : "text-gray-300"
                }`}
              >
                {pendingDist}
              </div>
            </div>
            <div className="flex-1 p-5">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Distributors — Total
              </div>
              <div className="text-4xl font-bold">{stats?.totalDistributors ?? 0}</div>
            </div>
          </div>

          {/* Paid Creators */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex">
            <div
              className={`flex-1 p-5 border-r border-gray-100 ${
                pendingCreators > 0 ? "bg-amber-50" : ""
              }`}
            >
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Paid Creators — Pending
              </div>
              <div
                className={`text-4xl font-bold ${
                  pendingCreators > 0 ? "text-amber-600" : "text-gray-300"
                }`}
              >
                {pendingCreators}
              </div>
            </div>
            <div className="flex-1 p-5">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Paid Creators — Total
              </div>
              <div className="text-4xl font-bold">{stats?.totalPaidCreators ?? 0}</div>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <h2 className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-4">
            Quick Actions
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

            {/* Manage Distributors */}
            <Link
              href="/dashboard/admin/distributors"
              className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:border-[#D16FF2] hover:shadow-md transition-all"
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-[#D16FF2] opacity-0 group-hover:opacity-100 transition-opacity"
              />
              <div className="text-base font-semibold mb-1 group-hover:text-[#D16FF2] transition-colors">
                Manage Distributors
              </div>
              <div className="text-sm text-gray-500">Review and approve distributor applications</div>
              {pendingDist > 0 && (
                <div className="mt-3 inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                  {pendingDist} pending
                </div>
              )}
            </Link>

            {/* Fulfil Orders */}
            <Link
              href="/dashboard/admin/orders"
              className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:border-[#D16FF2] hover:shadow-md transition-all"
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-[#D16FF2] opacity-0 group-hover:opacity-100 transition-opacity"
              />
              <div className="text-base font-semibold mb-1 group-hover:text-[#D16FF2] transition-colors">
                Fulfil Distributor Orders
              </div>
              <div className="text-sm text-gray-500">Review payments and ship zine orders</div>
            </Link>

            {/* Manage Paid Creators */}
            <Link
              href="/dashboard/admin/paid-creators"
              className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:border-[#65CBF1] hover:shadow-md transition-all"
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-[#65CBF1] opacity-0 group-hover:opacity-100 transition-opacity"
              />
              <div className="text-base font-semibold mb-1 group-hover:text-[#0EA5E9] transition-colors">
                Manage Paid Creators
              </div>
              <div className="text-sm text-gray-500">Approve or reject paid creator applications</div>
              {pendingCreators > 0 && (
                <div className="mt-3 inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                  {pendingCreators} pending
                </div>
              )}
            </Link>

            {/* Manage Users — coming soon */}
            <div className="relative bg-white border border-gray-100 rounded-xl p-5 opacity-50 cursor-not-allowed select-none">
              <div className="text-base font-semibold mb-1 text-gray-400">Manage Users</div>
              <div className="text-sm text-gray-400">View and manage user accounts</div>
              <div className="mt-3 inline-block px-2 py-0.5 bg-gray-100 text-gray-400 text-xs font-medium rounded">
                Coming soon
              </div>
            </div>

            {/* Content Moderation — coming soon */}
            <div className="relative bg-white border border-gray-100 rounded-xl p-5 opacity-50 cursor-not-allowed select-none">
              <div className="text-base font-semibold mb-1 text-gray-400">Content Moderation</div>
              <div className="text-sm text-gray-400">Review and manage published issues</div>
              <div className="mt-3 inline-block px-2 py-0.5 bg-gray-100 text-gray-400 text-xs font-medium rounded">
                Coming soon
              </div>
            </div>

            {/* Platform Analytics — coming soon */}
            <div className="relative bg-white border border-gray-100 rounded-xl p-5 opacity-50 cursor-not-allowed select-none">
              <div className="text-base font-semibold mb-1 text-gray-400">Platform Analytics</div>
              <div className="text-sm text-gray-400">Detailed platform insights and reports</div>
              <div className="mt-3 inline-block px-2 py-0.5 bg-gray-100 text-gray-400 text-xs font-medium rounded">
                Coming soon
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
