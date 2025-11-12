"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { BountySummary } from "@/types/bounties";

const TABS = [
  { key: "board", label: "Bounty Board" },
  { key: "myBounties", label: "My Bounties" },
  { key: "mySubmissions", label: "My Submissions" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (err) {
    console.warn("[AdBounties] Failed to format currency", err);
    return `$${amount}`;
  }
}

function BountyCard({ bounty }: { bounty: BountySummary }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm uppercase tracking-wide text-gray-500">
            Reward
          </div>
          <div className="text-xl font-semibold">
            {formatCurrency(bounty.rewardAmount, bounty.currency)}
          </div>
        </div>
        <span
          className="rounded-full text-xs px-3 py-1 bg-slate-900 text-white"
        >
          {bounty.status.toUpperCase()}
        </span>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-1">{bounty.title}</h3>
        {bounty.brief ? (
          <p className="text-sm text-gray-600 line-clamp-3">{bounty.brief}</p>
        ) : (
          <p className="text-sm text-gray-500 italic">
            No creative brief provided yet.
          </p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between text-sm text-gray-500">
        <span>
          {bounty.deadline
            ? `Deadline: ${new Date(bounty.deadline).toLocaleDateString()}`
            : "Rolling submissions"}
        </span>
        <Link
          href={`/dashboard/ad-bounties/${bounty.id}`}
          className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-black hover:text-white transition"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}

export default function AdBountiesDashboard() {
  const [tab, setTab] = useState<TabKey>("board");
  const [loading, setLoading] = useState(true);
  const [bounties, setBounties] = useState<BountySummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/bounties");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load bounties");
        setBounties(data.bounties ?? []);
        setError(null);
      } catch (err) {
        console.error("[AdBounties] Failed to fetch bounties", err);
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const openBounties = useMemo(
    () => bounties.filter((b) => b.status === "open" || b.status === "selecting"),
    [bounties]
  );

  return (
    <div className="relative min-h-screen text-black">
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ backgroundColor: "#F4F1FF" }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid lg:grid-cols-[360px,1fr] gap-6">
          {/* Static info column */}
          <aside className="space-y-6">
            <div className="rounded-3xl border bg-white shadow-inner p-6 space-y-5">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold">Advertising Bounties</h1>
                <p className="text-sm text-gray-600">
                  Launch a design bounty, receive curated submissions, and reward
                  the winning artist once you lock your selection. Artists can
                  showcase their work and earn payouts directly on Zineground.
                </p>
              </div>
              <div className="space-y-3">
                <button className="w-full rounded-xl bg-black text-white py-2 text-sm font-medium hover:bg-gray-800 transition">
                  Launch a Bounty
                </button>
                <button className="w-full rounded-xl border border-black py-2 text-sm font-medium hover:bg-black hover:text-white transition">
                  Become a Bounty Artist
                </button>
              </div>
              <div className="rounded-2xl bg-slate-900 text-slate-50 p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  How it works
                </div>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Fund your bounty in advance.</li>
                  <li>Review watermarked submissions securely.</li>
                  <li>Rank entries and confirm your winner.</li>
                  <li>Unlock the high-res file and payout instantly.</li>
                </ol>
              </div>
            </div>

            <div className="rounded-3xl border bg-white shadow-inner p-5 space-y-3">
              <h2 className="text-lg font-semibold">Your account</h2>
              <p className="text-sm text-gray-600">
                Stripe onboarding and payout status will appear here once you
                connect your artist account.
              </p>
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900"
              >
                Manage payment settings →
              </Link>
            </div>
          </aside>

          {/* Scrollable content column */}
          <section className="rounded-3xl border bg-white/90 backdrop-blur p-6 flex flex-col h-[70vh]">
            <div className="flex items-center gap-2">
              {TABS.map(({ key, label }) => {
                const isActive = key === tab;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition border ${
                      isActive
                        ? "bg-black text-white border-black"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex-1 bg-white rounded-2xl border p-5 overflow-hidden">
              {tab === "board" && (
                <div className="flex flex-col h-full">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Open bounties</h2>
                      <p className="text-sm text-gray-500">
                        Browse live opportunities and submit your best work.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="search"
                        placeholder="Search bounties"
                        className="rounded-xl border px-3 py-2 text-sm"
                      />
                      <button className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                        Filters
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex-1 overflow-y-auto pr-1">
                    {loading ? (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        Loading bounties…
                      </div>
                    ) : error ? (
                      <div className="h-full flex items-center justify-center text-red-500 text-sm text-center">
                        {error}
                      </div>
                    ) : openBounties.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-500 text-sm text-center">
                        No live bounties yet. Check back soon or launch the first one!
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 pb-4">
                        {openBounties.map((bounty) => (
                          <BountyCard key={bounty.id} bounty={bounty} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "myBounties" && (
                <div className="h-full flex items-center justify-center text-sm text-gray-500 text-center">
                  Bounty management tools coming soon. You&apos;ll be able to review
                  submissions, rank artists, and confirm your winner here.
                </div>
              )}

              {tab === "mySubmissions" && (
                <div className="h-full flex items-center justify-center text-sm text-gray-500 text-center px-8">
                  Track the status of every submission you send. Stripe onboarding
                  and payout history will appear once the feature is fully live.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
