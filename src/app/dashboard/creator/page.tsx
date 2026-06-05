"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import toast from "react-hot-toast";
import { PaidCreatorProfile, type MarketMeProfile } from "@/app/components/PaidCreatorProfile";

type ApprovalItem = {
  id: string;
  quantity: number;
  creator_approval_status: string;
  creator_reviewed_at: string | null;
  cost_dollars: number;
  is_paid: boolean;
  order: {
    id: string;
    status: string;
    created_at: string;
    distributor: {
      business_name: string;
      contact_name: string;
      contact_email: string;
    } | null;
  } | null;
  issue: { id: string; title: string | null } | null;
};

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

function CreatorPortalContent() {
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState<"zine-orders" | "market-orders" | "store-orders">("zine-orders");
  const [orders, setOrders] = useState<CreatorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketMe, setMarketMe] = useState<MarketMeProfile | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>([]);
  const [storeOrdersLoading, setStoreOrdersLoading] = useState(false);

  const fetchApprovals = useCallback(() => {
    setApprovalsLoading(true);
    fetch("/api/creator/order-approvals")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setApprovals(data.items || []))
      .catch(() => setApprovals([]))
      .finally(() => setApprovalsLoading(false));
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "market-orders") setActiveTab("market-orders");
  }, [searchParams]);

  // When creator returns from Stripe Checkout success, verify the payment
  // directly with Stripe — no webhook dependency.
  useEffect(() => {
    const payment = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");
    if (payment !== "success" || !sessionId) return;

    fetch("/api/payments/creator-checkout/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(() => fetchApprovals())
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "zine-orders") {
      setLoading(true);
      fetch("/api/creator/orders")
        .then((res) => res.ok ? res.json() : { orders: [] })
        .then((data) => setOrders(data.orders || []))
        .catch(() => setOrders([]))
        .finally(() => setLoading(false));
      fetchApprovals();
    }
  }, [activeTab, fetchApprovals]);

  useEffect(() => {
    if (activeTab === "market-orders") {
      fetch("/api/market/me")
        .then((res) => res.json())
        .then((data) => setMarketMe(data))
        .catch(() => setMarketMe(null));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "store-orders") {
      setStoreOrdersLoading(true);
      fetch("/api/store/my-orders")
        .then((res) => (res.ok ? res.json() : { orders: [] }))
        .then((data) => setStoreOrders(data.orders || []))
        .catch(() => setStoreOrders([]))
        .finally(() => setStoreOrdersLoading(false));
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
            Manage orders for your zines and market
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
              onClick={() => setActiveTab("market-orders")}
              className={`pb-3 px-1 font-medium transition ${
                activeTab === "market-orders"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Market orders
            </button>
            <button
              onClick={() => setActiveTab("store-orders")}
              className={`pb-3 px-1 font-medium transition ${
                activeTab === "store-orders"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Store orders
            </button>
          </div>
        </div>

        {activeTab === "zine-orders" && (
          <div className="space-y-8">
            <OrderApprovalsView
              items={approvals}
              loading={approvalsLoading}
              onRefresh={fetchApprovals}
            />
            <ZineOrdersView orders={orders} loading={loading} />
          </div>
        )}

        {activeTab === "market-orders" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="min-w-0">
              <MarketOrdersView />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[360px]">
              <h3 className="px-4 py-3 border-b border-gray-200 font-semibold text-gray-900">Paid Creator Profile</h3>
              <PaidCreatorProfile
                marketMe={marketMe}
                onUpdate={() => fetch("/api/market/me").then((r) => r.json()).then(setMarketMe)}
              />
            </div>
          </div>
        )}

        {activeTab === "store-orders" && (
          <StoreOrdersView orders={storeOrders} loading={storeOrdersLoading} />
        )}
      </div>
    </div>
  );
}

export default function CreatorPortalPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-600">Loading…</div>}>
      <CreatorPortalContent />
    </Suspense>
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

            {order.status === "placed" && (
              <p className="text-xs text-gray-500 mt-4">
                Produce and ship these copies to the address above. Fulfillment tracking can be added later.
              </p>
            )}
            {order.status === "draft" && (
              <p className="text-xs text-gray-400 mt-4">
                Distributor payment pending — this order is not yet confirmed.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ========== ORDER APPROVALS VIEW ==========
function OrderApprovalsView({
  items,
  loading,
  onRefresh,
}: {
  items: ApprovalItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState<string | null>(null);

  async function handleAction(itemId: string, action: "approve" | "reject") {
    setActionLoading(itemId + action);
    try {
      const res = await fetch("/api/creator/order-approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId: itemId, action }),
      });
      if (res.ok) {
        toast.success(action === "approve" ? "Order approved" : "Order rejected");
        onRefresh();
      } else {
        const err = await res.json();
        toast.error(err.error || "Action failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePay(itemId: string) {
    setPayLoading(itemId);
    try {
      const res = await fetch("/api/payments/creator-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId: itemId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to start payment");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setPayLoading(null);
    }
  }

  // Split into pending approvals vs awaiting payment
  const pending = items.filter((i) => i.creator_approval_status === "pending_approval");
  const awaitingPayment = items.filter(
    (i) =>
      (i.creator_approval_status === "auto_approved" ||
        i.creator_approval_status === "approved") &&
      !i.is_paid
  );

  if (loading) {
    return <div className="text-center py-6 text-gray-600 text-sm">Loading approvals...</div>;
  }

  if (pending.length === 0 && awaitingPayment.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Pending approvals */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-amber-700">
            Pending approval ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-amber-200 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.issue?.title || "Untitled"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {item.order?.distributor?.business_name || "Unknown distributor"} wants{" "}
                      <strong>{item.quantity} copies</strong>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Your cost if approved: ${item.cost_dollars.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actionLoading === item.id + "approve"}
                      onClick={() => handleAction(item.id, "approve")}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50"
                    >
                      {actionLoading === item.id + "approve" ? "..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === item.id + "reject"}
                      onClick={() => handleAction(item.id, "reject")}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 disabled:opacity-50"
                    >
                      {actionLoading === item.id + "reject" ? "..." : "Reject"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Awaiting payment */}
      {awaitingPayment.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-blue-700">
            Awaiting your payment ({awaitingPayment.length})
          </h2>
          <div className="space-y-3">
            {awaitingPayment.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-blue-200 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.issue?.title || "Untitled"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {item.order?.distributor?.business_name || "Distributor"} ordered{" "}
                      <strong>{item.quantity} copies</strong>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {item.creator_approval_status === "auto_approved"
                        ? "Auto-approved"
                        : "You approved this order"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={payLoading === item.id}
                    onClick={() => handlePay(item.id)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
                  >
                    {payLoading === item.id
                      ? "..."
                      : `Pay $${item.cost_dollars.toFixed(2)}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ========== STORE ORDERS TYPES + VIEW ==========

type StoreOrderItem = {
  id: string;
  product_name: string;
  price_cents: number;
  quantity: number;
};

type StoreOrder = {
  id: string;
  status: "pending" | "paid" | "fulfilled" | "cancelled";
  total_cents: number | null;
  shipping_name: string | null;
  shipping_address: Record<string, string> | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
  fulfillment_notes?: string | null;
  created_at: string;
  items: StoreOrderItem[];
};

function StoreOrdersView({ orders, loading }: { orders: StoreOrder[]; loading: boolean }) {
  if (loading) {
    return <div className="text-center py-12 text-gray-600">Loading store orders…</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-600">No store orders yet</p>
        <p className="text-sm text-gray-500 mt-2">
          Orders from the{" "}
          <a href="/products" className="text-blue-600 hover:underline">
            Store
          </a>{" "}
          will appear here.
        </p>
      </div>
    );
  }

  const statusStyles: Record<string, string> = {
    pending:   "bg-gray-100 text-gray-600",
    paid:      "bg-amber-100 text-amber-700",
    fulfilled: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-600",
  };

  function formatAddress(addr: Record<string, string> | null) {
    if (!addr) return null;
    return [addr.line1, addr.line2, `${addr.city ?? ""} ${addr.state ?? ""} ${addr.postal_code ?? ""}`.trim(), addr.country]
      .filter(Boolean)
      .join(", ");
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-500">
                {new Date(order.created_at).toLocaleDateString()}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded ${statusStyles[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                {order.status}
              </span>
              <span className="text-xs text-gray-400 font-mono">{order.id.slice(0, 8)}</span>
            </div>
            {order.total_cents != null && (
              <span className="font-semibold text-sm">
                ${(order.total_cents / 100).toFixed(2)}
              </span>
            )}
          </div>

          {/* Items */}
          <ul className="space-y-1 mb-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.quantity}× {item.product_name}</span>
                <span className="text-gray-500">${((item.price_cents * item.quantity) / 100).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          {/* Shipping address (visible after payment) */}
          {(order.shipping_name || order.shipping_address) && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <span className="font-medium text-gray-700">Ship to: </span>
              {order.shipping_name && <span>{order.shipping_name} — </span>}
              {formatAddress(order.shipping_address)}
            </div>
          )}

          {/* Fulfillment details */}
          {order.status === "fulfilled" && order.tracking_number && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
              <span className="font-semibold">Tracking: {order.tracking_number}</span>
              {order.shipped_at && (
                <span className="ml-2">· Shipped {new Date(order.shipped_at).toLocaleDateString()}</span>
              )}
              {order.fulfillment_notes && (
                <span className="ml-2">· {order.fulfillment_notes}</span>
              )}
            </div>
          )}

          {order.status === "pending" && (
            <p className="text-xs text-gray-400 mt-3">Awaiting payment confirmation.</p>
          )}
          {order.status === "paid" && (
            <p className="text-xs text-gray-500 mt-3">Payment confirmed — your order is being prepared.</p>
          )}
        </div>
      ))}
    </div>
  );
}

function MarketOrdersView() {
  const [orders, setOrders] = useState<Array<{
    id: string;
    itemId: string;
    categoryKey: string;
    priceCents: number;
    status: string;
    deliverableUrl: string | null;
    orderCreatedAt: string;
    buyerEmail?: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/creator/market-orders")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setOrders(data.items || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const handleStatus = async (itemId: string, status: "accepted" | "declined") => {
    const res = await fetch(`/api/creator/market-orders/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setOrders((prev) => prev.map((o) => (o.itemId === itemId ? { ...o, status } : o)));
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-600">Loading market orders…</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-600">Market orders</p>
        <p className="text-sm text-gray-500 mt-2">
          When buyers purchase your services, orders will show here. You can accept or decline, then upload the deliverable when accepted.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((item) => (
        <div key={item.itemId} className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <span className="text-sm text-gray-500">
              {new Date(item.orderCreatedAt).toLocaleDateString()} · {item.categoryKey.replace(/_/g, " ")}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              item.status === "pending" ? "bg-amber-100 text-amber-700" :
              item.status === "accepted" ? "bg-blue-100 text-blue-700" :
              item.status === "declined" ? "bg-red-100 text-red-700" :
              "bg-green-100 text-green-700"
            }`}>
              {item.status}
            </span>
          </div>
          <p className="text-gray-700">${(item.priceCents / 100).toFixed(2)}</p>
          {item.buyerEmail && <p className="text-sm text-gray-500">Buyer: {item.buyerEmail}</p>}
          {item.status === "pending" && (
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => handleStatus(item.itemId, "accepted")}
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => handleStatus(item.itemId, "declined")}
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
              >
                Decline
              </button>
            </div>
          )}
          {item.status === "accepted" && (
            <p className="text-sm text-gray-500 mt-3">Upload deliverable (coming soon)</p>
          )}
          {item.status === "completed" && item.deliverableUrl && (
            <a href={item.deliverableUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              View deliverable
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
