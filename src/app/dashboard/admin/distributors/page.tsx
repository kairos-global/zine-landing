"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/useAdmin";
import toast from "react-hot-toast";

// ── Types ───────────────────────────────────────────────────────────────────

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
  lat?: number | null;
  lng?: number | null;
  verified_address?: string | null;
  address_verified_at?: string | null;
};

type GeoSuggestion = {
  id: string;
  label: string;
  lat: number | null;
  lng: number | null;
};

type TabType = "pending" | "approved" | "rejected";

// ── Main page ───────────────────────────────────────────────────────────────

export default function AdminDistributorsPage() {
  const router = useRouter();
  const { isAdmin: userIsAdmin, loading: adminLoading } = useAdmin();
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);
  const [verifyDistributor, setVerifyDistributor] = useState<Distributor | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!adminLoading && !userIsAdmin) {
      router.push("/dashboard");
    }
  }, [adminLoading, userIsAdmin, router]);

  useEffect(() => {
    fetchDistributors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        fetchDistributors();
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

  async function handleAddressVerified(distributorId: string) {
    setVerifyDistributor(null);
    fetchDistributors();
    // Also sync the detail modal if it's open for this distributor
    if (selectedDistributor?.id === distributorId) {
      setSelectedDistributor(null);
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
            <p className="text-gray-600">No {activeTab} distributors found</p>
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
                onVerifyAddress={() => setVerifyDistributor(distributor)}
                processing={processingId === distributor.id}
                showActions={activeTab === "pending"}
                showVerify={activeTab === "approved"}
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
            onVerifyAddress={() => {
              setSelectedDistributor(null);
              setVerifyDistributor(selectedDistributor);
            }}
            processing={processingId === selectedDistributor.id}
            showActions={activeTab === "pending"}
            showVerify={activeTab === "approved"}
          />
        )}

        {/* Verify Address Modal */}
        {verifyDistributor && (
          <VerifyAddressModal
            distributor={verifyDistributor}
            onClose={() => setVerifyDistributor(null)}
            onVerified={() => handleAddressVerified(verifyDistributor.id)}
          />
        )}
      </div>
    </div>
  );
}

// ── Tab button ───────────────────────────────────────────────────────────────

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

// ── Distributor card ─────────────────────────────────────────────────────────

function DistributorCard({
  distributor,
  onViewDetails,
  onApprove,
  onReject,
  onVerifyAddress,
  processing,
  showActions,
  showVerify,
}: {
  distributor: Distributor;
  onViewDetails: () => void;
  onApprove: () => void;
  onReject: () => void;
  onVerifyAddress: () => void;
  processing: boolean;
  showActions: boolean;
  showVerify: boolean;
}) {
  const statusColors = {
    pending: "bg-orange-100 text-orange-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  const isMapped = distributor.lat != null && distributor.lng != null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-lg font-semibold">{distributor.business_name}</h3>
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${
                statusColors[distributor.status]
              }`}
            >
              {distributor.status}
            </span>
            {showVerify && (
              <span
                className={`px-2 py-1 text-xs font-medium rounded ${
                  isMapped
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {isMapped ? "Mapped" : "Not mapped"}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">{distributor.business_address}</p>
          {showVerify && distributor.verified_address && (
            <p className="text-xs text-purple-600 mt-1">
              Verified: {distributor.verified_address}
            </p>
          )}
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

      <div className="flex gap-3 flex-wrap">
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

        {showVerify && (
          <button
            onClick={onVerifyAddress}
            className={`px-4 py-2 text-sm rounded-lg transition border-2 font-medium ${
              isMapped
                ? "border-purple-400 text-purple-700 bg-purple-50 hover:bg-purple-100"
                : "border-black bg-[#D16FF2] text-black hover:bg-[#c060e0]"
            }`}
          >
            {isMapped ? "Update Location" : "Verify & Map"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Detail modal ─────────────────────────────────────────────────────────────

function DistributorModal({
  distributor,
  onClose,
  onApprove,
  onReject,
  onVerifyAddress,
  processing,
  showActions,
  showVerify,
}: {
  distributor: Distributor;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onVerifyAddress: () => void;
  processing: boolean;
  showActions: boolean;
  showVerify: boolean;
}) {
  const isMapped = distributor.lat != null && distributor.lng != null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{distributor.business_name}</h2>
            <p className="text-sm text-gray-600 mt-1">Distributor Details</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
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

          {/* Map Status */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Map Location</h3>
            <div className="space-y-2 text-sm">
              <DetailRow
                label="Status"
                value={
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      isMapped ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {isMapped ? "Mapped" : "Not yet mapped"}
                  </span>
                }
              />
              {distributor.verified_address && (
                <DetailRow label="Verified Address" value={distributor.verified_address} />
              )}
              {distributor.lat != null && distributor.lng != null && (
                <DetailRow
                  label="Coordinates"
                  value={`${distributor.lat.toFixed(5)}, ${distributor.lng.toFixed(5)}`}
                />
              )}
              {distributor.address_verified_at && (
                <DetailRow
                  label="Mapped on"
                  value={new Date(distributor.address_verified_at).toLocaleString()}
                />
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
              <DetailRow label="Submitted" value={new Date(distributor.created_at).toLocaleString()} />
              {distributor.updated_at && (
                <DetailRow label="Last Updated" value={new Date(distributor.updated_at).toLocaleString()} />
              )}
              <DetailRow label="User ID" value={distributor.user_id} />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end flex-wrap">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Close
          </button>

          {showVerify && (
            <button
              onClick={onVerifyAddress}
              className={`px-4 py-2 rounded-lg transition border-2 font-medium text-sm ${
                isMapped
                  ? "border-purple-400 text-purple-700 bg-purple-50 hover:bg-purple-100"
                  : "border-black bg-[#D16FF2] text-black hover:bg-[#c060e0]"
              }`}
            >
              {isMapped ? "Update Location" : "Verify & Map"}
            </button>
          )}

          {showActions && (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Verify Address modal ─────────────────────────────────────────────────────

function VerifyAddressModal({
  distributor,
  onClose,
  onVerified,
}: {
  distributor: Distributor;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [query, setQuery] = useState(distributor.business_address ?? "");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [selected, setSelected] = useState<GeoSuggestion | null>(
    distributor.lat != null && distributor.lng != null && distributor.verified_address
      ? {
          id: "existing",
          label: distributor.verified_address,
          lat: distributor.lat,
          lng: distributor.lng,
        }
      : null
  );
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(val: string) {
    setQuery(val);
    setSelected(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `/api/geocode/suggest?query=${encodeURIComponent(val)}&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions ?? []);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 350);
  }

  function handleSelect(s: GeoSuggestion) {
    setSelected(s);
    setQuery(s.label);
    setSuggestions([]);
  }

  async function handleSave() {
    if (!selected || selected.lat == null || selected.lng == null) {
      toast.error("Please select a verified address from the suggestions");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/distributors/${distributor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: selected.lat,
          lng: selected.lng,
          verified_address: selected.label,
        }),
      });

      if (res.ok) {
        toast.success("Address verified and pin placed on map");
        onVerified();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save address");
      }
    } catch {
      toast.error("Failed to save address");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">Verify & Map Location</h2>
            <p className="text-sm text-gray-600 mt-1">{distributor.business_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Registered address for reference */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Registered address (from application)
            </p>
            <p className="text-gray-800">{distributor.business_address}</p>
          </div>

          {/* Geocode search */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Verified address
              <span className="font-normal text-gray-500 ml-1">
                — search to find the exact location
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Start typing an address..."
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#D16FF2] transition"
              />
              {loadingSuggestions && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  Searching...
                </div>
              )}
            </div>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="mt-1 border-2 border-gray-200 rounded-lg overflow-hidden shadow-md">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelect(s)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-purple-50 hover:text-purple-800 border-b border-gray-100 last:border-0 transition"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Confirmed selection preview */}
          {selected && selected.lat != null && selected.lng != null && (
            <div className="rounded-lg border-2 border-[#D16FF2] bg-purple-50 px-4 py-4">
              <div className="flex items-start gap-3">
                {/* Purple pin icon */}
                <div
                  className="mt-0.5 shrink-0 rounded-full border-2 border-black"
                  style={{
                    width: 18,
                    height: 18,
                    background: "#D16FF2",
                    boxShadow: "0 2px 0 rgba(0,0,0,0.2)",
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-purple-900">{selected.label}</p>
                  <p className="text-xs text-purple-600 mt-1">
                    {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                  </p>
                  <p className="text-xs text-purple-500 mt-2">
                    A purple pin will appear at this location on the map.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info note if nothing selected yet */}
          {!selected && (
            <p className="text-xs text-gray-500">
              Search for the address above and select a result to set the exact map coordinates.
              Once confirmed, a purple pin will appear on the Zineground map for this distributor.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selected || selected.lat == null}
            className="px-5 py-2 border-2 border-black bg-[#D16FF2] text-black rounded-lg font-semibold text-sm hover:bg-[#c060e0] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Confirm & Map"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail row helper ────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="flex">
      <span className="font-medium w-36">{label}:</span>
      <span className="text-gray-700">{value}</span>
    </div>
  );
}
