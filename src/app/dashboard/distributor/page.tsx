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

// ========== APPROVED PORTAL ==========
function ApprovedPortal({ distributor }: { distributor: Distributor }) {
  const [activeTab, setActiveTab] = useState<"browse" | "stock">("browse");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    fetchIssues();
    fetchStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setCart([...cart, { issue_id: issueId, quantity: 1 }]);
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
      const res = await fetch("/api/distributors/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart }),
      });

      if (res.ok) {
        toast.success("Order placed successfully!");
        setCart([]);
        fetchStock(); // Refresh stock after order
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to place order");
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
        ) : (
          <StockView stock={stock} />
        )}
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
  if (loading) {
    return <div className="text-center py-12 text-gray-600">Loading zines...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              {issue.cover_img_url && (
                <img
                  src={issue.cover_img_url}
                  alt={issue.title || "Zine cover"}
                  className="w-24 h-32 object-cover rounded"
                />
              )}
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
              <div className="space-y-3 mb-4">
                {cart.map((item) => {
                  const issue = issues.find((i) => i.id === item.issue_id);
                  return (
                    <div key={item.issue_id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{issue?.title || "Unknown"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onUpdateQuantity(item.issue_id, item.quantity - 1)}
                          className="w-6 h-6 rounded border hover:bg-gray-100"
                        >
                          −
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.issue_id, item.quantity + 1)}
                          className="w-6 h-6 rounded border hover:bg-gray-100"
                        >
                          +
                        </button>
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
                {placing ? "Placing Order..." : "Place Order (Free)"}
              </button>
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
            <p className="text-gray-700">
              Thanks for registering! Our team will review your application and
              approve you as a distributor. Once approved, you&apos;ll unlock access
              to the Distributor Portal.
            </p>
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
