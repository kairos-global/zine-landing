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
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { isAdmin: userIsAdmin, loading: adminLoading } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect non-admins (middleware should handle this, but double-check)
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

    if (userIsAdmin) {
      fetchStats();
    }
  }, [userIsAdmin]);

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Loading admin dashboard...
      </div>
    );
  }

  if (!userIsAdmin) {
    return null; // Will redirect
  }

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
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Manage distributors, users, and platform settings
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard
            title="Total Users"
            value={stats?.totalUsers || 0}
            icon="👥"
          />
          <StatCard
            title="Published Issues"
            value={stats?.totalIssues || 0}
            icon="📚"
          />
          <StatCard
            title="QR Code Scans"
            value={stats?.totalQRScans || 0}
            icon="📊"
          />
          <StatCard
            title="Pending Distributors"
            value={stats?.pendingDistributors || 0}
            icon="⏳"
            highlight={true}
          />
          <StatCard
            title="Approved Distributors"
            value={stats?.approvedDistributors || 0}
            icon="✅"
          />
          <StatCard
            title="Total Distributors"
            value={stats?.totalDistributors || 0}
            icon="🏪"
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/dashboard/admin/distributors"
              className="block p-6 rounded-xl bg-white border border-gray-200 hover:border-purple-500 hover:shadow-lg transition group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1 group-hover:text-purple-600">
                    Manage Distributors
                  </h3>
                  <p className="text-sm text-gray-600">
                    Approve or reject distributor applications
                  </p>
                  {stats && stats.pendingDistributors > 0 && (
                    <div className="mt-2 inline-block px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                      {stats.pendingDistributors} pending
                    </div>
                  )}
                </div>
                <span className="text-2xl">🏪</span>
              </div>
            </Link>

            <div className="block p-6 rounded-xl bg-gray-50 border border-gray-200 opacity-60 cursor-not-allowed">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Manage Users</h3>
                  <p className="text-sm text-gray-600">
                    View and manage user accounts
                  </p>
                  <div className="mt-2 inline-block px-2 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded">
                    Coming soon
                  </div>
                </div>
                <span className="text-2xl">👥</span>
              </div>
            </div>

            <div className="block p-6 rounded-xl bg-gray-50 border border-gray-200 opacity-60 cursor-not-allowed">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1">
                    Content Moderation
                  </h3>
                  <p className="text-sm text-gray-600">
                    Review and manage published issues
                  </p>
                  <div className="mt-2 inline-block px-2 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded">
                    Coming soon
                  </div>
                </div>
                <span className="text-2xl">📚</span>
              </div>
            </div>

            <div className="block p-6 rounded-xl bg-gray-50 border border-gray-200 opacity-60 cursor-not-allowed">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1">
                    Platform Analytics
                  </h3>
                  <p className="text-sm text-gray-600">
                    Detailed platform insights and reports
                  </p>
                  <div className="mt-2 inline-block px-2 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded">
                    Coming soon
                  </div>
                </div>
                <span className="text-2xl">📊</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  highlight = false,
}: {
  title: string;
  value: number | string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-6 rounded-xl border ${
        highlight
          ? "bg-orange-50 border-orange-300"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-600 mb-1">{title}</div>
          <div className="text-3xl font-bold">{value}</div>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

