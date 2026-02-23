"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

const CATEGORIES = [
  { key: "flyer_design", label: "Flyer design" },
  { key: "zine_design", label: "Zine design" },
  { key: "logo_design", label: "Logo design" },
  { key: "carousel_post", label: "Carousel post (3–10 images)" },
  { key: "graphic_illustration", label: "Graphic illustration" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

type MarketMe = {
  approved: boolean;
  status?: "none" | "pending" | "approved" | "rejected";
  services: Array<{
    categoryKey: string;
    label: string;
    enabled: boolean;
    priceCents: number | null;
  }>;
};

type CreatorRow = { email: string | null; priceCents: number | null };

export default function MarketPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [section, setSection] = useState<"purchase" | "sell">("purchase");
  const [marketMe, setMarketMe] = useState<MarketMe | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [creatorsByCategory, setCreatorsByCategory] = useState<Record<string, CreatorRow[]>>({});
  const [creatorsLoading, setCreatorsLoading] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    setMeLoading(true);
    fetch("/api/market/me")
      .then((res) => res.json())
      .then((data) => setMarketMe(data))
      .catch(() => setMarketMe(null))
      .finally(() => setMeLoading(false));
  }, [isSignedIn]);

  useEffect(() => {
    if (section !== "purchase") return;
    setCreatorsLoading(true);
    const next: Record<string, CreatorRow[]> = {};
    const promises = CATEGORIES.map((c) =>
      fetch(`/api/market/categories/${c.key}/creators`)
        .then((res) => res.json())
        .then((data) => {
          next[c.key] = data.creators || [];
        })
    );
    Promise.all(promises).then(() => {
      setCreatorsByCategory(next);
      setCreatorsLoading(false);
    });
  }, [section]);

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
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
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

        <div className="mb-6 border-b border-gray-300">
          <div className="flex gap-6">
            <button
              onClick={() => setSection("purchase")}
              className={`pb-3 px-1 font-medium transition ${
                section === "purchase"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Purchase
            </button>
            <button
              onClick={() => setSection("sell")}
              className={`pb-3 px-1 font-medium transition ${
                section === "sell"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Sell
            </button>
          </div>
        </div>

        {section === "purchase" ? (
          <PurchaseSection
            categories={CATEGORIES}
            creatorsByCategory={creatorsByCategory}
            loading={creatorsLoading}
          />
        ) : meLoading ? (
          <div className="text-center py-12 text-gray-600">Loading…</div>
        ) : marketMe?.approved ? (
          <SellCreatorView
            services={marketMe.services}
            onSave={async (updates) => {
              const res = await fetch("/api/market/services", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ services: updates }),
              });
              if (res.ok) {
                const data = await fetch("/api/market/me").then((r) => r.json());
                setMarketMe(data);
              }
            }}
          />
        ) : marketMe?.status === "pending" ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl">
            <h2 className="text-xl font-semibold mb-2">Application pending</h2>
            <p className="text-gray-600">
              We’ve received your application to become a paid creator. We’ll review it and
              get back to you. Once approved, you can list your services and set prices here.
            </p>
          </div>
        ) : (
          <SellApplyForm
            onApplied={() => {
              setMeLoading(true);
              fetch("/api/market/me")
                .then((res) => res.json())
                .then((data) => setMarketMe(data))
                .catch(() => setMarketMe(null))
                .finally(() => setMeLoading(false));
            }}
          />
        )}
      </div>
    </div>
  );
}

function PurchaseSection({
  categories,
  creatorsByCategory,
  loading,
}: {
  categories: readonly { key: CategoryKey; label: string }[];
  creatorsByCategory: Record<string, CreatorRow[]>;
  loading: boolean;
}) {
  return (
    <div className="space-y-8">
      <p className="text-gray-600">
        Browse by category. Each row lists creators who sell that service.
      </p>
      <div className="flex flex-col gap-6">
        {categories.map((cat) => (
          <div key={cat.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 font-medium">
              {cat.label}
            </div>
            <div className="p-4">
              {loading ? (
                <div className="text-sm text-gray-500">Loading creators…</div>
              ) : (creatorsByCategory[cat.key]?.length ?? 0) === 0 ? (
                <div className="text-sm text-gray-500">
                  No creators offering this service yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {(creatorsByCategory[cat.key] || []).map((creator, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-sm text-gray-700">
                        {creator.email ?? "Creator"}
                      </span>
                      {creator.priceCents != null && (
                        <span className="text-sm font-medium">
                          ${(creator.priceCents / 100).toFixed(2)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SellApplyForm({ onApplied }: { onApplied: () => void }) {
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/market/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioUrl: portfolioUrl.trim() || undefined,
          bio: bio.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      onApplied();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl">
      <h2 className="text-xl font-semibold mb-2">Become a paid creator</h2>
      <p className="text-sm text-gray-600 mb-6">
        Fill out the form below and submit your application. Once we approve your
        account, you can list your services and set prices in the Sell section.
        Stripe payout setup can be added later when you’re ready to get paid.
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Portfolio or website (optional)
          </label>
          <input
            type="url"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="https://…"
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Short bio / what you offer
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[100px]"
            placeholder="e.g. Graphic designer, logos and flyers…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit application"}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            We’ll review your application and approve your account. After that you can
            add services and prices here.
          </p>
        </div>
      </form>
    </div>
  );
}

function SellCreatorView({
  services,
  onSave,
}: {
  services: MarketMe["services"];
  onSave: (services: Array<{ categoryKey: string; enabled: boolean; priceCents: number | null }>) => Promise<void>;
}) {
  const [local, setLocal] = useState(services);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(services);
  }, [services]);

  const handleToggle = (categoryKey: string, enabled: boolean) => {
    setLocal((prev) =>
      prev.map((s) =>
        s.categoryKey === categoryKey ? { ...s, enabled, priceCents: enabled ? s.priceCents : null } : s
      )
    );
  };

  const handlePrice = (categoryKey: string, value: string) => {
    const num = value === "" ? null : Math.round(parseFloat(value) * 100);
    setLocal((prev) =>
      prev.map((s) => (s.categoryKey === categoryKey ? { ...s, priceCents: num } : s))
    );
  };

  const save = async () => {
    setSaving(true);
    await onSave(
      local.map((s) => ({
        categoryKey: s.categoryKey,
        enabled: s.enabled,
        priceCents: s.priceCents,
      }))
    );
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl">
      <h2 className="text-xl font-semibold mb-2">Your services</h2>
      <p className="text-sm text-gray-600 mb-6">
        Turn each category on or off and set your price. You’ll appear in Purchase for
        that category when it’s on and priced.
      </p>
      <div className="space-y-4">
        {local.map((s) => (
          <div
            key={s.categoryKey}
            className="flex flex-wrap items-center gap-3 py-3 border-b border-gray-100 last:border-0"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) => handleToggle(s.categoryKey, e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium">{s.label}</span>
            </label>
            {s.enabled && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                  placeholder="0.00"
                  value={s.priceCents != null ? (s.priceCents / 100).toFixed(2) : ""}
                  onChange={(e) => handlePrice(s.categoryKey, e.target.value)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-6 rounded-lg bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
