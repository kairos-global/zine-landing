"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

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
              application. You’ll get access once approved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (distributor.status === "approved") {
    return (
      <div className="relative min-h-screen text-black">
        <div
          className="fixed inset-0 -z-10 pointer-events-none"
          style={{ backgroundColor: "#E2E2E2" }}
        />
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <h1 className="text-2xl font-semibold mb-4">Distributor Portal</h1>

          {/* Browse Zines */}
          <div className="rounded-2xl border shadow-inner bg-white/80 backdrop-blur p-6">
            <h2 className="text-lg font-semibold mb-3">Browse Zines</h2>
            <p className="text-gray-600 mb-4">
              View all published issues and add them to your stock.
            </p>
            <div className="text-gray-500">[TODO: list of issues goes here]</div>
          </div>

          {/* My Stock */}
          <div className="rounded-2xl border shadow-inner bg-white/80 backdrop-blur p-6">
            <h2 className="text-lg font-semibold mb-3">My Stock</h2>
            <p className="text-gray-600 mb-4">
              Track the zines you currently stock and reorder as needed.
            </p>
            <div className="text-gray-500">[TODO: stock table + reorder flow]</div>
          </div>
        </div>
      </div>
    );
  }

  // Optional rejected state
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
      alert(err.error || "Error submitting form");
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
              approve you as a distributor. Once approved, you’ll unlock access
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
              className="bg-black text-white px-5 py-2 rounded-xl hover:bg-gray-800 transition"
            >
              {loading ? "Submitting…" : "Submit"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
