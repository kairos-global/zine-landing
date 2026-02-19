import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateProfileId } from "@/lib/profile";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type AnalyticsIssue = {
  id: string;
  title: string | null;
  slug: string | null;
  cover_img_url: string | null;
  totalScans: number;
  links: { linkId: string; label: string | null; url: string | null; scans: number }[];
};

export type RecentScan = {
  id: string;
  issue_id: string;
  link_id: string;
  issueTitle: string | null;
  linkLabel: string | null;
  scanned_at: string | null;
  user_agent: string | null;
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await getOrCreateProfileId(userId);

    // 1) User's issues
    const { data: issues, error: issuesError } = await supabase
      .from("issues")
      .select("id, title, slug, cover_img_url")
      .eq("profile_id", profileId);

    if (issuesError) {
      console.error("[Analytics] Issues error:", issuesError);
      return NextResponse.json(
        { error: "Failed to fetch issues", details: issuesError },
        { status: 500 }
      );
    }

    const issueIds = (issues ?? []).map((i) => i.id);
    if (issueIds.length === 0) {
      return NextResponse.json({
        totalScans: 0,
        issues: [],
        recentScans: [],
      });
    }

    // 2) All scans for these issues (one row per scan; scanned_at = when it happened)
    const { data: scans, error: scansError } = await supabase
      .from("qr_scans")
      .select("id, issue_id, link_id, scanned_at, user_agent")
      .in("issue_id", issueIds)
      .order("scanned_at", { ascending: false });

    if (scansError) {
      console.error("[Analytics] Scans error:", scansError);
      return NextResponse.json(
        {
          error: "Failed to fetch scans",
          details: scansError.message,
          code: scansError.code,
        },
        { status: 500 }
      );
    }

    const scansList = scans ?? [];

    // 3) Links for these issues (for labels)
    const { data: links, error: linksError } = await supabase
      .from("issue_links")
      .select("id, issue_id, label, url")
      .in("issue_id", issueIds);

    if (linksError) {
      console.error("[Analytics] Links error:", linksError);
    }

    const linkMap = new Map<string, { issue_id: string; label: string | null; url: string | null }>();
    (links ?? []).forEach((l) => linkMap.set(l.id, { issue_id: l.issue_id, label: l.label, url: l.url ?? null }));
    const issueTitleMap = new Map<string, string | null>();
    (issues ?? []).forEach((i) => issueTitleMap.set(i.id, i.title));

    // Aggregate by issue and by link
    const scanCountByIssue = new Map<string, number>();
    const scanCountByLink = new Map<string, number>();
    scansList.forEach((s) => {
      scanCountByIssue.set(s.issue_id, (scanCountByIssue.get(s.issue_id) ?? 0) + 1);
      scanCountByLink.set(s.link_id, (scanCountByLink.get(s.link_id) ?? 0) + 1);
    });

    const issueLinkIds = new Map<string, Set<string>>();
    (links ?? []).forEach((l) => {
      if (!issueLinkIds.has(l.issue_id)) issueLinkIds.set(l.issue_id, new Set());
      issueLinkIds.get(l.issue_id)!.add(l.id);
    });

    const analyticsIssues: AnalyticsIssue[] = (issues ?? []).map((issue) => {
      const linkIds = issueLinkIds.get(issue.id);
      const linkList = linkIds
        ? Array.from(linkIds).map((linkId) => ({
            linkId,
            label: linkMap.get(linkId)?.label ?? null,
            url: linkMap.get(linkId)?.url ?? null,
            scans: scanCountByLink.get(linkId) ?? 0,
          }))
        : [];
      const totalScans = scanCountByIssue.get(issue.id) ?? 0;
      return {
        id: issue.id,
        title: issue.title,
        slug: issue.slug,
        cover_img_url: issue.cover_img_url ?? null,
        totalScans,
        links: linkList,
      };
    });

    const recentScans: RecentScan[] = scansList.slice(0, 50).map((s) => ({
      id: s.id,
      issue_id: s.issue_id,
      link_id: s.link_id,
      issueTitle: issueTitleMap.get(s.issue_id) ?? null,
      linkLabel: linkMap.get(s.link_id)?.label ?? null,
      scanned_at: s.scanned_at ?? null,
      user_agent: s.user_agent ?? null,
    }));

    const totalScans = scansList.length;

    return NextResponse.json({
      totalScans,
      issues: analyticsIssues,
      recentScans,
    });
  } catch (error) {
    console.error("[Analytics] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
