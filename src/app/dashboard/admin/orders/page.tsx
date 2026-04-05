"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/useAdmin";
import toast from "react-hot-toast";

type Order = {
  id: string;
  distributor_id: string;
  status: "draft" | "placed" | "fulfilled" | "cancelled";
  payment_status?: string;
  stripe_payment_intent_id?: string;
  shipping_cost?: number;
  tracking_number?: string;
  shipped_at?: string;
  fulfillment_notes?: string;
  created_at: string;
  updated_at?: string;
  distributor: {
    id: string;
    business_name: string;
    business_address: string;
    contact_name: string;
    contact_email: string;
  };
  items: Array<{
    id: string;
    order_id: string;
    issue_id: string;
    quantity: number;
    issue: {
      id: string;
      title: string;
      slug: string;
      cover_img_url?: string;
    };
  }>;
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const { isAdmin: userIsAdmin, loading: adminLoading } = useAdmin();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!adminLoading && !userIsAdmin) {
      router.push("/dashboard");
    }
  }, [adminLoading, userIsAdmin, router]);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsAdmin]);

  async function fetchOrders() {
    if (!userIsAdmin) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  async function handleFulfill(
    orderId: string,
    trackingNumber: string,
    shippedAt: string,
    fulfillmentNotes: string
  ) {
    setProcessingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "fulfilled",
          tracking_number: trackingNumber,
          shipped_at: shippedAt,
          fulfillment_notes: fulfillmentNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Order fulfilled");
        fetchOrders();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to fulfill order");
      }
    } catch (err) {
      console.error("Error fulfilling order:", err);
      toast.error("Failed to fulfill order");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCancel(orderId: string) {
    setProcessingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Order cancelled");
        fetchOrders();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to cancel order");
      }
    } catch (err) {
      console.error("Error cancelling order:", err);
      toast.error("Failed to cancel order");
    } finally {
      setProcessingId(null);
    }
  }

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Loading...
      </div>
    );
  }

  if (!userIsAdmin) {
    return null;
  }

  const pendingOrders = orders.filter(
    (o) => o.status === "draft" || o.status === "placed"
  );
  const fulfilledOrders = orders.filter((o) => o.status === "fulfilled");
  const cancelledOrders = orders.filter((o) => o.status === "cancelled");

  return (
    <div className="min-h-screen bg-[#F0EBCC] text-black">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/admin"
            className="text-sm text-gray-600 hover:text-black mb-2 inline-block"
          >
            ← Back to Admin Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Fulfil Distributor Orders</h1>
          <p className="text-gray-600 mt-1">
            Review payment confirmations and ship zine orders to distributors
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-1">Pending Orders</div>
            <div className="text-3xl font-bold text-orange-600">
              {pendingOrders.length}
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-1">Fulfilled</div>
            <div className="text-3xl font-bold text-green-600">
              {fulfilledOrders.length}
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-1">Cancelled</div>
            <div className="text-3xl font-bold text-gray-600">
              {cancelledOrders.length}
            </div>
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No orders yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingOrders.length > 0 && (
              <>
                <h2 className="text-xl font-semibold mt-6 mb-3">
                  Pending Orders ({pendingOrders.length})
                </h2>
                {pendingOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onFulfill={handleFulfill}
                    onCancel={() => handleCancel(order.id)}
                    processing={processingId === order.id}
                  />
                ))}
              </>
            )}

            {fulfilledOrders.length > 0 && (
              <>
                <h2 className="text-xl font-semibold mt-6 mb-3">
                  Fulfilled Orders ({fulfilledOrders.length})
                </h2>
                {fulfilledOrders.map((order) => (
                  <OrderCard key={order.id} order={order} processing={false} />
                ))}
              </>
            )}

            {cancelledOrders.length > 0 && (
              <>
                <h2 className="text-xl font-semibold mt-6 mb-3">
                  Cancelled Orders ({cancelledOrders.length})
                </h2>
                {cancelledOrders.map((order) => (
                  <OrderCard key={order.id} order={order} processing={false} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -------- Helpers --------

function todayString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// -------- OrderCard --------

function OrderCard({
  order,
  onFulfill,
  onCancel,
  processing,
}: {
  order: Order;
  onFulfill?: (
    orderId: string,
    trackingNumber: string,
    shippedAt: string,
    fulfillmentNotes: string
  ) => void;
  onCancel?: () => void;
  processing: boolean;
}) {
  const [showFulfillForm, setShowFulfillForm] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippedAt, setShippedAt] = useState(todayString());
  const [fulfillmentNotes, setFulfillmentNotes] = useState("");

  const isPending = order.status === "draft" || order.status === "placed";
  const isFulfilled = order.status === "fulfilled";

  const statusColors: Record<Order["status"], string> = {
    draft: "bg-amber-100 text-amber-700",
    placed: "bg-orange-100 text-orange-700",
    fulfilled: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-700",
  };

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const isPaid = order.payment_status === "paid";

  function handleConfirmFulfill() {
    if (!trackingNumber.trim()) {
      toast.error("Tracking number is required");
      return;
    }
    onFulfill?.(order.id, trackingNumber.trim(), shippedAt, fulfillmentNotes.trim());
    setShowFulfillForm(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-lg font-semibold">
              {order.distributor.business_name}
            </h3>
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${statusColors[order.status]}`}
            >
              {order.status}
            </span>
            {/* Payment badge */}
            {isPaid ? (
              <span className="px-2 py-1 text-xs font-medium rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                Payment confirmed
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-700 border border-yellow-200">
                Payment pending
              </span>
            )}
            {isPaid && order.stripe_payment_intent_id && (
              <span className="text-xs text-gray-400 font-mono">
                {order.stripe_payment_intent_id.slice(0, 22)}…
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">{order.distributor.business_address}</p>
          <p className="text-sm text-gray-600">
            Contact: {order.distributor.contact_name} ({order.distributor.contact_email})
          </p>
          {order.shipping_cost != null && (
            <p className="text-sm text-gray-500 mt-1">
              Shipping paid: ${Number(order.shipping_cost).toFixed(2)}
            </p>
          )}
        </div>
        <div className="text-right text-sm text-gray-600 ml-4 shrink-0">
          <div>Ordered: {new Date(order.created_at).toLocaleDateString()}</div>
          {order.updated_at && isFulfilled && (
            <div>Fulfilled: {new Date(order.updated_at).toLocaleDateString()}</div>
          )}
        </div>
      </div>

      {/* Order Items */}
      <div className="border-t border-gray-200 pt-4 mb-4">
        <h4 className="font-medium text-sm text-gray-600 mb-3">
          Order Items ({totalItems} total)
        </h4>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
            >
              <div className="flex items-center gap-3">
                {item.issue.cover_img_url && (
                  <img
                    src={item.issue.cover_img_url}
                    alt={item.issue.title}
                    className="w-12 h-16 object-cover rounded"
                  />
                )}
                <div>
                  <div className="font-medium">{item.issue.title}</div>
                  <div className="text-sm text-gray-500">{item.issue.slug}</div>
                </div>
              </div>
              <div className="text-lg font-semibold">×{item.quantity}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fulfillment info (for fulfilled orders) */}
      {isFulfilled && (order.tracking_number || order.shipped_at || order.fulfillment_notes) && (
        <div className="border-t border-gray-200 pt-4 mb-4 bg-green-50 rounded-lg p-4 mt-2">
          <h4 className="font-semibold text-sm text-green-800 mb-2">Fulfillment Details</h4>
          {order.tracking_number && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Tracking #:</span> {order.tracking_number}
            </p>
          )}
          {order.shipped_at && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Shipped:</span>{" "}
              {new Date(order.shipped_at).toLocaleDateString()}
            </p>
          )}
          {order.fulfillment_notes && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Notes:</span> {order.fulfillment_notes}
            </p>
          )}
        </div>
      )}

      {/* Pending action buttons */}
      {isPending && !showFulfillForm && onFulfill && onCancel && (
        <div className="flex gap-3 border-t border-gray-200 pt-4">
          <button
            onClick={() => setShowFulfillForm(true)}
            disabled={processing}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 font-medium"
          >
            {processing ? "Processing..." : "Fulfill Order"}
          </button>
          <button
            onClick={onCancel}
            disabled={processing}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Inline fulfillment form */}
      {isPending && showFulfillForm && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <h4 className="font-semibold text-sm text-gray-700">Fulfillment Details</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tracking Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. 1Z999AA10123456784"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shipment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={shippedAt}
                onChange={(e) => setShippedAt(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={fulfillmentNotes}
              onChange={(e) => setFulfillmentNotes(e.target.value)}
              placeholder="Carrier, packaging info, special instructions..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirmFulfill}
              disabled={processing}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 font-medium"
            >
              {processing ? "Processing..." : "Confirm & Fulfill Order"}
            </button>
            <button
              onClick={() => setShowFulfillForm(false)}
              disabled={processing}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
