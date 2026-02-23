import { NextResponse } from "next/server";
import { MARKET_CATEGORIES } from "@/lib/market-categories";

/**
 * GET /api/market/categories
 * List service categories for the market (purchase/sell).
 */
export async function GET() {
  return NextResponse.json({ categories: MARKET_CATEGORIES });
}
