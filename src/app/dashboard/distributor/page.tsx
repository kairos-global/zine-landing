"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import toast from "react-hot-toast";
import Link from "next/link";

type Distributor = {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone?: string;
};

type Issue = {
  id: string;
  slug: string;
  title: string;
  cover_img_url?: string;
  pdf_url?: string;
  status: string;
  published_at?: string;
};

type CartItem = {
  issue_id: string;
  quantity: number;
};

type StockItem = {
  id: string;
  distributor_id: string;
  issue_id: string;
  quantity: number;
  updated_at: string;
  issue: Issue;
};

export default function DistributorPortalPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [distributor, setDistributor] = useState<Distributor | null>(null);

  // 🔹 Fetch distributor info
  useEffect(() => {
    async function fetchDistributor() {
      if (!isSignedIn || !user) return;
      try {
        const res = await fetch("/api/distributors/me");
        if (res.ok) {
          const data = await res.json();
          setDistributor(data.distributor);
        }
      } catch (err) {
        console.error("Failed to fetch distributor:", err);
      } finally {
        setLoading(false);
      }
    }
    if (isLoaded) fetchDistributor();
  }, [isLoaded, isSignedIn, user]);

  if (!isLoaded || loading) {
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

  // 🔹 Conditional Views
  if (!distributor) {
    return <DistributorRegistrationForm />;
  }

  if (distributor.status === "pending") {
    return <PendingView distributor={distributor} />;
  }

  if (distributor.status === "approved") {
    return <ApprovedPortal distributor={distributor} />;
  }

  // Rejected state
  return <RejectedView />;
}

// ========== PENDING VIEW ==========
function PendingView({ distributor }: { distributor: Distributor }) {
    return (
      <div className="relative min-h-screen text-black">
        <div
          className="fixed inset-0 -z-10 pointer-events-none"
          style={{ backgroundColor: "#E2E2E2" }}
        />
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="rounded-2xl border shadow-inner bg-white/80 backdrop-blur p-6">
            <h1 className="text-xl font-semibold mb-2">⏳ Registration Pending</h1>
            <p className="text-gray-700">
              Thanks for registering, {distributor.contact_name}. Our team is reviewing your
            application. You&apos;ll get access once approved.
            </p>
          </div>
        </div>
      </div>
    );
  }

// ========== REJECTED VIEW ==========
function RejectedView() {
  return (
    <div className="relative min-h-screen text-black">
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ backgroundColor: "#E2E2E2" }}
      />
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-2xl border shadow-inner bg-white/80 backdrop-blur p-6">
          <h1 className="text-xl font-semibold mb-2">❌ Registration Rejected</h1>
          <p className="text-gray-700">
            Unfortunately, your distributor application was not approved. Please
            contact support for details.
          </p>
        </div>
      </div>
    </div>
  );
}

type DistributorOrder = {
  id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  shipping_cost?: number;
  payment_status?: string;
  items: Array<{
    id: string;
    quantity: number;
    issue: Issue;
  }>;
};

// ========== APPROVED PORTAL ==========
function ApprovedPortal({ distributor }: { distributor: Distributor }) {
  const [activeTab, setActiveTab] = useState<"browse" | "stock" | "orders">("browse");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    fetchIssues();
    fetchStock();

    // Handle payment success/cancel from URL params
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const orderId = params.get("orderId");

    if (paymentStatus === "success" && orderId) {
      toast.success("Payment successful! Your order is being processed.");
      setCart([]);
      fetchStock();
      setActiveTab("orders");
      fetchOrders();
      window.history.replaceState({}, "", "/dashboard/distributor");
    } else if (paymentStatus === "cancelled") {
      toast.error("Payment was cancelled. Your order was not placed.");
      window.history.replaceState({}, "", "/dashboard/distributor");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchOrders() {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/distributors/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function fetchIssues() {
    try {
      const res = await fetch("/api/distributors/issues");
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues);
      }
    } catch (err) {
      console.error("Error fetching issues:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStock() {
    try {
      const res = await fetch("/api/distributors/stock");
      if (res.ok) {
        const data = await res.json();
        setStock(data.stock);
      }
    } catch (err) {
      console.error("Error fetching stock:", err);
    }
  }

  function addToCart(issueId: string) {
    const existing = cart.find((item) => item.issue_id === issueId);
    if (existing) {
      setCart(cart.map((item) =>
        item.issue_id === issueId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { issue_id: issueId, quantity: 10 }]);
    }
    toast.success("Added to cart");
  }

  function updateCartQuantity(issueId: string, quantity: number) {
    if (quantity <= 0) {
      setCart(cart.filter((item) => item.issue_id !== issueId));
    } else {
      setCart(cart.map((item) =>
        item.issue_id === issueId ? { ...item, quantity } : item
      ));
    }
  }

  async function placeOrder() {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setPlacing(true);
    try {
      // Step 1: Create the order
      const orderRes = await fetch("/api/distributors/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        const msg = err.details ? `${err.error}: ${err.details}` : (err.error || "Failed to create order");
        toast.error(msg);
        return;
      }

      const orderData = await orderRes.json();
      const orderId = orderData.order.id;

      // Step 2: Create checkout session for shipping payment
      const checkoutRes = await fetch("/api/payments/distributor-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (!checkoutRes.ok) {
        const err = await checkoutRes.json();
        toast.error(err.error || "Failed to create payment session");
        return;
      }

      const checkoutData = await checkoutRes.json();
      
      // Redirect to Stripe Checkout
      if (checkoutData.checkoutUrl) {
        window.location.href = checkoutData.checkoutUrl;
      } else {
        toast.error("Failed to get checkout URL");
      }
    } catch (err) {
      console.error("Error placing order:", err);
      toast.error("Failed to place order");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="relative min-h-screen text-black bg-[#E2E2E2]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-black mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Distributor Portal</h1>
          <p className="text-gray-600 mt-1">{distributor.business_name}</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-300">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("browse")}
              className={`pb-3 px-1 font-medium transition ${
                activeTab === "browse"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Browse Zines
              {cart.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  {cart.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("stock")}
              className={`pb-3 px-1 font-medium transition ${
                activeTab === "stock"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              My Stock
            </button>
            <button
              onClick={() => {
                setActiveTab("orders");
                fetchOrders();
              }}
              className={`pb-3 px-1 font-medium transition ${
                activeTab === "orders"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Orders
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "browse" ? (
          <BrowseZines
            issues={issues}
            cart={cart}
            loading={loading}
            onAddToCart={addToCart}
            onUpdateQuantity={updateCartQuantity}
            onPlaceOrder={placeOrder}
            placing={placing}
          />
        ) : activeTab === "stock" ? (
          <StockView stock={stock} />
        ) : (
          <OrdersView orders={orders} loading={ordersLoading} />
        )}
      </div>
    </div>
  );
}

// ========== PDF VIEWER MODAL ==========
function PdfModal({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  if (!issue.pdf_url) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="View PDF"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-lg truncate pr-4">{issue.title || "PDF"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-black transition"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
        <div className="flex-1 min-h-0 p-2">
          <iframe
            src={`${issue.pdf_url}#toolbar=0`}
            title={issue.title || "Zine PDF"}
            className="w-full h-[75vh] rounded-lg border-0 bg-gray-100"
          />
        </div>
      </div>
    </div>
  );
}

// ========== BROWSE ZINES TAB ==========
function BrowseZines({
  issues,
  cart,
  loading,
  onAddToCart,
  onUpdateQuantity,
  onPlaceOrder,
  placing,
}: {
  issues: Issue[];
  cart: CartItem[];
  loading: boolean;
  onAddToCart: (id: string) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onPlaceOrder: () => void;
  placing: boolean;
}) {
  const [pdfModalIssue, setPdfModalIssue] = useState<Issue | null>(null);

  if (loading) {
    return <div className="text-center py-12 text-gray-600">Loading zines...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* PDF viewer modal */}
      {pdfModalIssue?.pdf_url && (
        <PdfModal
          issue={pdfModalIssue}
          onClose={() => setPdfModalIssue(null)}
        />
      )}

      {/* Issues Grid */}
      <div className="lg:col-span-2 space-y-4">
        {issues.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📚</div>
            <p className="text-gray-600">No published zines available yet</p>
          </div>
        ) : (
          issues.map((issue) => (
            <div key={issue.id} className="bg-white rounded-xl border p-4 flex gap-4">
              <div className="flex flex-col gap-2">
                {issue.cover_img_url && (
                  <img
                    src={issue.cover_img_url}
                    alt={issue.title || "Zine cover"}
                    className="w-24 h-32 object-cover rounded"
                  />
                )}
                {issue.pdf_url && (
                  <button
                    type="button"
                    onClick={() => setPdfModalIssue(issue)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View PDF
                  </button>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{issue.title || "Untitled"}</h3>
                <p className="text-sm text-gray-600">{issue.slug}</p>
                {issue.published_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    Published: {new Date(issue.published_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => onAddToCart(issue.id)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition self-start"
              >
                Add to Cart
              </button>
            </div>
          ))
        )}
      </div>

      {/* Cart Sidebar */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl border p-6 sticky top-6">
          <h3 className="font-semibold text-lg mb-4">Order Cart</h3>
          
          {cart.length === 0 ? (
            <p className="text-gray-500 text-sm">Your cart is empty</p>
          ) : (
            <>
              <div className="space-y-0 mb-4">
                {cart.map((item) => {
                  const issue = issues.find((i) => i.id === item.issue_id);
                  return (
                    <div
                      key={item.issue_id}
                      className="flex items-center justify-between gap-3 py-3 border-b border-dotted border-gray-400 first:pt-0 last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{issue?.title || "Unknown"}</p>
                        {issue?.slug && (
                          <p className="text-xs text-gray-500 truncate">{issue.slug}</p>
                        )}
                      </div>
                      <div className="flex items-center flex-shrink-0">
                        <label htmlFor={`cart-qty-${item.issue_id}`} className="sr-only">
                          Quantity for {issue?.title || "item"}
                        </label>
                        <input
                          id={`cart-qty-${item.issue_id}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={3}
                          value={item.quantity}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "");
                            if (v === "") return;
                            const n = parseInt(v, 10);
                            if (!isNaN(n) && n >= 0 && n <= 99) {
                              onUpdateQuantity(item.issue_id, n);
                            }
                          }}
                          onBlur={(e) => {
                            const v = e.target.value.replace(/\D/g, "").trim();
                            if (v === "") {
                              onUpdateQuantity(item.issue_id, 1);
                              return;
                            }
                            const n = parseInt(v, 10);
                            if (isNaN(n) || n < 1) onUpdateQuantity(item.issue_id, 1);
                            else if (n > 99) onUpdateQuantity(item.issue_id, 99);
                          }}
                          className="w-11 h-11 rounded border border-gray-300 text-center text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={onPlaceOrder}
                disabled={placing}
                className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 font-medium"
              >
                {placing ? "Processing..." : "Proceed to Payment"}
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                $10 flat shipping at checkout
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== STOCK VIEW TAB ==========
function StockView({ stock }: { stock: StockItem[] }) {
  if (stock.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📦</div>
        <p className="text-gray-600">You don&apos;t have any stock yet</p>
        <p className="text-sm text-gray-500 mt-2">Place an order to get started!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Zine</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Quantity</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Last Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {stock.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="font-medium">{item.issue.title || "Untitled"}</div>
                <div className="text-sm text-gray-500">{item.issue.slug}</div>
              </td>
              <td className="px-6 py-4">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {item.quantity}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {new Date(item.updated_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ========== ORDERS TAB ==========
function OrdersView({
  orders,
  loading,
}: {
  orders: DistributorOrder[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="text-center py-12 text-gray-600">
        Loading orders...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📋</div>
        <p className="text-gray-600">No orders yet</p>
        <p className="text-sm text-gray-500 mt-2">Place an order from Browse Zines to see it here.</p>
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
        const totalItems = order.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
        return (
          <div
            key={order.id}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
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
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Order items ({totalItems} total)
              </p>
              <ul className="space-y-2">
                {order.items?.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{item.issue?.title || "Untitled"}</span>
                    <span className="text-gray-600">×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ========== REGISTRATION FORM ==========
function DistributorRegistrationForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const res = await fetch("/api/distributors/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      const err = await res.json();
      toast.error(err.error || "Error submitting form");
    }
  }

  if (success) {
    return (
      <div className="relative min-h-screen text-black">
        <div
          className="fixed inset-0 -z-10 pointer-events-none"
          style={{ backgroundColor: "#E2E2E2" }}
        />
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="rounded-2xl border shadow-inner bg-white/80 backdrop-blur p-6">
            <h1 className="text-xl sm:text-2xl font-semibold mb-4">
              ✅ Registration Submitted
            </h1>
            <p className="text-gray-700 mb-6">
              Thanks for registering! Our team will review your application and
              approve you as a distributor. Once approved, you&apos;ll unlock access
              to the Distributor Portal.
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-xl transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-black">
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ backgroundColor: "#E2E2E2" }}
      />
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-5">
          <h1 className="text-xl sm:text-2xl font-semibold">
            Register as Distributor
          </h1>
        </div>

        <div className="rounded-2xl border shadow-inner bg-white/80 backdrop-blur p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Business Name</label>
              <input name="business_name" required className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Business Address</label>
              <input name="business_address" required className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Business Phone</label>
              <input name="business_phone" required className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Business Email</label>
              <input name="business_email" type="email" required className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Contact Name</label>
              <input name="contact_name" required className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Contact Title</label>
              <input name="contact_title" required className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Contact Email</label>
              <input name="contact_email" type="email" required className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Contact Phone (optional)</label>
              <input name="contact_phone" className="w-full rounded-xl border px-3 py-2" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-black text-white px-5 py-2 rounded-xl hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? "Submitting…" : "Submit"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
