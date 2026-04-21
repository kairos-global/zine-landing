"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

type Issue = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  cover_img_url: string | null;
  published_at: string | null;
  created_at: string | null;
};

type BadgeStatus = "none" | "pending" | "approved" | "rejected";

type ProfileData = {
  profile: {
    id: string;
    email: string | null;
    role: string | null;
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
    createdAt: string | null;
  };
  badges: {
    paidCreatorStatus: BadgeStatus;
    distributorStatus: BadgeStatus;
  };
};

function formatJoinDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DashboardProfilePage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<Issue[]>([]);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      setLoading(true);
      try {
        const [profileRes, libRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/library"),
        ]);

        if (profileRes.ok) {
          const p: ProfileData = await profileRes.json();
          setData(p);
          setDisplayName(p.profile.displayName ?? "");
          setUsername(p.profile.username ?? "");
          setAvatarUrl(p.profile.avatarUrl ?? null);
        }

        if (libRes.ok) {
          const lib = await libRes.json();
          const published = (lib.issues ?? []).filter(
            (i: Issue) => i.status === "published"
          );
          setIssues(published);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn]);

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatusMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/profile/upload", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Upload failed");
      setAvatarUrl(body.url);
      // Save avatarUrl immediately
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: body.url }),
      });
      setStatusMsg({ kind: "ok", text: "Profile picture updated." });
    } catch (err) {
      setStatusMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          username: username.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Save failed");
      setStatusMsg({ kind: "ok", text: "Profile saved." });
      // Re-fetch to reflect any server-side normalization
      const fresh = await fetch("/api/profile");
      if (fresh.ok) {
        const p: ProfileData = await fresh.json();
        setData(p);
        setDisplayName(p.profile.displayName ?? "");
        setUsername(p.profile.username ?? "");
      }
    } catch (err) {
      setStatusMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded || loading || !data) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 text-gray-600">Loading…</div>
    );
  }

  const handle = data.profile.username || data.profile.id;
  const joined = formatJoinDate(data.profile.createdAt);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-4">
        <Link href="/dashboard" className="text-sm text-gray-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-black mb-2">Profile</h1>
      <p className="text-gray-600 mb-8">
        This is what the rest of Zineground sees when they visit your page.
      </p>

      {/* Avatar + identity row */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center">
            <div className="h-24 w-24 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-gray-400 text-xs text-center px-2">
                  No picture yet
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarFile}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-3 text-xs rounded-md border border-black bg-white text-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-50"
            >
              {uploading ? "Uploading…" : avatarUrl ? "Change" : "Upload"}
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xl font-semibold text-black">
                {displayName || <span className="text-gray-400">Your name</span>}
              </span>
              <StatusBadges badges={data.badges} />
            </div>
            <div className="text-sm text-gray-500">
              {username ? `@${username}` : <span className="italic">No username set</span>}
            </div>
            <div className="text-sm text-gray-500 mt-1">Joined {joined}</div>
            <div className="mt-3">
              <Link
                href={`/u/${handle}`}
                className="text-sm text-blue-600 hover:underline"
              >
                View public profile →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Edit profile</h2>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Display name
        </label>
        <input
          type="text"
          value={displayName}
          maxLength={60}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Zineground Studio"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none mb-4"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Username <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <div className="flex items-center rounded-md border border-gray-300 focus-within:border-black overflow-hidden mb-1">
          <span className="px-3 py-2 text-sm text-gray-500 bg-gray-50 border-r border-gray-300">
            /u/
          </span>
          <input
            type="text"
            value={username}
            maxLength={30}
            onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
            placeholder="your_handle"
            className="flex-1 px-3 py-2 text-sm focus:outline-none"
          />
        </div>
        <p className="text-xs text-gray-500 mb-4">
          3–30 characters. Letters, numbers, and underscores only. Leave blank to use your profile ID.
        </p>

        {statusMsg && (
          <div
            className={`text-sm mb-3 ${
              statusMsg.kind === "ok" ? "text-green-600" : "text-red-600"
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md border border-black bg-black text-white px-4 py-2 text-sm font-medium hover:bg-white hover:text-black transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Status breakdown */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Account statuses</h2>
        <div className="space-y-2 text-sm">
          <StatusRow
            label="Distributor"
            status={data.badges.distributorStatus}
            ctaLabel="Apply to distribute"
            ctaHref="/dashboard/distributor"
          />
          <StatusRow
            label="Paid Creator"
            status={data.badges.paidCreatorStatus}
            ctaLabel="Apply in Market"
            ctaHref="/dashboard/market"
          />
        </div>
      </div>

      {/* Published zines */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-3">Your published zines</h2>
        {issues.length === 0 ? (
          <p className="text-sm text-gray-500">
            You haven&apos;t published any zines yet.{" "}
            <Link href="/zinemat" className="text-blue-600 hover:underline">
              Make one
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {issues.map((issue) => (
              <Link
                key={issue.id}
                href={issue.slug ? `/issues/${issue.slug}` : "#"}
                className="block rounded-lg overflow-hidden border border-gray-200 hover:border-black transition-colors"
              >
                <div className="aspect-square bg-gray-100 overflow-hidden">
                  {issue.cover_img_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={issue.cover_img_url}
                      alt={issue.title || "Zine cover"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">
                      No cover
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-sm font-medium truncate text-black">
                    {issue.title || "(Untitled)"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadges({ badges }: { badges: ProfileData["badges"] }) {
  const pills: { text: string; color: string }[] = [];
  if (badges.distributorStatus === "approved") {
    pills.push({ text: "Distributor", color: "bg-purple-100 text-purple-700 border-purple-300" });
  }
  if (badges.paidCreatorStatus === "approved") {
    pills.push({ text: "Paid Creator", color: "bg-sky-100 text-sky-700 border-sky-300" });
  }
  if (pills.length === 0) return null;
  return (
    <>
      {pills.map((p) => (
        <span
          key={p.text}
          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${p.color}`}
        >
          {p.text}
        </span>
      ))}
    </>
  );
}

function StatusRow({
  label,
  status,
  ctaLabel,
  ctaHref,
}: {
  label: string;
  status: BadgeStatus;
  ctaLabel: string;
  ctaHref: string;
}) {
  const statusStyles: Record<BadgeStatus, { text: string; className: string }> = {
    none: { text: "Not applied", className: "bg-gray-100 text-gray-600" },
    pending: { text: "Pending review", className: "bg-amber-100 text-amber-700" },
    approved: { text: "Approved", className: "bg-green-100 text-green-700" },
    rejected: { text: "Rejected", className: "bg-red-100 text-red-700" },
  };
  const s = statusStyles[status];
  return (
    <div className="flex items-center justify-between gap-3 border border-gray-100 rounded-md px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="font-medium text-black">{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${s.className}`}>
          {s.text}
        </span>
      </div>
      {status === "none" && (
        <Link href={ctaHref} className="text-sm text-blue-600 hover:underline">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
