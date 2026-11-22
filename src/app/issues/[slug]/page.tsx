import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteBaseUrl } from "@/lib/site-url";
import { readCollection, zineDb } from "@/lib/zine-reader-server";
import { zineCategoryLabel } from "@/lib/zine-categories";
import ReaderArtwork from "./ReaderArtwork";
import ReaderSidebar from "./ReaderSidebar";

const getIssue = cache(async (slug: string) => {
  const { data, error } = await zineDb.from("issues")
    .select("id, slug, title, pdf_url, cover_img_url, status, published_at, profile_id, category, zine_format")
    .eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const issue = await getIssue(slug);
  if (!issue || issue.status !== "published") return { title: "Zineground" };
  const title = issue.title || "Untitled zine";
  return {
    title: `${title} | Zineground`,
    openGraph: {
      title,
      url: `${getSiteBaseUrl()}/issues/${encodeURIComponent(slug)}`,
      ...(issue.cover_img_url ? { images: [issue.cover_img_url] } : {}),
    },
  };
}

export default async function IssuePage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; save?: string; recommend?: string }>;
}) {
  const [{ slug }, query, { userId }] = await Promise.all([params, searchParams, auth()]);
  const issue = await getIssue(slug);
  if (!issue || (issue.status !== "published" && (issue.status !== "draft" || !userId))) notFound();

  const [collected, creator] = await Promise.all([
    readCollection(userId, issue.id),
    issue.profile_id ? zineDb.from("profiles")
      .select("id, clerk_id, display_name, username, avatar_url")
      .eq("id", issue.profile_id).maybeSingle() : null,
  ]);
  if (creator?.error) throw creator.error;
  const author = creator?.data;
  const published = issue.status === "published";
  let artwork = issue;
  if (!published && userId !== author?.clerk_id) {
    if (!collected) notFound();
    const { data: edition, error } = await zineDb.from("kept_zine_editions")
      .select("title, cover_img_url, pdf_url, category, zine_format")
      .eq("issue_id", issue.id).maybeSingle();
    if (error) throw error;
    if (!edition) notFound();
    artwork = { ...issue, ...edition };
  }

  const title = artwork.title || "Untitled zine";
  const path = `/issues/${encodeURIComponent(issue.slug)}`;
  const category = zineCategoryLabel(artwork.category);

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 print:hidden">
      <Link href="/browse-zines" className="mb-3 inline-flex min-h-10 items-center text-sm underline">Back to zines</Link>
      <h1 className="mb-4 text-2xl font-semibold sm:text-3xl lg:max-w-3xl">{title}</h1>
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <ReaderArtwork pdfUrl={artwork.pdf_url} cover={artwork.cover_img_url} title={title}
          format={artwork.zine_format} initialView={query.view === "top" ? "top" : "mapped"} />
        <ReaderSidebar key={issue.id} issueId={issue.id} title={title} slug={issue.slug} path={path}
          url={`${getSiteBaseUrl()}${path}`} published={published} collected={collected} signedIn={Boolean(userId)}
          forceSave={query.save === "1"} forceRecommend={query.recommend === "1"} category={category}
          author={author ? { name: author.display_name || author.username || "Zineground creator", handle: author.username || author.id, avatar: author.avatar_url } : null} />
      </div>
    </main>
  );
}
