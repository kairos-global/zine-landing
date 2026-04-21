import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Public profile page: /u/[handle]
// handle may be a username, or a profile UUID if no username is set.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Issue = {
  id: string;
  title: string | null;
  slug: string | null;
  cover_img_url: string | null;
  published_at: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string | null;
  email: string | null;
  clerk_id: string | null;
};

async function fetchProfile(handle: string): Promise<ProfileRow | null> {
  if (UUID_REGEX.test(handle)) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, created_at, email, clerk_id")
      .eq("id", handle)
      .maybeSingle();
    if (data) return data as ProfileRow;
  }
  // Fall back to username (case-insensitive)
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, created_at, email, clerk_id")
    .ilike("username", handle)
    .maybeSingle();
  return (data as ProfileRow) ?? null;
}

function formatJoinDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
}

function displayNameFor(p: ProfileRow): string {
  if (p.display_name) return p.display_name;
  if (p.username) return p.username;
  if (p.email) return p.email.split("@")[0];
  return "Zineground creator";
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const profile = await fetchProfile(handle);
  if (!profile) notFound();

  // Published zines for this profile
  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, slug, cover_img_url, published_at")
    .eq("profile_id", profile.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  // Badges
  const [mcRes, distRes] = await Promise.all([
    supabase
      .from("market_creators")
      .select("status")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    profile.clerk_id
      ? supabase
          .from("distributors")
          .select("status")
          .eq("user_id", profile.clerk_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const isPaidCreator = mcRes.data?.status === "approved";
  const isDistributor = distRes.data?.status === "approved";

  const name = displayNameFor(profile);
  const joined = formatJoinDate(profile.created_at);
  const publishedIssues = (issues ?? []) as Issue[];

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-4">
        <Link
          href="/browse-zines"
          className="text-sm text-gray-600 hover:underline"
        >
          ← Browse zines
        </Link>
      </div>

      {/* Header card */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex items-start gap-5">
          <div className="h-24 w-24 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-gray-400 text-xs text-center px-2">
                No picture
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-black">{name}</h1>
              {isDistributor && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-purple-100 text-purple-700 border-purple-300">
                  Distributor
                </span>
              )}
              {isPaidCreator && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-sky-100 text-sky-700 border-sky-300">
                  Paid Creator
                </span>
              )}
            </div>
            {profile.username && (
              <div className="text-sm text-gray-500">@{profile.username}</div>
            )}
            <div className="text-sm text-gray-500 mt-1">Joined {joined}</div>
          </div>
        </div>
      </div>

      {/* Zines */}
      <section>
        <h2 className="text-lg font-semibold mb-4">
          Published zines
          {publishedIssues.length > 0 && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({publishedIssues.length})
            </span>
          )}
        </h2>

        {publishedIssues.length === 0 ? (
          <p className="text-sm text-gray-500">
            {name} hasn&apos;t published any zines yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {publishedIssues.map((issue) => (
              <Link
                key={issue.id}
                href={issue.slug ? `/issues/${issue.slug}` : "#"}
                className="group rounded-xl overflow-hidden border border-gray-200 bg-white hover:border-black transition-colors"
              >
                <div className="aspect-square bg-gray-100 overflow-hidden">
                  {issue.cover_img_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={issue.cover_img_url}
                      alt={issue.title || "Zine cover"}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">
                      No cover
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-semibold truncate text-black">
                    {issue.title || "(Untitled)"}
                  </div>
                  {issue.published_at && (
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(issue.published_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
