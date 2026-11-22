import { NextResponse } from "next/server";
import { getSiteBaseUrl } from "@/lib/site-url";
import { qrPath } from "@/lib/zine-qr";
import { zineIdPattern } from "@/lib/zine-reader-server";

export async function GET(_: Request, { params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  if (!zineIdPattern.test(issueId)) return new NextResponse("Zine not found", { status: 404 });
  const response = NextResponse.redirect(`${getSiteBaseUrl()}${qrPath(issueId, "collection")}`, 302);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
