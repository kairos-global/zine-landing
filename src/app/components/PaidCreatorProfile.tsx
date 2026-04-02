"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export type MarketMeProfile = {
  approved: boolean;
  status?: "none" | "pending" | "approved" | "rejected";
  marketCreatorId?: string;
  profile?: {
    displayName: string | null;
    profileImageUrl: string | null;
    portfolioUrl: string | null;
    portfolioImageUrls: string[];
  } | null;
};

type Props = {
  marketMe: MarketMeProfile | null;
  onUpdate: () => void;
  showApplyCta?: boolean;
  onGoToApply?: () => void;
  /** "view" = read-only card with Edit button linking to Creator Portal; "edit" = full form */
  mode?: "view" | "edit";
};

export function PaidCreatorProfile({ marketMe, onUpdate, showApplyCta, onGoToApply, mode = "edit" }: Props) {
  const [displayName, setDisplayName] = useState(marketMe?.profile?.displayName ?? "");
  const [profileImageUrl, setProfileImageUrl] = useState(marketMe?.profile?.profileImageUrl ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(marketMe?.profile?.portfolioUrl ?? "");
  const [portfolioImageUrls, setPortfolioImageUrls] = useState<string[]>(
    marketMe?.profile?.portfolioImageUrls?.slice(0, 5) ?? []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (marketMe?.profile) {
      setDisplayName(marketMe.profile.displayName ?? "");
      setProfileImageUrl(marketMe.profile.profileImageUrl ?? "");
      setPortfolioUrl(marketMe.profile.portfolioUrl ?? "");
      setPortfolioImageUrls(marketMe.profile.portfolioImageUrls?.slice(0, 5) ?? []);
    }
  }, [marketMe?.profile]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);

  if (marketMe?.status === "none" && !marketMe?.marketCreatorId) {
    return (
      <div className="p-4 text-sm text-gray-600">
        <p className="mb-2">You’re not a paid creator yet.</p>
        {showApplyCta && onGoToApply && (
          <button
            type="button"
            onClick={onGoToApply}
            className="text-blue-600 hover:underline font-medium"
          >
            Apply to sell on the Market →
          </button>
        )}
      </div>
    );
  }

  if (marketMe?.status === "pending") {
    return (
      <div className="p-4 text-sm text-gray-600">
        <p className="font-medium text-amber-700">Application pending</p>
        <p className="mt-1">We’re reviewing your application. Once approved, you can edit your profile and list services here.</p>
      </div>
    );
  }

  if (marketMe?.status === "rejected") {
    return (
      <div className="p-4 text-sm text-gray-600">
        <p className="font-medium text-red-700">Application declined</p>
        <p className="mt-1">Your paid creator application was not approved. Contact support for details.</p>
      </div>
    );
  }

  if (!marketMe?.approved) {
    return (
      <div className="p-4 text-sm text-gray-600">
        <p>Load your profile to edit it here.</p>
      </div>
    );
  }

  // Read-only view for Market Sell panel: profile card + Edit button → Creator Portal
  if (mode === "view") {
    const p = marketMe.profile;
    const name = p?.displayName?.trim() || "Paid Creator";
    const portfolioUrl = p?.portfolioUrl?.trim() || null;
    const portfolioImageUrls = p?.portfolioImageUrls?.slice(0, 5) ?? [];
    return (
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-4">
          <h3 className="font-semibold text-gray-900">Your profile</h3>
          <Link
            href="/dashboard/creator?tab=market-orders"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline shrink-0"
          >
            Edit
          </Link>
        </div>
        <div className="flex flex-col items-center text-center">
          {p?.profileImageUrl ? (
            <img
              src={p.profileImageUrl}
              alt=""
              className="w-24 h-24 rounded-full object-cover border border-gray-200 mb-3"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-lg font-medium mb-3">
              {name[0].toUpperCase()}
            </div>
          )}
          <p className="font-semibold text-gray-900">{name}</p>
          {portfolioUrl && (
            <a
              href={portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline mt-1 break-all"
            >
              Portfolio
            </a>
          )}
        </div>
        {portfolioImageUrls.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Portfolio</p>
            <div className="grid grid-cols-3 gap-2">
              {portfolioImageUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleUpload = async (file: File, isProfile: boolean) => {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const res = await fetch("/api/market/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (isProfile) setProfileImageUrl(data.url);
      else setPortfolioImageUrls((prev) => [...prev.slice(0, 4), data.url].slice(0, 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removePortfolioImage = (index: number) => {
    setPortfolioImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/market/creator-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          profileImageUrl: profileImageUrl.trim() || null,
          portfolioUrl: portfolioUrl.trim() || null,
          portfolioImageUrls,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">Paid Creator Profile</h3>
      <p className="text-xs text-gray-500">This is how you appear in the Purchase section. Name, photo, and portfolio help buyers choose you.</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Display name / username</label>
        <input
          type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. Alex Designs"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Profile picture</label>
        <input
          ref={profileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f, true);
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-3">
          {profileImageUrl ? (
            <img src={profileImageUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-gray-200" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">Photo</div>
          )}
          <button
            type="button"
            onClick={() => profileInputRef.current?.click()}
            disabled={uploading}
            className="text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload photo"}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio or website URL</label>
        <input
          type="url"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="https://…"
          value={portfolioUrl}
          onChange={(e) => setPortfolioUrl(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio images (1–5)</label>
        <input
          ref={portfolioInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && portfolioImageUrls.length < 5) handleUpload(f, false);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2 mb-2">
          {portfolioImageUrls.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt={`Portfolio ${i + 1}`} className="w-16 h-16 rounded object-cover border border-gray-200" />
              <button
                type="button"
                onClick={() => removePortfolioImage(i)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
          {portfolioImageUrls.length < 5 && (
            <button
              type="button"
              onClick={() => portfolioInputRef.current?.click()}
              disabled={uploading}
              className="w-16 h-16 rounded border-2 border-dashed border-gray-300 text-gray-500 text-xs hover:border-gray-400 disabled:opacity-50"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
