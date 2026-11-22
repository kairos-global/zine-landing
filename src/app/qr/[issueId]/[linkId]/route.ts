import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { builtInQrLabels } from "@/lib/zine-qr";
import { getSiteBaseUrl } from "@/lib/site-url";
import { PostHog } from "posthog-node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Supabase service role client (server-only)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const lookup = supabase.from("issue_links").select("id, issue_id, url, label").eq("issue_id", issueId);
  const { data: link, error } = await (kind
    ? lookup.eq("label", builtInQrLabels[kind]).order("id").limit(1)
    : lookup.eq("id", linkId)).maybeSingle();
  if (error || !link?.url) {
    return new NextResponse("QR link not found", { status: 404 });
  }

  let destination = link.url;
  if (link.label === builtInQrLabels.issue || link.label === builtInQrLabels.collection) {
    const { data: issue } = await supabase.from("issues").select("status, slug").eq("id", issueId).maybeSingle();
    if (issue?.status !== "published") {
      return new NextResponse("This zine has not been published yet.", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    destination = link.label === builtInQrLabels.issue
      ? `${getSiteBaseUrl()}/issues/${issue.slug}`
      : `${getSiteBaseUrl()}/collect/${issueId}`;
  }
  if (!/^https?:\/\//i.test(destination)) return new NextResponse("QR link not found", { status: 404 });

  // Grab context from request
  const ua = req.headers.get("user-agent") || null;
  const referer = req.headers.get("referer") || null;
  const ip =
    (req.headers.get("x-forwarded-for")?.split(",")[0] || "").trim() || null;

  const { error: scanError } = await supabase.from("qr_scans").insert({
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
