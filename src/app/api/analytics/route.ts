import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateProfileId } from "@/lib/profile";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ScanCountByDay = { date: string; count: number }[];

export type AnalyticsIssue = {
  id: string;
  title: string | null;
  slug: string | null;
  cover_img_url: string | null;
  totalScans: number;
  scanCountByDay: ScanCountByDay;
  links: { linkId: string; label: string | null; url: string | null; scans: number }[];
};

export type QrCodeAnalytics = {
  linkId: string;
  label: string | null;
  url: string | null;
  qr_path: string | null;
  issueId: string;
  issueTitle: string | null;
  issueSlug: string | null;
  scans: number;
  scanCountByDay: ScanCountByDay;
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
        qrCodes: [],
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
      .select("id, issue_id, label, url, qr_path")
      .in("issue_id", issueIds);

    if (linksError) {
      console.error("[Analytics] Links error:", linksError);
    }

    const linkMap = new Map<string, { issue_id: string; label: string | null; url: string | null; qr_path: string | null }>();
    (links ?? []).forEach((l) => linkMap.set(l.id, { issue_id: l.issue_id, label: l.label, url: l.url ?? null, qr_path: l.qr_path ?? null }));
    const issueTitleMap = new Map<string, string | null>();
    (issues ?? []).forEach((i) => issueTitleMap.set(i.id, i.title));

    // Aggregate by issue and by link
    const scanCountByIssue = new Map<string, number>();
    const scanCountByLink = new Map<string, number>();
    const byIssueByDay = new Map<string, Map<string, number>>();
    const byLinkByDay = new Map<string, Map<string, number>>();

    scansList.forEach((s) => {
      const raw = s.scanned_at;
      const day = raw && typeof raw === "string" ? raw.slice(0, 10) : "";
      if (!day || day.length < 10) return;
      scanCountByIssue.set(s.issue_id, (scanCountByIssue.get(s.issue_id) ?? 0) + 1);
      scanCountByLink.set(s.link_id, (scanCountByLink.get(s.link_id) ?? 0) + 1);
      if (!byIssueByDay.has(s.issue_id)) byIssueByDay.set(s.issue_id, new Map());
      const issueDay = byIssueByDay.get(s.issue_id)!;
      issueDay.set(day, (issueDay.get(day) ?? 0) + 1);
      if (!byLinkByDay.has(s.link_id)) byLinkByDay.set(s.link_id, new Map());
      const linkDay = byLinkByDay.get(s.link_id)!;
      linkDay.set(day, (linkDay.get(day) ?? 0) + 1);
    });

    const toSortedArray = (m: Map<string, number>): { date: string; count: number }[] =>
      Array.from(m.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

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
      const scanCountByDay = toSortedArray(byIssueByDay.get(issue.id) ?? new Map());
      return {
        id: issue.id,
        title: issue.title,
        slug: issue.slug,
        cover_img_url: issue.cover_img_url ?? null,
        totalScans,
        scanCountByDay,
        links: linkList,
      };
    });

    const qrCodes: QrCodeAnalytics[] = (links ?? []).map((l) => ({
      linkId: l.id,
      label: l.label ?? null,
      url: l.url ?? null,
      qr_path: l.qr_path ?? null,
      issueId: l.issue_id,
      issueTitle: issueTitleMap.get(l.issue_id) ?? null,
      issueSlug: (issues ?? []).find((i) => i.id === l.issue_id)?.slug ?? null,
      scans: scanCountByLink.get(l.id) ?? 0,
      scanCountByDay: toSortedArray(byLinkByDay.get(l.id) ?? new Map()),
    }));

    const totalScans = scansList.length;

    return NextResponse.json({
      totalScans,
      issues: analyticsIssues,
      qrCodes,
    });
  } catch (error) {
    console.error("[Analytics] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
