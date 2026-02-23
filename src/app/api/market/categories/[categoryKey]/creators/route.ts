import { NextResponse } from "next/server";
import { MARKET_CATEGORIES } from "@/lib/market-categories";

const validKeys = new Set(MARKET_CATEGORIES.map((c) => c.key));

/**
 * GET /api/market/categories/[categoryKey]/creators
 * List creators who sell this service (enabled + have a price).
 * Returns empty list until market_creator_services table is populated.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ categoryKey: string }> }
) {
  const { categoryKey } = await params;
  if (!validKeys.has(categoryKey)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  return NextResponse.json({ creators: [] });
}
