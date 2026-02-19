"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

type AnalyticsIssue = {
  id: string;
  title: string | null;
  slug: string | null;
  totalScans: number;
  links: { linkId: string; label: string | null; scans: number }[];
};

type RecentScan = {
  id: string;
  issue_id: string;
  link_id: string;
  issueTitle: string | null;
  linkLabel: string | null;
  scanned_at: string | null;
  user_agent: string | null;
};

function deviceLabel(ua: string | null): string {
  if (!ua) return "—";
  const s = ua.toLowerCase();
  if (s.includes("mobile") || s.includes("android") || s.includes("iphone")) return "Mobile";
  if (s.includes("tablet") || s.includes("ipad")) return "Tablet";
  return "Desktop";
}

type AnalyticsData = {
  totalScans: number;
  issues: AnalyticsIssue[];
  recentScans: RecentScan[];
};

export default function AnalyticsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchAnalytics() {
    try {
      setRefreshing(true);
      const res = await fetch("/api/analytics");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to load analytics");
        return;
      }
      setError(null);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.push("/sign-in");
      return;
    }
    fetchAnalytics();
  }, [isLoaded, user, router]);

  if (!isLoaded || loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p className="font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const issues = data?.issues ?? [];
  const recentScans = data?.recentScans ?? [];
  const totalScans = data?.totalScans ?? 0;
  const zinesWithQRCodes = issues.filter((i) => i.links.length > 0);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analytics</h1>
          <p className="text-gray-600">
            Scan activity for your zines. Each scan is recorded when someone hits a QR redirect (from your issue page, a printed QR, or anywhere).
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchAnalytics()}
          disabled={refreshing}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <div className="rounded-xl border-2 border-gray-200 bg-white p-6 text-gray-900">
          <div className="text-sm font-medium text-gray-700 uppercase tracking-wide">Total QR Scans</div>
          <div className="text-3xl font-bold mt-1 text-black">{totalScans}</div>
          <p className="text-sm text-gray-600 mt-1">Across all your zines and links</p>
        </div>
        <div className="rounded-xl border-2 border-gray-200 bg-white p-6 text-gray-900">
          <div className="text-sm font-medium text-gray-700 uppercase tracking-wide">Zines with QR Codes</div>
          <div className="text-3xl font-bold mt-1 text-black">{zinesWithQRCodes.length}</div>
          <p className="text-sm text-gray-600 mt-1">Of {issues.length} zine{issues.length !== 1 ? "s" : ""} in your library</p>
        </div>
      </div>

      {/* By issue */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">By issue</h2>
        {issues.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-600">
            <p>You don’t have any issues yet. Create a zine in ZineMat and add links with QR codes to start seeing scan data here.</p>
            <Link href="/zinemat" className="inline-block mt-4 text-blue-600 hover:underline font-medium">
              Go to ZineMat
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden"
              >
                <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100">
                  <div>
                    <h3 className="font-semibold text-lg">{issue.title || "(Untitled)"}</h3>
                    {issue.slug && (
                      <Link
                        href={`/issues/${issue.slug}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View issue →
                      </Link>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900">{issue.totalScans}</span>
                    <span className="text-sm text-gray-500 ml-1">scan{issue.totalScans !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                {issue.links.length > 0 && (
                  <div className="p-4 pt-0">
                    <div className="text-sm font-medium text-gray-500 mb-2">By link</div>
                    <ul className="space-y-1">
                      {issue.links.map((l) => (
                        <li key={l.linkId} className="flex justify-between text-sm">
                          <span>{l.label || "(no label)"}</span>
                          <span className="font-medium">{l.scans} scan{l.scans !== 1 ? "s" : ""}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent scans */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Recent scans</h2>
        {recentScans.length === 0 ? (
          <div className="rounded-xl border-2 border-gray-200 bg-white p-6 text-gray-500 text-center">
            No scans yet. When someone scans a QR code on your published issue page, it will show up here.
          </div>
        ) : (
          <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Issue</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Link</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">When</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{s.issueTitle ?? "—"}</td>
                      <td className="px-4 py-3 text-sm">{s.linkLabel ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.scanned_at
                          ? new Date(s.scanned_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{deviceLabel(s.user_agent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
