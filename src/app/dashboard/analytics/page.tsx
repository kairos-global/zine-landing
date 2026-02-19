"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

type AnalyticsIssue = {
  id: string;
  title: string | null;
  slug: string | null;
  cover_img_url: string | null;
  totalScans: number;
  links: { linkId: string; label: string | null; url: string | null; scans: number }[];
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

function lastScannedAt(recentScans: RecentScan[], issueId: string, linkId: string): string | null {
  const scan = recentScans.find((s) => s.issue_id === issueId && s.link_id === linkId);
  return scan?.scanned_at ?? null;
}

function scanTierDots(scans: number): number {
  if (scans === 0) return 0;
  if (scans <= 3) return 1;
  if (scans <= 10) return 2;
  if (scans <= 25) return 3;
  return 4;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
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

      {/* Pokedex: swipable zine issue cards */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-black mb-3">Your zines</h2>
        <p className="text-gray-600 text-sm mb-4">Swipe or scroll to see each zine and its QR codes.</p>
        {issues.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-8 text-center text-gray-700">
            <p>No zines yet. Create one in ZineMat and add links with QR codes to see them here.</p>
            <Link href="/zinemat" className="inline-block mt-4 text-amber-700 hover:underline font-medium">
              Go to ZineMat
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto snap-x snap-mandatory flex gap-4 pb-2 -mx-1">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="flex-shrink-0 w-[min(100%,340px)] snap-center rounded-2xl border-2 border-amber-200/80 bg-white shadow-lg overflow-hidden"
              >
                <div className="relative aspect-[3/4] max-h-48 bg-gradient-to-b from-slate-100 to-slate-200">
                  {issue.cover_img_url ? (
                    <img
                      src={issue.cover_img_url}
                      alt={issue.title || "Zine cover"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-5xl">📄</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <h3 className="font-bold text-lg drop-shadow">{issue.title || "Untitled"}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-semibold text-black mt-1">
                      📊 {issue.totalScans} scan{issue.totalScans !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {issue.slug && (
                    <Link
                      href={`/issues/${issue.slug}`}
                      className="block w-full text-center rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold py-2.5 text-sm mb-4 transition"
                    >
                      View issue
                    </Link>
                  )}
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">QR codes & links</div>
                  {issue.links.length === 0 ? (
                    <p className="text-sm text-slate-500">No QR links yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {issue.links.map((l) => {
                        const lastAt = lastScannedAt(recentScans, issue.id, l.linkId);
                        const dots = scanTierDots(l.scans);
                        const host = l.url ? (() => { try { return new URL(l.url!).hostname; } catch { return l.url; } })() : "—";
                        return (
                          <li key={l.linkId} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                            <div className="flex items-start gap-2">
                              <div className="flex gap-0.5 mt-0.5">
                                {[1, 2, 3, 4].map((i) => (
                                  <span
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full ${i <= dots ? "bg-amber-500" : "bg-slate-300"}`}
                                    aria-hidden
                                  />
                                ))}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-black truncate">{l.label || "Link"}</div>
                                <a href={l.url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-700 hover:underline truncate block">
                                  {host}
                                </a>
                                <div className="text-xs text-slate-500 mt-1">
                                  {l.scans} scan{l.scans !== 1 ? "s" : ""}
                                  {lastAt ? ` · Last ${timeAgo(lastAt)}` : ""}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent scans */}
      <section>
        <h2 className="text-xl font-semibold text-black mb-3">Recent scans</h2>
        {recentScans.length === 0 ? (
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-slate-500 text-center text-sm">
            Scans will appear here when someone uses a QR code from your zines.
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-black">Zine</th>
                    <th className="px-4 py-2.5 font-semibold text-black">Link</th>
                    <th className="px-4 py-2.5 font-semibold text-black">When</th>
                    <th className="px-4 py-2.5 font-semibold text-black">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 text-black">{s.issueTitle ?? "—"}</td>
                      <td className="px-4 py-2 text-black">{s.linkLabel ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {s.scanned_at ? timeAgo(s.scanned_at) : "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{deviceLabel(s.user_agent)}</td>
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
