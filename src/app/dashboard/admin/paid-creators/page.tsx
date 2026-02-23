"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/useAdmin";
import toast from "react-hot-toast";

type PaidCreator = {
  id: string;
  profile_id: string;
  status: "pending" | "approved" | "rejected";
  portfolio_url: string | null;
  bio: string | null;
  stripe_account_id: string | null;
  created_at: string;
  updated_at?: string;
  email?: string | null;
};

type TabType = "pending" | "approved" | "rejected";

export default function AdminPaidCreatorsPage() {
  const router = useRouter();
  const { isAdmin: userIsAdmin, loading: adminLoading } = useAdmin();
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [paidCreators, setPaidCreators] = useState<PaidCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState<PaidCreator | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!adminLoading && !userIsAdmin) {
      router.push("/dashboard");
    }
  }, [adminLoading, userIsAdmin, router]);

  useEffect(() => {
    fetchPaidCreators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userIsAdmin]);

  async function fetchPaidCreators() {
    if (!userIsAdmin) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/paid-creators?status=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        setPaidCreators(data.paidCreators || []);
      }
    } catch (err) {
      console.error("Error fetching paid creators:", err);
      toast.error("Failed to load paid creators");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(creatorId: string, newStatus: "approved" | "rejected") {
    setProcessingId(creatorId);
    try {
      const res = await fetch(`/api/admin/paid-creators/${creatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || `Paid creator ${newStatus}`);

        fetchPaidCreators();
        if (selectedCreator?.id === creatorId) {
          setSelectedCreator(null);
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update paid creator");
      }
    } catch (err) {
      console.error("Error updating paid creator:", err);
      toast.error("Failed to update paid creator");
    } finally {
      setProcessingId(null);
    }
  }

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Loading...
      </div>
    );
  }

  if (!userIsAdmin) {
    return null;
  }

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
          <h1 className="text-3xl font-bold">Paid Creator Management</h1>
          <p className="text-gray-600 mt-1">
            Review and approve paid creator applications
          </p>
        </div>

        <div className="mb-6 border-b border-gray-300">
          <div className="flex gap-6">
            <TabButton
              label="Pending"
              count={activeTab === "pending" ? paidCreators.length : undefined}
              active={activeTab === "pending"}
              onClick={() => setActiveTab("pending")}
            />
            <TabButton
              label="Approved"
              active={activeTab === "approved"}
              onClick={() => setActiveTab("approved")}
            />
            <TabButton
              label="Rejected"
              active={activeTab === "rejected"}
              onClick={() => setActiveTab("rejected")}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-600">Loading paid creators...</div>
        ) : paidCreators.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🛒</div>
            <p className="text-gray-600">
              No {activeTab} paid creators found
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paidCreators.map((creator) => (
              <PaidCreatorCard
                key={creator.id}
                creator={creator}
                onViewDetails={() => setSelectedCreator(creator)}
                onApprove={() => handleStatusChange(creator.id, "approved")}
                onReject={() => handleStatusChange(creator.id, "rejected")}
                processing={processingId === creator.id}
                showActions={activeTab === "pending"}
              />
            ))}
          </div>
        )}

        {selectedCreator && (
          <PaidCreatorModal
            creator={selectedCreator}
            onClose={() => setSelectedCreator(null)}
            onApprove={() => handleStatusChange(selectedCreator.id, "approved")}
            onReject={() => handleStatusChange(selectedCreator.id, "rejected")}
            processing={processingId === selectedCreator.id}
            showActions={activeTab === "pending"}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 px-1 font-medium transition relative ${
        active
          ? "text-purple-600 border-b-2 border-purple-600"
          : "text-gray-600 hover:text-black"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}

function PaidCreatorCard({
  creator,
  onViewDetails,
  onApprove,
  onReject,
  processing,
  showActions,
}: {
  creator: PaidCreator;
  onViewDetails: () => void;
  onApprove: () => void;
  onReject: () => void;
  processing: boolean;
  showActions: boolean;
}) {
  const statusColors = {
    pending: "bg-orange-100 text-orange-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold">
              {creator.email || creator.profile_id}
            </h3>
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${
                statusColors[creator.status]
              }`}
            >
              {creator.status}
            </span>
          </div>
          {creator.portfolio_url && (
            <p className="text-sm text-gray-600 truncate">{creator.portfolio_url}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="font-medium">Email:</span> {creator.email ?? "—"}
        </div>
        <div>
          <span className="font-medium">Applied:</span>{" "}
          {new Date(creator.created_at).toLocaleDateString()}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onViewDetails}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          View Details
        </button>

        {showActions && (
          <>
            <button
              onClick={onApprove}
              disabled={processing}
              className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
            >
              {processing ? "Processing..." : "Approve"}
            </button>
            <button
              onClick={onReject}
              disabled={processing}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50"
            >
              {processing ? "Processing..." : "Reject"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PaidCreatorModal({
  creator,
  onClose,
  onApprove,
  onReject,
  processing,
  showActions,
}: {
  creator: PaidCreator;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  processing: boolean;
  showActions: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {creator.email || creator.profile_id}
            </h2>
            <p className="text-sm text-gray-600 mt-1">Paid Creator Details</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-lg mb-3">Application</h3>
            <div className="space-y-2 text-sm">
              <DetailRow label="Email" value={creator.email ?? "—"} />
              <DetailRow label="Portfolio URL" value={creator.portfolio_url ?? "—"} />
              <DetailRow
                label="Bio"
                value={
                  creator.bio ? (
                    <span className="whitespace-pre-wrap">{creator.bio}</span>
                  ) : (
                    "—"
                  )
                }
              />
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Status &amp; Dates</h3>
            <div className="space-y-2 text-sm">
              <DetailRow
                label="Status"
                value={
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      creator.status === "pending"
                        ? "bg-orange-100 text-orange-700"
                        : creator.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {creator.status}
                  </span>
                }
              />
              <DetailRow
                label="Submitted"
                value={new Date(creator.created_at).toLocaleString()}
              />
              {creator.updated_at && (
                <DetailRow
                  label="Last Updated"
                  value={new Date(creator.updated_at).toLocaleString()}
                />
              )}
              <DetailRow label="Profile ID" value={creator.profile_id} />
            </div>
          </div>
        </div>

        {showActions && (
          <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Close
            </button>
            <button
              onClick={onReject}
              disabled={processing}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50"
            >
              {processing ? "Processing..." : "Reject"}
            </button>
            <button
              onClick={onApprove}
              disabled={processing}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
            >
              {processing ? "Processing..." : "Approve"}
            </button>
          </div>
        )}

        {!showActions && (
          <div className="p-6 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="flex">
      <span className="font-medium w-32 shrink-0">{label}:</span>
      <span className="text-gray-700 break-words">{value}</span>
    </div>
  );
}
