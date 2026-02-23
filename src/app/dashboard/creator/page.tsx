"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

type CreatorOrder = {
  id: string;
  status: string;
  ship_to_address: string | null;
  created_at: string;
  updated_at?: string;
  shipping_cost?: number;
  payment_status?: string;
  distributor: {
    id: string;
    business_name: string;
    business_address: string;
    contact_name: string;
    contact_email: string;
  } | null;
  myItems: Array<{
    id: string;
    issue_id: string;
    quantity: number;
    issue: { id: string; title: string | null; slug: string | null };
  }>;
};

export default function CreatorPortalPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState<"zine-orders" | "ad-orders">("zine-orders");
  const [orders, setOrders] = useState<CreatorOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === "zine-orders") {
      setLoading(true);
      fetch("/api/creator/orders")
        .then((res) => res.ok ? res.json() : { orders: [] })
        .then((data) => {
          setOrders(data.orders || []);
        })
        .catch(() => setOrders([]))
        .finally(() => setLoading(false));
    }
  }, [activeTab]);

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
        Redirecting to sign in…
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
          <h1 className="text-3xl font-bold">Creator Portal</h1>
          <p className="text-gray-600 mt-1">
            Manage orders for your zines and ad bounties
          </p>
        </div>

        <div className="mb-6 border-b border-gray-300">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("zine-orders")}
              className={`pb-3 px-1 font-medium transition ${
                activeTab === "zine-orders"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Zine orders
            </button>
            <button
              onClick={() => setActiveTab("ad-orders")}
              className={`pb-3 px-1 font-medium transition ${
                activeTab === "ad-orders"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Ad orders
            </button>
          </div>
        </div>

        {activeTab === "zine-orders" ? (
          <ZineOrdersView orders={orders} loading={loading} />
        ) : (
          <AdOrdersView />
        )}
      </div>
    </div>
  );
}

function ZineOrdersView({
  orders,
  loading,
}: {
  orders: CreatorOrder[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="text-center py-12 text-gray-600">
        Loading orders…
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <div className="text-4xl mb-4">📦</div>
        <p className="text-gray-600">No orders for your zines yet</p>
        <p className="text-sm text-gray-500 mt-2">
          When distributors order copies of your print-for-me zines, they’ll show up here for you to fulfill.
        </p>
      </div>
    );
  }

  const statusStyles: Record<string, string> = {
    draft: "bg-amber-100 text-amber-700",
    placed: "bg-orange-100 text-orange-700",
    fulfilled: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const totalQty = order.myItems.reduce((s, i) => s + i.quantity, 0);
        const dist = order.distributor;
        return (
          <div
            key={order.id}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-gray-500">
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    statusStyles[order.status] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {order.status}
                </span>
                {order.payment_status === "paid" && (
                  <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                    Paid
                  </span>
                )}
              </div>
              {order.shipping_cost != null && (
                <span className="text-sm text-gray-600">
                  Shipping: ${Number(order.shipping_cost).toFixed(2)}
                </span>
              )}
            </div>

            {dist && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700">
                  {dist.business_name}
                </p>
                {order.ship_to_address && (
                  <p className="text-sm text-gray-600 mt-1">
                    Ship to: {order.ship_to_address}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Contact: {dist.contact_name} ({dist.contact_email})
                </p>
              </div>
            )}

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Your zines in this order ({totalQty} copies)
              </p>
              <ul className="space-y-2">
                {order.myItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">
                      {item.issue?.title || "Untitled"}
                    </span>
                    <span className="text-gray-600">×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>

            {(order.status === "placed" || order.status === "draft") && (
              <p className="text-xs text-gray-500 mt-4">
                Produce and ship these copies to the address above. Fulfillment tracking can be added later.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AdOrdersView() {
  return (
    <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
      <div className="text-4xl mb-4">🎨</div>
      <p className="text-gray-600">Ad orders</p>
      <p className="text-sm text-gray-500 mt-2">
        Manage your ad bounty orders and submissions here. This section is coming soon.
      </p>
    </div>
  );
}
