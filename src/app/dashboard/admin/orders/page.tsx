"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/useAdmin";
import toast from "react-hot-toast";

type Order = {
  id: string;
  distributor_id: string;
  status: "draft" | "placed" | "fulfilled" | "cancelled" | "pending_creator_approval";
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
    creator_approval_status?: string;
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
        toast.success("Order fulfilled");
        fetchOrders();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to fulfill order");
      }
    } catch {
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
        toast.success("Order cancelled");
        fetchOrders();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to cancel order");
      }
    } catch {
      toast.error("Failed to cancel order");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleForceFinalize(orderId: string) {
    setProcessingId(orderId + "_finalize");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/finalize`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Finalized — order is now: ${data.order?.status}`);
        fetchOrders();
      } else {
        const err = await res.json();
        toast.error(err.error || "Finalize failed");
      }
    } catch {
      toast.error("Finalize failed");
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

  if (!userIsAdmin) return null;

  const awaitingPaymentOrders = orders.filter(
    (o) => o.status === "pending_creator_approval"
  );
  const readyToFulfillOrders = orders.filter((o) => o.status === "placed");
  const draftOrders = orders.filter((o) => o.status === "draft");
  const fulfilledOrders = orders.filter((o) => o.status === "fulfilled");
  const cancelledOrders = orders.filter((o) => o.status === "cancelled");

  const totalPending = awaitingPaymentOrders.length + readyToFulfillOrders.length + draftOrders.length;

  return (
    <div className="min-h-screen bg-[#F0EBCC] text-black">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <Link
            href="/dashboard/admin"
            className="text-sm text-gray-600 hover:text-black mb-2 inline-block"
          >
            ← Back to Admin Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Fulfil Distributor Orders</h1>
          <p className="text-gray-600 mt-1">
            Monitor payment flow and ship confirmed orders to distributors
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Awaiting payment</div>
            <div className="text-3xl font-bold text-amber-600">{awaitingPaymentOrders.length}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Ready to ship</div>
            <div className="text-3xl font-bold text-orange-600">{readyToFulfillOrders.length}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Fulfilled</div>
            <div className="text-3xl font-bold text-green-600">{fulfilledOrders.length}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Cancelled</div>
            <div className="text-3xl font-bold text-gray-500">{cancelledOrders.length}</div>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No orders yet</div>
        ) : (
          <div className="space-y-8">
            {/* Awaiting creator payment — needs monitoring */}
            {awaitingPaymentOrders.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 text-amber-700">
                  Awaiting creator payment ({awaitingPaymentOrders.length})
                </h2>
                <p className="text-sm text-gray-500 mb-3">
                  Distributor card is saved. Waiting for creator(s) to approve and pay their print fee. Order will auto-charge the distributor once complete.
                </p>
                <div className="space-y-3">
                  {awaitingPaymentOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onCancel={() => handleCancel(order.id)}
                      onForceFinalize={() => handleForceFinalize(order.id)}
                      processing={processingId === order.id || processingId === order.id + "_finalize"}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Ready to fulfill */}
            {readyToFulfillOrders.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 text-orange-700">
                  Ready to ship ({readyToFulfillOrders.length})
                </h2>
                <div className="space-y-3">
                  {readyToFulfillOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onFulfill={handleFulfill}
                      onCancel={() => handleCancel(order.id)}
                      processing={processingId === order.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Draft (pre-payment, legacy) */}
            {draftOrders.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 text-gray-600">
                  Draft ({draftOrders.length})
                </h2>
                <div className="space-y-3">
                  {draftOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onCancel={() => handleCancel(order.id)}
                      processing={processingId === order.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Fulfilled */}
            {fulfilledOrders.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 text-green-700">
                  Fulfilled ({fulfilledOrders.length})
                </h2>
                <div className="space-y-3">
                  {fulfilledOrders.map((order) => (
                    <OrderCard key={order.id} order={order} processing={false} />
                  ))}
                </div>
              </section>
            )}

            {/* Cancelled */}
            {cancelledOrders.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 text-gray-500">
                  Cancelled ({cancelledOrders.length})
                </h2>
                <div className="space-y-3">
                  {cancelledOrders.map((order) => (
                    <OrderCard key={order.id} order={order} processing={false} />
                  ))}
                </div>
              </section>
            )}

            {totalPending === 0 && fulfilledOrders.length === 0 && cancelledOrders.length === 0 && (
              <div className="text-center py-12 text-gray-500">No orders to show</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function OrderCard({
  order,
  onFulfill,
  onCancel,
  onForceFinalize,
  processing,
}: {
  order: Order;
  onFulfill?: (orderId: string, trackingNumber: string, shippedAt: string, fulfillmentNotes: string) => void;
  onCancel?: () => void;
  onForceFinalize?: () => void;
  processing: boolean;
}) {
  const [showFulfillForm, setShowFulfillForm] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippedAt, setShippedAt] = useState(todayString());
  const [fulfillmentNotes, setFulfillmentNotes] = useState("");

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    pending_creator_approval: "bg-amber-100 text-amber-700",
    placed: "bg-orange-100 text-orange-700",
    fulfilled: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

  const statusLabels: Record<string, string> = {
    draft: "Draft",
    pending_creator_approval: "Awaiting payment",
    placed: "Paid — ready to ship",
    fulfilled: "Fulfilled",
    cancelled: "Cancelled",
  };

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const isPaid = order.payment_status === "paid";
  const isPlaced = order.status === "placed";
  const isAwaitingPayment = order.status === "pending_creator_approval";
  const isFulfilled = order.status === "fulfilled";

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
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-lg font-semibold">{order.distributor.business_name}</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[order.status] ?? "bg-gray-100 text-gray-600"}`}>
              {statusLabels[order.status] ?? order.status}
            </span>
            {isPaid && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                Payment confirmed
              </span>
            )}
            {!isPaid && isPlaced && (
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
              Shipping: ${Number(order.shipping_cost).toFixed(2)}
            </p>
          )}
        </div>
        <div className="text-right text-sm text-gray-500 ml-4 shrink-0">
          <div>{new Date(order.created_at).toLocaleDateString()}</div>
          {order.updated_at && isFulfilled && (
            <div>Fulfilled {new Date(order.updated_at).toLocaleDateString()}</div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="border-t border-gray-100 pt-4 mb-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Order items ({totalItems} total)</p>
        <div className="space-y-2">
          {order.items.map((item) => {
            const approvalStatus = item.creator_approval_status;
            const approvalBadge =
              approvalStatus === "auto_approved" ? (
                <span className="text-xs text-green-600">auto-approved</span>
              ) : approvalStatus === "approved" ? (
                <span className="text-xs text-green-600">approved</span>
              ) : approvalStatus === "pending_approval" ? (
                <span className="text-xs text-amber-600">pending approval</span>
              ) : approvalStatus === "rejected" ? (
                <span className="text-xs text-red-500">rejected</span>
              ) : null;

            return (
              <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  {item.issue.cover_img_url && (
                    <img
                      src={item.issue.cover_img_url}
                      alt={item.issue.title}
                      className="w-10 h-14 object-cover rounded"
                    />
                  )}
                  <div>
                    <div className="font-medium text-sm">{item.issue.title}</div>
                    {approvalBadge && <div className="mt-0.5">{approvalBadge}</div>}
                  </div>
                </div>
                <div className="text-base font-semibold">×{item.quantity}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fulfillment details (fulfilled orders) */}
      {isFulfilled && (order.tracking_number || order.shipped_at || order.fulfillment_notes) && (
        <div className="border-t border-gray-100 pt-4 mb-4 bg-green-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-green-800 mb-2">Fulfillment details</p>
          {order.tracking_number && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Tracking:</span> {order.tracking_number}
            </p>
          )}
          {order.shipped_at && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Shipped:</span> {new Date(order.shipped_at).toLocaleDateString()}
            </p>
          )}
          {order.fulfillment_notes && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Notes:</span> {order.fulfillment_notes}
            </p>
          )}
        </div>
      )}

      {/* Actions for awaiting-payment orders */}
      {isAwaitingPayment && !showFulfillForm && (
        <div className="flex gap-3 border-t border-gray-100 pt-4">
          {onForceFinalize && (
            <button
              onClick={onForceFinalize}
              disabled={processing}
              className="px-4 py-2 bg-[#65CBF1] text-black rounded-lg text-sm font-medium hover:opacity-80 transition disabled:opacity-50"
            >
              {processing ? "Checking..." : "Force Finalize"}
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={processing}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition disabled:opacity-50"
            >
              Cancel Order
            </button>
          )}
        </div>
      )}

      {/* Actions for placed orders */}
      {isPlaced && !showFulfillForm && onFulfill && onCancel && (
        <div className="flex gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={() => setShowFulfillForm(true)}
            disabled={processing}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 font-medium text-sm"
          >
            {processing ? "Processing..." : "Fulfill Order"}
          </button>
          <button
            onClick={onCancel}
            disabled={processing}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition disabled:opacity-50 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Actions for draft orders */}
      {order.status === "draft" && !showFulfillForm && onCancel && (
        <div className="flex gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={onCancel}
            disabled={processing}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 text-sm"
          >
            Cancel Order
          </button>
        </div>
      )}

      {/* Inline fulfill form */}
      {isPlaced && showFulfillForm && (
        <div className="border-t border-gray-100 pt-4 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Fulfillment details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
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
              <label className="block text-xs font-medium text-gray-600 mb-1">
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
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
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 font-medium text-sm"
            >
              {processing ? "Processing..." : "Confirm & Fulfill Order"}
            </button>
            <button
              onClick={() => setShowFulfillForm(false)}
              disabled={processing}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 text-sm"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
