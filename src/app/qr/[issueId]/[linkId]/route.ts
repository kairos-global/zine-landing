import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

  // Look up the link in DB
  const { data: link, error } = await supabase
    .from("issue_links")
    .select("id, issue_id, url, label")
    .eq("id", linkId)
    .eq("issue_id", issueId)
    .single();

  if (error || !link?.url) {
    return new NextResponse("QR link not found", { status: 404 });
  }

  // Grab context from request
  const ua = req.headers.get("user-agent") || null;
  const referer = req.headers.get("referer") || null;
  const ip =
    (req.headers.get("x-forwarded-for")?.split(",")[0] || "").trim() || null;

  // 1️⃣ Log to Supabase (scanned_at if column exists; otherwise created_at is used)
  await supabase.from("qr_scans").insert({
    issue_id: link.issue_id,
    link_id: link.id,
    user_agent: ua,
    ip_address: ip,
    referer,
  });

  // 2️⃣ Send to PostHog
  if (posthog) {
    posthog.capture({
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
    });
  }

  // 3️⃣ Redirect to final destination
  const res = NextResponse.redirect(link.url, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
