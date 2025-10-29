"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/useAdmin";
import toast from "react-hot-toast";

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
  created_at: string;
  updated_at?: string;
};

type TabType = "pending" | "approved" | "rejected";

export default function AdminDistributorsPage() {
  const router = useRouter();
  const { isAdmin: userIsAdmin, loading: adminLoading } = useAdmin();
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!adminLoading && !userIsAdmin) {
      router.push("/dashboard");
    }
  }, [adminLoading, userIsAdmin, router]);

  useEffect(() => {
    fetchDistributors();
  }, [activeTab, userIsAdmin]);

  async function fetchDistributors() {
    if (!userIsAdmin) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/distributors?status=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        setDistributors(data.distributors || []);
      }
    } catch (err) {
      console.error("Error fetching distributors:", err);
      toast.error("Failed to load distributors");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(distributorId: string, newStatus: "approved" | "rejected") {
    setProcessingId(distributorId);
    try {
      const res = await fetch(`/api/admin/distributors/${distributorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || `Distributor ${newStatus}`);
        
        // Refresh the list
        fetchDistributors();
        
        // Close modal if open
        if (selectedDistributor?.id === distributorId) {
          setSelectedDistributor(null);
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update distributor");
      }
    } catch (err) {
      console.error("Error updating distributor:", err);
      toast.error("Failed to update distributor");
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
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/admin"
            className="text-sm text-gray-600 hover:text-black mb-2 inline-block"
          >
            ← Back to Admin Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Distributor Management</h1>
          <p className="text-gray-600 mt-1">
            Review and approve distributor applications
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-300">
          <div className="flex gap-6">
            <TabButton
              label="Pending"
              count={activeTab === "pending" ? distributors.length : undefined}
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

        {/* Content */}
        {loading ? (
          <div className="text-center py-12 text-gray-600">Loading distributors...</div>
        ) : distributors.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-600">
              No {activeTab} distributors found
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {distributors.map((distributor) => (
              <DistributorCard
                key={distributor.id}
                distributor={distributor}
                onViewDetails={() => setSelectedDistributor(distributor)}
                onApprove={() => handleStatusChange(distributor.id, "approved")}
                onReject={() => handleStatusChange(distributor.id, "rejected")}
                processing={processingId === distributor.id}
                showActions={activeTab === "pending"}
              />
            ))}
          </div>
        )}

        {/* Detail Modal */}
        {selectedDistributor && (
          <DistributorModal
            distributor={selectedDistributor}
            onClose={() => setSelectedDistributor(null)}
            onApprove={() => handleStatusChange(selectedDistributor.id, "approved")}
            onReject={() => handleStatusChange(selectedDistributor.id, "rejected")}
            processing={processingId === selectedDistributor.id}
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

function DistributorCard({
  distributor,
  onViewDetails,
  onApprove,
  onReject,
  processing,
  showActions,
}: {
  distributor: Distributor;
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
            <h3 className="text-lg font-semibold">{distributor.business_name}</h3>
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${
                statusColors[distributor.status]
              }`}
            >
              {distributor.status}
            </span>
          </div>
          <p className="text-sm text-gray-600">{distributor.business_address}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="font-medium">Contact:</span> {distributor.contact_name}
        </div>
        <div>
          <span className="font-medium">Email:</span> {distributor.contact_email}
        </div>
        <div>
          <span className="font-medium">Phone:</span> {distributor.business_phone}
        </div>
        <div>
          <span className="font-medium">Applied:</span>{" "}
          {new Date(distributor.created_at).toLocaleDateString()}
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

function DistributorModal({
  distributor,
  onClose,
  onApprove,
  onReject,
  processing,
  showActions,
}: {
  distributor: Distributor;
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
            <h2 className="text-2xl font-bold">{distributor.business_name}</h2>
            <p className="text-sm text-gray-600 mt-1">Distributor Details</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Business Information */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Business Information</h3>
            <div className="space-y-2 text-sm">
              <DetailRow label="Business Name" value={distributor.business_name} />
              <DetailRow label="Address" value={distributor.business_address} />
              <DetailRow label="Phone" value={distributor.business_phone} />
              <DetailRow label="Email" value={distributor.business_email} />
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Contact Person</h3>
            <div className="space-y-2 text-sm">
              <DetailRow label="Name" value={distributor.contact_name} />
              <DetailRow label="Title" value={distributor.contact_title} />
              <DetailRow label="Email" value={distributor.contact_email} />
              {distributor.contact_phone && (
                <DetailRow label="Phone" value={distributor.contact_phone} />
              )}
            </div>
          </div>

          {/* Metadata */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Application Details</h3>
            <div className="space-y-2 text-sm">
              <DetailRow
                label="Status"
                value={
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      distributor.status === "pending"
                        ? "bg-orange-100 text-orange-700"
                        : distributor.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {distributor.status}
                  </span>
                }
              />
              <DetailRow
                label="Submitted"
                value={new Date(distributor.created_at).toLocaleString()}
              />
              {distributor.updated_at && (
                <DetailRow
                  label="Last Updated"
                  value={new Date(distributor.updated_at).toLocaleString()}
                />
              )}
              <DetailRow label="User ID" value={distributor.user_id} />
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
      <span className="font-medium w-32">{label}:</span>
      <span className="text-gray-700">{value}</span>
    </div>
  );
}

