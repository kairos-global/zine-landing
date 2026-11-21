"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONTACT_TOPICS, type ContactRequest, type ContactStatus } from "@/lib/contact";

type InboxRequest = ContactRequest & {
  created_at: string;
  status: ContactStatus;
  notification_status: "pending" | "failed" | "sent" | "unconfigured";
};

const statusLabels: Record<ContactStatus, string> = {
  new: "New", in_progress: "In progress", resolved: "Resolved",
};
const mailLabels = { pending: "Pending", failed: "Delivery failed", sent: "Sent", unconfigured: "Setup required" };

export default function ContactInbox({ initialRequest }: { initialRequest: string }) {
  const [items, setItems] = useState<InboxRequest[]>([]);
  const [status, setStatus] = useState("");
  const [requestId, setRequestId] = useState(initialRequest);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (requestId) params.set("request", requestId);
    setLoading(true);
    setError("");
    fetch(`/api/admin/contact?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setItems(data.requests);
        setHasNext(data.hasNext);
      })
      .catch((failure) => { if (!controller.signal.aborted) { setItems([]); setHasNext(false); setError(failure.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [requestId, status, page, refresh]);

  async function update(item: InboxRequest, next: ContactStatus) {
    setSaving(item.id);
    setError("");
    try {
      const response = await fetch("/api/admin/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: next, previousStatus: item.status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (status && status !== next) setRefresh((count) => count + 1);
      else setItems((previous) => previous.map((entry) => entry.id === item.id ? data.request : entry));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The request could not be updated.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <main className="zg-page px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link className="text-sm font-bold underline" href="/dashboard/admin">← Admin</Link>
        <h1 className="zg-title mt-3">Contact inbox</h1>
        <div className="my-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold">Status
            <select className="zg-input" value={status} disabled={!!requestId} onChange={(event) => { setStatus(event.target.value); setPage(0); }}>
              <option value="">All requests</option>
              {Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
            </select>
          </label>
          <button className="zg-button" onClick={() => setRefresh((count) => count + 1)}>Refresh</button>
          {requestId && <Link href="/dashboard/admin/contact" className="zg-button" onClick={() => setRequestId("")}>All requests</Link>}
        </div>
        {error && <p className="mb-4 text-red-800" role="alert">{error}</p>}
        {loading && <p role="status">Loading requests…</p>}
        {!loading && !items.length && !error && <p>No requests found.</p>}
        {!loading && (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="zg-panel p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black">{CONTACT_TOPICS[item.topic].label}</h2>
                    <p className="break-all text-sm">{item.name} · {item.email}</p>
                    <p className="mt-1 text-xs text-black/65">{new Date(item.created_at).toLocaleString()} · {item.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold">Status
                    <select className="zg-input" value={item.status} disabled={saving !== null} onChange={(event) => update(item, event.target.value as ContactStatus)}>
                      {Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
                    </select>
                  </label>
                </div>
                {item.reference && <p className="mt-3 break-words text-sm"><strong>Reference</strong> · {item.reference}</p>}
                <p className="my-4 whitespace-pre-wrap break-words text-sm">{item.message}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <a className="zg-button" href={`mailto:${item.email}?subject=${encodeURIComponent(`Re: [Zineground] ${CONTACT_TOPICS[item.topic].label} / ${item.id.slice(0, 8).toUpperCase()}`)}`}>Reply by email ↗</a>
                  <span className="text-xs font-bold">Gmail · {mailLabels[item.notification_status]}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && (page > 0 || hasNext) && <div className="mt-4 flex gap-2">
          <button className="zg-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="zg-button" disabled={!hasNext} onClick={() => setPage(page + 1)}>Next</button>
        </div>}
      </div>
    </main>
  );
}
