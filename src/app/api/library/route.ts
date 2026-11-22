import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateProfileId } from "@/lib/profile";
import { zineDb } from "@/lib/zine-reader-server";

export const dynamic = "force-dynamic";

type CollectionEntry = {
  issue: {
    id: string; title: string | null; slug: string; cover_img_url: string | null; status: string;
    kept: { title: string | null; cover_img_url: string | null } | null;
  };
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Sign in to see your library." }, { status: 401 });

    const profileId = await getOrCreateProfileId(userId);
    const [owned, collected] = await Promise.all([
      zineDb.from("issues").select("id,title,slug,status,cover_img_url,published_at").eq("profile_id", profileId)
        .in("status", ["draft", "published"]).order("created_at", { ascending: false }),
      zineDb.from("collections").select("issue:issues!inner(id,title,slug,cover_img_url,status,kept:kept_zine_editions(title,cover_img_url))")
        .eq("profile_id", profileId).order("collected_at", { ascending: false }).returns<CollectionEntry[]>(),
    ]);
    if (owned.error || collected.error) throw owned.error ?? collected.error;

    return NextResponse.json({
      issues: owned.data!.map(({ published_at, ...issue }) => ({ ...issue, wasPublished: Boolean(published_at) || issue.status === "published" })),
      collectedIssues: collected.data!.flatMap(({ issue }) => {
        const edition = issue.status === "published" ? issue : issue.kept;
        if (!edition) return [];
        return [{ id: issue.id, title: edition.title, slug: issue.slug, cover_img_url: edition.cover_img_url }];
      }),
    });
  } catch (error) {
    console.error("[Library]", error);
    return NextResponse.json({ error: "Couldn’t open your library." }, { status: 500 });
  }
}
