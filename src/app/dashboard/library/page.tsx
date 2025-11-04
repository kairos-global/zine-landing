"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

type Issue = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  cover_img_url: string | null;
  pdf_url: string | null;
  published_at: string | null;
  created_at: string | null;
};

export default function LibraryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [drafts, setDrafts] = useState<Issue[]>([]);
  const [published, setPublished] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.push("/sign-in");
      return;
    }

    async function fetchIssues() {
      if (!user) return;
      
      try {
        console.log("📚 [Library] Fetching library data...");
        
        const response = await fetch("/api/library");
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error("❌ [Library] API error:", errorData);
          setLoading(false);
          return;
        }

        const data = await response.json();
        console.log("✅ [Library] Received data:", data);

        const issues = data.issues || [];
        const draftIssues = issues.filter((i: Issue) => i.status === "draft");
        const publishedIssues = issues.filter((i: Issue) => i.status === "published");

        console.log("✅ [Library] Drafts:", draftIssues.length, "Published:", publishedIssues.length);

        setDrafts(draftIssues);
        setPublished(publishedIssues);
        setLoading(false);
      } catch (err) {
        console.error("❌ [Library] Unexpected error:", err);
        setLoading(false);
      }
    }

    fetchIssues();
  }, [isLoaded, user, router]);

  if (!isLoaded || loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your library...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Library</h1>
        <p className="text-gray-600">Manage your zine drafts and published issues</p>
      </div>

          {/* Drafts Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="text-yellow-600">📝</span> Drafts
            {drafts.length > 0 && (
              <span className="text-sm font-normal text-gray-500">({drafts.length})</span>
            )}
          </h2>
                      <button
            onClick={() => router.push("/zinemat")}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition text-sm font-medium"
                      >
            + Create New Zine
                      </button>
                    </div>

        {drafts.length === 0 ? (
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-dashed border-yellow-300 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">✍️</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No drafts yet</h3>
            <p className="text-gray-600 mb-6">Start creating your first zine!</p>
            <button
              onClick={() => router.push("/zinemat")}
              className="bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition font-medium"
            >
              Go to ZineMat
            </button>
                  </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {drafts.map((issue) => (
              <IssueCard key={issue.id} issue={issue} router={router} isDraft />
                ))}
              </div>
            )}
          </section>

          {/* Published Section */}
          <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="text-green-600"></span> Published
            {published.length > 0 && (
              <span className="text-sm font-normal text-gray-500">({published.length})</span>
            )}
          </h2>
        </div>

            {published.length === 0 ? (
          <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-dashed border-green-300 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No published issues yet</h3>
            <p className="text-gray-600">Publish your first zine to share it with the world!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {published.map((issue) => (
              <IssueCard key={issue.id} issue={issue} router={router} />
            ))}
                      </div>
        )}
      </section>
                    </div>
  );
}

function IssueCard({
  issue,
  router,
  isDraft = false,
}: {
  issue: Issue;
  router: ReturnType<typeof useRouter>;
  isDraft?: boolean;
}) {
  return (
    <div className="group rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col">
      {/* Cover Image */}
      <div className="relative aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        {issue.cover_img_url ? (
          <img
            src={issue.cover_img_url}
            alt={issue.title || "Zine cover"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-5xl mb-2">📄</div>
              <p className="text-sm">No cover</p>
            </div>
          </div>
        )}
        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full shadow-sm ${
              isDraft ? "bg-yellow-500 text-white" : "bg-green-500 text-white"
            }`}
          >
            {isDraft ? "Draft" : "Published"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        {/* Title */}
        <h3 className="font-bold text-lg mb-2 line-clamp-2 flex-1">
          {issue.title || "(Untitled)"}
        </h3>

        {/* Date */}
        <p className="text-xs text-gray-500 mb-4">
          {isDraft
            ? `Created ${new Date(issue.created_at!).toLocaleDateString()}`
            : `Published ${new Date(issue.published_at!).toLocaleDateString()}`}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
                        <button
            onClick={() => router.push(`/zinemat?id=${issue.id}`)}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium text-sm transition"
                        >
             Edit
                        </button>
          {!isDraft && issue.slug && (
                      <button
              onClick={() => router.push(`/issues/${issue.slug}`)}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition"
                      >
               View
                      </button>
          )}
                    </div>
                  </div>
    </div>
  );
}
