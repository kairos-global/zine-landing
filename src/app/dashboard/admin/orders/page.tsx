"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/useAdmin";
import toast from "react-hot-toast";

type Order = {
  id: string;
  distributor_id: string;
  status: "pending" | "fulfilled" | "cancelled";
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

  async function handleStatusChange(
    orderId: string,
    newStatus: "fulfilled" | "cancelled"
  ) {
    setProcessingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || `Order ${newStatus}`);
        fetchOrders(); // Refresh the list
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update order");
      }
    } catch (err) {
      console.error("Error updating order:", err);
      toast.error("Failed to update order");
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

  const pendingOrders = orders.filter((o) => o.status === "pending");
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
          <h1 className="text-3xl font-bold">Order Management</h1>
          <p className="text-gray-600 mt-1">View and fulfill distributor orders</p>
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
            <div className="text-4xl mb-4">📦</div>
            <p className="text-gray-600">No orders yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending Orders First */}
            {pendingOrders.length > 0 && (
              <>
                <h2 className="text-xl font-semibold mt-6 mb-3">
                  Pending Orders ({pendingOrders.length})
                </h2>
                {pendingOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onFulfill={() => handleStatusChange(order.id, "fulfilled")}
                    onCancel={() => handleStatusChange(order.id, "cancelled")}
                    processing={processingId === order.id}
                  />
                ))}
              </>
            )}

            {/* Fulfilled Orders */}
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

            {/* Cancelled Orders */}
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

function OrderCard({
  order,
  onFulfill,
  onCancel,
  processing,
}: {
  order: Order;
  onFulfill?: () => void;
  onCancel?: () => void;
  processing: boolean;
}) {
  const statusColors = {
    pending: "bg-orange-100 text-orange-700",
    fulfilled: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-700",
  };

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold">
              {order.distributor.business_name}
            </h3>
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${
                statusColors[order.status]
              }`}
            >
              {order.status}
            </span>
          </div>
          <p className="text-sm text-gray-600">{order.distributor.business_address}</p>
          <p className="text-sm text-gray-600">
            Contact: {order.distributor.contact_name} ({order.distributor.contact_email})
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <div>Ordered: {new Date(order.created_at).toLocaleDateString()}</div>
          {order.updated_at && order.status !== "pending" && (
            <div>{order.status === "fulfilled" ? "Fulfilled" : "Cancelled"}: {new Date(order.updated_at).toLocaleDateString()}</div>
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

      {/* Actions */}
      {order.status === "pending" && onFulfill && onCancel && (
        <div className="flex gap-3 border-t border-gray-200 pt-4">
          <button
            onClick={onFulfill}
            disabled={processing}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 font-medium"
          >
            {processing ? "Processing..." : "✓ Fulfill Order"}
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
    </div>
  );
}

