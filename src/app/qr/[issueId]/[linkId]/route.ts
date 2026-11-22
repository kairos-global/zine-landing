import { after, NextRequest, NextResponse } from "next/server";
import { ensureCollectionQr } from "@/lib/zine-qr-storage";
import { zineDb, zineIdPattern } from "@/lib/zine-reader-server";
import { builtInQrLabels } from "@/lib/zine-qr";
import { getSiteBaseUrl } from "@/lib/site-url";
import { PostHog } from "posthog-node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PostHog client (server-only, do not expose key to browser)
const posthog =
  process.env.POSTHOG_KEY
    ? new PostHog(process.env.POSTHOG_KEY!, {
        host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      })
    : null;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ issueId: string; linkId: string }> }
) {
  const { issueId, linkId } = await params;

  const kind = linkId === "issue" || linkId === "collection" ? linkId : null;
  const notFound = () => new NextResponse("QR link not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!zineIdPattern.test(issueId) || (!kind && !zineIdPattern.test(linkId))) return notFound();

  const lookup = zineDb.from("issue_links").select("id, issue_id, url, label").eq("issue_id", issueId);
  const [{ data: issue }, { data: storedLink, error }] = await Promise.all([
    zineDb.from("issues").select("status, slug").eq("id", issueId).maybeSingle(),
    (kind ? lookup.eq("label", builtInQrLabels[kind]).order("id").limit(1) : lookup.eq("id", linkId)).maybeSingle(),
  ]);
  if (error || issue?.status !== "published" || !issue.slug) return notFound();

  let link = storedLink;
  if (!link && kind === "collection") {
    try {
      link = await ensureCollectionQr(zineDb, issueId, issue.slug);
    } catch (error) {
      console.error("[QR] Could not register collection code:", error);
    }
  }

  const issueUrl = `${getSiteBaseUrl()}/issues/${encodeURIComponent(issue.slug)}`;
  if (!link && kind === "collection") {
    const response = NextResponse.redirect(`${issueUrl}?save=1`, 302);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  if (!link?.url) return notFound();
  const destination = link.label === builtInQrLabels.collection ? `${issueUrl}?save=1`
    : link.label === builtInQrLabels.issue ? issueUrl : link.url;
  if (!/^https?:\/\//i.test(destination)) return notFound();

  // Grab context from request
  const ua = req.headers.get("user-agent") || null;
  const referer = req.headers.get("referer") || null;
  const ip =
    (req.headers.get("x-forwarded-for")?.split(",")[0] || "").trim() || null;

  const { error: scanError } = await zineDb.from("qr_scans").insert({
    issue_id: link.issue_id,
    link_id: link.id,
    scanned_at: new Date().toISOString(),
    user_agent: ua,
    ip_address: ip,
    referer,
  });

  if (scanError) console.error("[QR] Could not record scan:", scanError);

  if (posthog) {
    after(() => posthog.captureImmediate({
      distinctId: ip || "anonymous",
      event: "qr_scan",
      properties: {
        issue_id: link.issue_id,
        link_id: link.id,
        label: link.label,
        referer,
        user_agent: ua,
        path: req.nextUrl.pathname,
      },
    }).catch(error => console.error("[QR] PostHog delivery failed:", error)));
  }

  const res = NextResponse.redirect(destination, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
