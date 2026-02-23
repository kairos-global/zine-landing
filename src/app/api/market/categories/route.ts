import { NextResponse } from "next/server";

export const MARKET_CATEGORIES = [
  { key: "flyer_design", label: "Flyer design" },
  { key: "zine_design", label: "Zine design" },
  { key: "logo_design", label: "Logo design" },
  { key: "carousel_post", label: "Carousel post (3–10 images)" },
  { key: "graphic_illustration", label: "Graphic illustration" },
] as const;

export type MarketCategoryKey = (typeof MARKET_CATEGORIES)[number]["key"];

/**
 * GET /api/market/categories
 * List service categories for the market (purchase/sell).
 */
export async function GET() {
  return NextResponse.json({ categories: MARKET_CATEGORIES });
}
