"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/useAdmin";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type StoreProduct = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string | null;
  image_url: string | null;
  in_stock: boolean;
  sort_order: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  product_name: string;
  price_cents: number;
  quantity: number;
};

type ShippingAddress = {
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

type StoreOrder = {
  id: string;
  clerk_user_id: string | null;
  status: "pending" | "paid" | "fulfilled" | "cancelled";
  total_cents: number | null;
  shipping_name: string | null;
  shipping_address: ShippingAddress | null;
  stripe_payment_intent_id: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
  fulfillment_notes?: string | null;
  created_at: string;
  items: OrderItem[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatAddress(addr: ShippingAddress | null) {
  if (!addr) return "—";
  return [addr.line1, addr.line2, `${addr.city ?? ""} ${addr.state ?? ""} ${addr.postal_code ?? ""}`, addr.country]
    .filter(Boolean)
    .join(", ");
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  paid: "bg-amber-100 text-amber-700",
  fulfilled: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

// ─── Product form modal ───────────────────────────────────────────────────────

type ProductFormProps = {
  initial?: StoreProduct | null;
  onSave: (p: StoreProduct) => void;
  onClose: () => void;
};

function ProductForm({ initial, onSave, onClose }: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceDollars, setPriceDollars] = useState(
    initial ? (initial.price_cents / 100).toFixed(2) : ""
  );
  const [category, setCategory] = useState(initial?.category ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price_cents = Math.round(parseFloat(priceDollars) * 100);
    if (!name.trim() || isNaN(price_cents) || price_cents < 50) {
      toast.error("Name and a valid price (min $0.50) are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price_cents,
        category: category.trim() || null,
        image_url: imageUrl.trim() || null,
      };

      let res: Response;
      if (initial) {
        res = await fetch(`/api/store/products/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/store/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(initial ? "Product updated." : "Product created in Zineground + Stripe.");
      onSave(data.product);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
      <div
        className="bg-white border-2 border-black rounded-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b-2 border-black">
          <h2 className="text-lg font-black">{initial ? "Edit Product" : "Add Product"}</h2>
          <button
            onClick={onClose}
            className="text-xl font-bold text-gray-400 hover:text-black transition-colors leading-none"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
              Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium"
              placeholder="Half Letter Print Run"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm resize-none"
              placeholder="What is this product?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                Price (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.50"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium"
                placeholder="12.00"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                Category
              </label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm"
                placeholder="Print, Merch, Bundle…"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
              Image URL
            </label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm"
              placeholder="https://…"
            />
            <p className="text-xs text-gray-400 mt-1">
              Paste a public image URL. Image upload coming soon.
            </p>
          </div>
          {initial && (
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
              Stripe Product ID: {initial.stripe_product_id ?? "—"}<br />
              Stripe Price ID: {initial.stripe_price_id ?? "—"}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : initial ? "Save Changes" : "Create Product"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border-2 border-black py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminStorePage() {
  const router = useRouter();
  const { isAdmin: userIsAdmin, loading: adminLoading } = useAdmin();
  const [tab, setTab] = useState<"products" | "orders">("products");

  // Products state
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Orders state
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [fulfillForm, setFulfillForm] = useState<Record<string, { tracking: string; shipped_at: string; notes: string }>>({});

  useEffect(() => {
    if (!adminLoading && !userIsAdmin) router.push("/dashboard");
  }, [adminLoading, userIsAdmin, router]);

  useEffect(() => {
    if (!userIsAdmin) return;
    fetchProducts();
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsAdmin]);

  async function fetchProducts() {
    setProductsLoading(true);
    const res = await fetch("/api/store/products");
    const data = await res.json();
    setProducts(data.products ?? []);
    setProductsLoading(false);
  }

  async function fetchOrders() {
    setOrdersLoading(true);
    const res = await fetch("/api/store/orders");
    const data = await res.json();
    setOrders(data.orders ?? []);
    setOrdersLoading(false);
  }

  async function toggleStock(product: StoreProduct) {
    const res = await fetch(`/api/store/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ in_stock: !product.in_stock }),
    });
    if (res.ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, in_stock: !product.in_stock } : p))
      );
      toast.success(product.in_stock ? "Marked out of stock." : "Marked in stock.");
    }
  }

  async function deleteProduct(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/store/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Product deleted.");
    } else {
      toast.error("Delete failed.");
    }
    setDeletingId(null);
  }

  async function markAsPaid(orderId: string) {
    const res = await fetch(`/api/store/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    if (res.ok) {
      toast.success("Order marked as paid.");
      fetchOrders();
    } else {
      toast.error("Update failed.");
    }
  }

  async function cancelOrder(orderId: string) {
    if (!confirm("Cancel this order?")) return;
    const res = await fetch(`/api/store/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (res.ok) {
      toast.success("Order cancelled.");
      fetchOrders();
    } else {
      toast.error("Update failed.");
    }
  }

  async function fulfillOrder(orderId: string) {
    const form = fulfillForm[orderId];
    if (!form?.tracking) {
      toast.error("Tracking number is required.");
      return;
    }
    const res = await fetch(`/api/store/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "fulfilled",
        tracking_number: form.tracking,
        shipped_at: form.shipped_at || new Date().toISOString(),
        fulfillment_notes: form.notes || null,
      }),
    });
    if (res.ok) {
      toast.success("Order marked fulfilled.");
      setFulfillingId(null);
      fetchOrders();
    } else {
      toast.error("Fulfillment failed.");
    }
  }

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">Loading…</div>
    );
  }
  if (!userIsAdmin) return null;

  const paidOrders = orders.filter((o) => o.status === "paid");
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const fulfilledOrders = orders.filter((o) => o.status === "fulfilled");
  const cancelledOrders = orders.filter((o) => o.status === "cancelled");

  return (
    <div className="min-h-screen bg-[#F0EBCC] text-black">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard/admin" className="text-sm text-gray-500 hover:text-black mb-2 inline-block">
            ← Admin
          </Link>
          <h1 className="text-3xl font-bold">Store Management</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white border-2 border-black rounded-xl p-1 w-fit">
          {(["products", "orders"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                tab === t ? "bg-black text-white" : "text-gray-500 hover:text-black"
              }`}
            >
              {t}
              {t === "orders" && (paidOrders.length + pendingOrders.length) > 0 && (
                <span className="ml-2 bg-amber-400 text-black text-xs font-black rounded-full px-1.5">
                  {paidOrders.length + pendingOrders.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── PRODUCTS TAB ── */}
        {tab === "products" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{products.length} product{products.length !== 1 ? "s" : ""}</p>
              <button
                onClick={() => setEditingProduct("new")}
                className="bg-black text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors"
              >
                + Add Product
              </button>
            </div>

            {productsLoading && <p className="text-sm text-gray-400">Loading…</p>}

            {!productsLoading && products.length === 0 && (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                <p className="text-gray-400 text-sm font-medium">No products yet.</p>
                <button
                  onClick={() => setEditingProduct("new")}
                  className="mt-4 bg-black text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors"
                >
                  Add your first product
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4"
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 shrink-0 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 border border-dashed border-gray-200 rounded" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm">{product.name}</p>
                      {product.category && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          {product.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-600 mt-0.5">{fmt(product.price_cents)}</p>
                  </div>

                  {/* Stock badge */}
                  <button
                    onClick={() => toggleStock(product)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border-2 transition-colors ${
                      product.in_stock
                        ? "border-green-400 text-green-700 hover:bg-green-50"
                        : "border-gray-300 text-gray-400 hover:bg-gray-50"
                    }`}
                    title="Click to toggle"
                  >
                    {product.in_stock ? "In stock" : "Out of stock"}
                  </button>

                  {/* Actions */}
                  <button
                    onClick={() => setEditingProduct(product)}
                    className="shrink-0 border-2 border-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black hover:text-white transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${product.name}"? This also archives it in Stripe.`)) {
                        deleteProduct(product.id);
                      }
                    }}
                    disabled={deletingId === product.id}
                    className="shrink-0 border-2 border-red-300 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === "orders" && (
          <div className="flex flex-col gap-8">
            {ordersLoading && <p className="text-sm text-gray-400">Loading…</p>}

            {!ordersLoading && orders.length === 0 && (
              <p className="text-sm text-gray-400">No orders yet.</p>
            )}

            {/* Paid — need fulfillment */}
            {paidOrders.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-widest font-bold text-amber-600 mb-3">
                  Paid — Need Fulfillment ({paidOrders.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {paidOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      fulfillingId={fulfillingId}
                      fulfillForm={fulfillForm}
                      setFulfillingId={setFulfillingId}
                      setFulfillForm={setFulfillForm}
                      fulfillOrder={fulfillOrder}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Pending — awaiting payment confirmation */}
            {pendingOrders.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-widest font-bold text-gray-500 mb-1">
                  Awaiting Payment Confirmation ({pendingOrders.length})
                </h2>
                <p className="text-xs text-gray-400 mb-3">
                  Payment may already be captured — use &ldquo;Mark as Paid&rdquo; to confirm and move to fulfillment.
                </p>
                <div className="flex flex-col gap-3">
                  {pendingOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      fulfillingId={null}
                      fulfillForm={{}}
                      setFulfillingId={() => {}}
                      setFulfillForm={() => {}}
                      fulfillOrder={() => {}}
                      onMarkPaid={markAsPaid}
                      onCancel={cancelOrder}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Fulfilled */}
            {fulfilledOrders.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-widest font-bold text-green-600 mb-3">
                  Fulfilled ({fulfilledOrders.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {fulfilledOrders.map((order) => (
                    <OrderCard key={order.id} order={order} fulfillingId={null} fulfillForm={{}} setFulfillingId={() => {}} setFulfillForm={() => {}} fulfillOrder={() => {}} />
                  ))}
                </div>
              </section>
            )}

            {/* Cancelled */}
            {cancelledOrders.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-3">
                  Cancelled ({cancelledOrders.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {cancelledOrders.map((order) => (
                    <OrderCard key={order.id} order={order} fulfillingId={null} fulfillForm={{}} setFulfillingId={() => {}} setFulfillForm={() => {}} fulfillOrder={() => {}} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Product form modal */}
      {editingProduct !== null && (
        <ProductForm
          initial={editingProduct === "new" ? null : editingProduct}
          onSave={(saved) => {
            if (editingProduct === "new") {
              setProducts((prev) => [saved, ...prev]);
            } else {
              setProducts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            }
            setEditingProduct(null);
          }}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
}

// ─── Order card sub-component ─────────────────────────────────────────────────

type OrderCardProps = {
  order: StoreOrder;
  fulfillingId: string | null;
  fulfillForm: Record<string, { tracking: string; shipped_at: string; notes: string }>;
  setFulfillingId: (id: string | null) => void;
  setFulfillForm: React.Dispatch<React.SetStateAction<Record<string, { tracking: string; shipped_at: string; notes: string }>>>;
  fulfillOrder: (id: string) => void;
  onMarkPaid?: (id: string) => void;
  onCancel?: (id: string) => void;
};

function OrderCard({ order, fulfillingId, fulfillForm, setFulfillingId, setFulfillForm, fulfillOrder, onMarkPaid, onCancel }: OrderCardProps) {
  const isExpanded = fulfillingId === order.id;
  const form = fulfillForm[order.id] ?? { tracking: "", shipped_at: new Date().toISOString().slice(0, 10), notes: "" };

  function setField(field: "tracking" | "shipped_at" | "notes", value: string) {
    setFulfillForm((prev) => ({
      ...prev,
      [order.id]: { ...form, [field]: value },
    }));
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-500"}`}
            >
              {order.status}
            </span>
            <span className="text-xs text-gray-400 font-mono">{order.id.slice(0, 8)}</span>
            <span className="text-xs text-gray-400">
              {new Date(order.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Items */}
          <div className="mt-2 flex flex-col gap-0.5">
            {order.items.map((item) => (
              <p key={item.id} className="text-sm text-gray-700">
                {item.quantity}× {item.product_name} — {fmt(item.price_cents * item.quantity)}
              </p>
            ))}
          </div>

          {/* Shipping */}
          {(order.shipping_name || order.shipping_address) && (
            <p className="text-xs text-gray-500 mt-2">
              Ship to: <strong>{order.shipping_name}</strong> — {formatAddress(order.shipping_address)}
            </p>
          )}

          {/* Fulfillment details */}
          {order.status === "fulfilled" && order.tracking_number && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
              Tracking: <strong>{order.tracking_number}</strong>
              {order.shipped_at && ` · Shipped ${new Date(order.shipped_at).toLocaleDateString()}`}
              {order.fulfillment_notes && ` · ${order.fulfillment_notes}`}
            </div>
          )}
        </div>

        {/* Total + action */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {order.total_cents != null && (
            <span className="font-black text-base">{fmt(order.total_cents)}</span>
          )}
          {order.status === "pending" && (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => onMarkPaid?.(order.id)}
                className="bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-900 transition-colors"
              >
                Mark as Paid
              </button>
              <button
                onClick={() => onCancel?.(order.id)}
                className="border border-red-300 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          {order.status === "paid" && !isExpanded && (
            <button
              onClick={() => setFulfillingId(order.id)}
              className="bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-900 transition-colors"
            >
              Fulfil Order
            </button>
          )}
        </div>
      </div>

      {/* Inline fulfillment form */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-gray-500 block mb-1">
              Tracking Number *
            </label>
            <input
              value={form.tracking}
              onChange={(e) => setField("tracking", e.target.value)}
              className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium"
              placeholder="1Z…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500 block mb-1">
                Ship Date
              </label>
              <input
                type="date"
                value={form.shipped_at}
                onChange={(e) => setField("shipped_at", e.target.value)}
                className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500 block mb-1">
                Notes
              </label>
              <input
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm"
                placeholder="Carrier, packaging…"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fulfillOrder(order.id)}
              className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors"
            >
              Confirm & Fulfil
            </button>
            <button
              onClick={() => setFulfillingId(null)}
              className="flex-1 border-2 border-black py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
