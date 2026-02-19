"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { ScanBarChart } from "./ScanBarChart";

type ScanCountByDay = { date: string; count: number }[];

type AnalyticsIssue = {
  id: string;
  title: string | null;
  slug: string | null;
  cover_img_url: string | null;
  totalScans: number;
  scanCountByDay: ScanCountByDay;
  links: { linkId: string; label: string | null; url: string | null; scans: number }[];
};

type QrCodeAnalytics = {
  linkId: string;
  label: string | null;
  url: string | null;
  qr_path: string | null;
  issueId: string;
  issueTitle: string | null;
  issueSlug: string | null;
  scans: number;
  scanCountByDay: ScanCountByDay;
};

type AnalyticsData = {
  totalScans: number;
  issues: AnalyticsIssue[];
  qrCodes: QrCodeAnalytics[];
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
    } catch (_e) {
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
  const qrCodes = data?.qrCodes ?? [];
  const totalScans = data?.totalScans ?? 0;
  const zinesWithQRCodes = issues.filter((i) => i.links.length > 0);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analytics</h1>
          <p className="text-gray-600">
            QR Scan activity for your zines. Print zines, share your digital issue, or paste your QR&apos;s anywhere in the world and track their scans here. 
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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Your zines</h2>
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">Swipe or scroll to see each zine and its total scan traffic.</p>
        {issues.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-8 text-center text-gray-700">
            <p>No zines yet. Create one in the ZineMat and add links with QR codes to see them here.</p>
            <Link href="/zinemat" className="inline-block mt-4 text-amber-700 hover:underline font-medium">
              Go to ZineMat
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto snap-x snap-mandatory flex gap-4 pb-2 -mx-1">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="flex-shrink-0 w-[min(100%,420px)] snap-center rounded-2xl border-2 border-amber-200/80 bg-white shadow-lg overflow-hidden"
              >
                {/* Cover and chart side by side */}
                <div className="flex gap-0 overflow-hidden">
                  <div className="relative w-[45%] min-h-[180px] bg-gradient-to-b from-slate-100 to-slate-200 rounded-tl-2xl overflow-hidden">
                    {issue.cover_img_url ? (
                      <img
                        src={issue.cover_img_url}
                        alt={issue.title || "Zine cover"}
                        className="w-full h-full min-h-[180px] object-cover"
                      />
                    ) : (
                      <div className="w-full h-full min-h-[180px] flex items-center justify-center text-slate-400 text-sm">No cover</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                      <h3 className="font-bold text-base drop-shadow">{issue.title || "Untitled"}</h3>
                      <span className="inline-flex items-center rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-semibold text-black mt-1">
                        {issue.totalScans} scan{issue.totalScans !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 p-2 flex flex-col justify-center rounded-tr-2xl bg-slate-50/50">
                    <ScanBarChart
                      data={issue.scanCountByDay ?? []}
                      title="Total QR visits"
                      height={120}
                      totalScans={issue.totalScans}
                    />
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
                    <ul className="space-y-2">
                      {issue.links.map((l) => {
                        const host = l.url ? (() => { try { return new URL(l.url!).hostname; } catch { return l.url; } })() : "—";
                        return (
                          <li key={l.linkId} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                            <div className="font-semibold text-black truncate">{l.label || "Link"}</div>
                            <a href={l.url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-500 hover:text-orange-600 hover:underline truncate block">
                              {host}
                            </a>
                            <div className="text-xs text-slate-500 mt-0.5">{l.scans} scan{l.scans !== 1 ? "s" : ""}</div>
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

      {/* Your QR Codes — one card per QR with its scan chart */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Your QR codes</h2>
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">Each QR has its own scan history, link, originating zine, and visits over time.</p>
        {qrCodes.length === 0 ? (
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-slate-500 text-center text-sm">
            Add links with QR codes in the ZineMat to see them here.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {qrCodes.map((qr) => {
              const host = qr.url ? (() => { try { return new URL(qr.url).hostname; } catch { return qr.url; } })() : "—";
              return (
                <div
                  key={qr.linkId}
                  className="rounded-2xl border-2 border-slate-200 bg-white shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  {/* QR PNG and chart side by side (same layout as Your Zines) */}
                  <div className="flex gap-0">
                    <div className="w-[45%] min-h-[140px] bg-slate-100 flex items-center justify-center rounded-tl-2xl overflow-hidden p-2">
                      {qr.qr_path ? (
                        <img
                          src={qr.qr_path}
                          alt={qr.label || "QR code"}
                          className="max-w-full max-h-[130px] w-auto h-auto object-contain rounded-lg"
                        />
                      ) : (
                        <div className="text-slate-400 text-xs text-center">No QR image</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 p-2 flex flex-col justify-center rounded-tr-2xl bg-slate-50/50">
                      <ScanBarChart
                        data={qr.scanCountByDay ?? []}
                        title="Visits over time"
                        height={100}
                        totalScans={qr.scans}
                      />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="font-semibold text-black truncate">{qr.label || "Link"}</div>
                    <a
                      href={qr.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-orange-500 hover:text-orange-600 hover:underline truncate block"
                    >
                      {host}
                    </a>
                    <div className="text-xs text-slate-500 mt-1">
                      From zine: {qr.issueSlug ? (
                        <Link href={`/issues/${qr.issueSlug}`} className="text-orange-500 hover:text-orange-600 hover:underline">
                          {qr.issueTitle ?? qr.issueSlug}
                        </Link>
                      ) : (
                        qr.issueTitle ?? "—"
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {qr.scans} total visit{qr.scans !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
