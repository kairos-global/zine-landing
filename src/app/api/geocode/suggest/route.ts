// app/api/geocode/suggest/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawQuery = searchParams.get("query") || "";
  const query = rawQuery.trim();
  const rawLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 10) : 5;

  if (!query) {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }

  try {
    const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      return NextResponse.json({ suggestions: [], error: "Missing MAPBOX token" }, { status: 200 });
    }

    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
      `${encodeURIComponent(query)}.json?autocomplete=true&limit=${limit}&access_token=${token}`;

    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) return NextResponse.json({ suggestions: [] }, { status: 200 });

    const j = await r.json();
    const suggestions =
      j?.features?.map((f: any) => ({
        id: String(f.id ?? f.place_name),
        label: f.place_name as string,
        lng: f.center?.[0],
        lat: f.center?.[1],
      })) ?? [];

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
