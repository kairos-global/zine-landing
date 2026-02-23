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

type CreatorRow = { marketCreatorId?: string; email: string | null; priceCents: number | null };
type CartItem = {
  marketCreatorId: string;
  categoryKey: string;
  categoryLabel: string;
  creatorEmail: string | null;
  priceCents: number;
};

export default function MarketPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [section, setSection] = useState<"purchase" | "sell">("purchase");
  const [marketMe, setMarketMe] = useState<MarketMe | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [creatorsByCategory, setCreatorsByCategory] = useState<Record<string, CreatorRow[]>>({});
  const [creatorsLoading, setCreatorsLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [purchasePanelTab, setPurchasePanelTab] = useState<"cart" | "history">("cart");
  const [marketOrders, setMarketOrders] = useState<Array<{ id: string; status: string; totalCents: number; createdAt: string; items?: unknown[] }>>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

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
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
            cart={cart}
            setCart={setCart}
            panelTab={purchasePanelTab}
            setPanelTab={setPurchasePanelTab}
            marketOrders={marketOrders}
            setMarketOrders={setMarketOrders}
            ordersLoading={ordersLoading}
            setOrdersLoading={setOrdersLoading}
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
  cart,
  setCart,
  panelTab,
  setPanelTab,
  marketOrders,
  setMarketOrders,
  ordersLoading,
  setOrdersLoading,
}: {
  categories: readonly { key: CategoryKey; label: string }[];
  creatorsByCategory: Record<string, CreatorRow[]>;
  loading: boolean;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  panelTab: "cart" | "history";
  setPanelTab: (t: "cart" | "history") => void;
  marketOrders: Array<{ id: string; status: string; totalCents: number; createdAt: string; items?: unknown[] }>;
  setMarketOrders: React.Dispatch<React.SetStateAction<typeof marketOrders>>;
  ordersLoading: boolean;
  setOrdersLoading: (v: boolean) => void;
}) {
  useEffect(() => {
    if (panelTab === "history") {
      setOrdersLoading(true);
      fetch("/api/market/orders")
        .then((res) => (res.ok ? res.json() : { orders: [] }))
        .then((data) => setMarketOrders(data.orders || []))
        .catch(() => setMarketOrders([]))
        .finally(() => setOrdersLoading(false));
    }
  }, [panelTab, setMarketOrders, setOrdersLoading]);

  const addToCart = (creator: CreatorRow, categoryKey: string, categoryLabel: string) => {
    const id = creator.marketCreatorId;
    const price = creator.priceCents;
    if (!id || price == null) return;
    setCart((prev) => [
      ...prev,
      { marketCreatorId: id, categoryKey, categoryLabel, creatorEmail: creator.email, priceCents: price },
    ]);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    const res = await fetch("/api/market/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((i) => ({ marketCreatorId: i.marketCreatorId, categoryKey: i.categoryKey, priceCents: i.priceCents })),
      }),
    });
    if (res.ok) {
      setCart([]);
      setPanelTab("history");
      const data = await fetch("/api/market/orders").then((r) => r.json());
      setMarketOrders(data.orders || []);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <p className="text-gray-600">
          Browse by category. Add services to your cart and place an order.
        </p>
        <div className="flex flex-col gap-4">
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
                        key={creator.marketCreatorId ?? i}
                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-sm text-gray-700">
                          {creator.email ?? "Creator"}
                        </span>
                        <div className="flex items-center gap-3">
                          {creator.priceCents != null && (
                            <span className="text-sm font-medium">
                              ${(creator.priceCents / 100).toFixed(2)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => addToCart(creator, cat.key, cat.label)}
                            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Add to cart
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-6">
          <div className="border-b border-gray-200 flex">
            <button
              type="button"
              onClick={() => setPanelTab("cart")}
              className={`flex-1 py-3 px-4 text-sm font-medium transition ${
                panelTab === "cart"
                  ? "bg-gray-100 text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Cart
              {cart.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                  {cart.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPanelTab("history")}
              className={`flex-1 py-3 px-4 text-sm font-medium transition ${
                panelTab === "history"
                  ? "bg-gray-100 text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              History
            </button>
          </div>
          <div className="p-4 min-h-[200px]">
            {panelTab === "cart" ? (
              cart.length === 0 ? (
                <p className="text-gray-500 text-sm">Your cart is empty</p>
              ) : (
                <>
                  <ul className="space-y-2 mb-4">
                    {cart.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start justify-between gap-2 text-sm border-b border-gray-100 pb-2"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.categoryLabel}</p>
                          <p className="text-gray-500 truncate">{item.creatorEmail ?? "Creator"}</p>
                          <p className="text-gray-600">${(item.priceCents / 100).toFixed(2)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(idx)}
                          className="text-red-600 hover:underline shrink-0"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-gray-600 mb-2">
                    Total: ${(cart.reduce((s, i) => s + i.priceCents, 0) / 100).toFixed(2)}
                  </p>
                  <button
                    type="button"
                    onClick={placeOrder}
                    className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm"
                  >
                    Place order
                  </button>
                </>
              )
            ) : ordersLoading ? (
              <p className="text-gray-500 text-sm">Loading orders…</p>
            ) : marketOrders.length === 0 ? (
              <p className="text-gray-500 text-sm">No orders yet. Place an order from the cart.</p>
            ) : (
              <ul className="space-y-3">
                {marketOrders.map((order) => (
                  <li key={order.id} className="text-sm border-b border-gray-100 pb-3">
                    <p className="font-medium">
                      {new Date(order.createdAt).toLocaleDateString()} — {order.status}
                    </p>
                    <p className="text-gray-600">${(order.totalCents / 100).toFixed(2)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
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

const MIN_PRICE = 25;
const MAX_PRICE = 200;
const PRICE_STEP = 5;

function SellCreatorView({
  services,
  onSave,
}: {
  services: MarketMe["services"];
  onSave: (services: Array<{ categoryKey: string; enabled: boolean; priceCents: number | null }>) => Promise<void>;
}) {
  const [local, setLocal] = useState(services);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Record<string, { total: number; accepted: number; declined: number; completed: number }>>({});

  useEffect(() => {
    setLocal(services);
  }, [services]);

  useEffect(() => {
    fetch("/api/market/me/stats")
      .then((res) => (res.ok ? res.json() : { byCategory: {} }))
      .then((data: { byCategory?: Record<string, { total: number; accepted: number; declined: number; completed: number }> }) => setStats(data.byCategory ?? {}))
      .catch(() => setStats({}));
  }, [services]);

  const handleToggle = (categoryKey: string, enabled: boolean) => {
    setLocal((prev) =>
      prev.map((s) =>
        s.categoryKey === categoryKey ? { ...s, enabled, priceCents: enabled ? (s.priceCents ?? 2500) : null } : s
      )
    );
  };

  const handlePrice = (categoryKey: string, value: string) => {
    if (value === "") {
      setLocal((prev) => prev.map((s) => (s.categoryKey === categoryKey ? { ...s, priceCents: null } : s)));
      return;
    }
    const dollars = parseFloat(value);
    if (isNaN(dollars)) return;
    const clamped = Math.max(MIN_PRICE, Math.min(MAX_PRICE, Math.round(dollars / PRICE_STEP) * PRICE_STEP));
    const cents = clamped * 100;
    setLocal((prev) => prev.map((s) => (s.categoryKey === categoryKey ? { ...s, priceCents: cents } : s)));
  };

  const incrementPrice = (categoryKey: string) => {
    setLocal((prev) =>
      prev.map((s) => {
        if (s.categoryKey !== categoryKey || s.priceCents == null) return s;
        const next = Math.min(MAX_PRICE * 100, s.priceCents + PRICE_STEP * 100);
        return { ...s, priceCents: next };
      })
    );
  };

  const decrementPrice = (categoryKey: string) => {
    setLocal((prev) =>
      prev.map((s) => {
        if (s.categoryKey !== categoryKey || s.priceCents == null) return s;
        const next = Math.max(MIN_PRICE * 100, s.priceCents - PRICE_STEP * 100);
        return { ...s, priceCents: next };
      })
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-5xl">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/80">
        <h2 className="text-xl font-semibold">Your services</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          Turn each category on or off and set your price ($25–$200). You’ll appear in Purchase when it’s on and priced.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 w-12">On</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Service</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Price</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">History</th>
            </tr>
          </thead>
          <tbody>
            {local.map((s) => {
              const h = stats[s.categoryKey] ?? { total: 0, accepted: 0, declined: 0, completed: 0 };
              return (
                <tr key={s.categoryKey} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-3 px-4 align-middle">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={s.enabled}
                      onClick={() => handleToggle(s.categoryKey, !s.enabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        s.enabled ? "bg-blue-500 border-blue-500" : "bg-gray-200 border-gray-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                          s.enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">{s.label}</td>
                  <td className="py-3 px-4">
                    {s.enabled ? (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          min={MIN_PRICE}
                          max={MAX_PRICE}
                          step={PRICE_STEP}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          value={s.priceCents != null ? (s.priceCents / 100).toFixed(0) : ""}
                          onChange={(e) => handlePrice(s.categoryKey, e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => incrementPrice(s.categoryKey)}
                          className="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-medium"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => decrementPrice(s.categoryKey)}
                          className="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-medium"
                        >
                          −
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs text-gray-600">
                      <p className="font-medium text-gray-700 mb-1">History</p>
                      <p>Orders: {h.total}</p>
                      <p>Accepted: {h.accepted}</p>
                      <p>Declined: {h.declined}</p>
                      <p>Completed: {h.completed}</p>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
