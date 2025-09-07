// src/app/api/geocode/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query || !query.trim()) {
    return NextResponse.json({ lat: undefined, lng: undefined }, { status: 200 });
  }

  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      { lat: undefined, lng: undefined, error: "Missing MAPBOX token" },
      { status: 200 }
    );
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query.trim()
  )}.json?limit=1&autocomplete=true&access_token=${token}`;

  try {
    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) return NextResponse.json({ lat: undefined, lng: undefined }, { status: 200 });
    const j = await r.json();
    const first = j?.features?.[0];
    if (!first?.center?.length) {
      return NextResponse.json({ lat: undefined, lng: undefined }, { status: 200 });
    }
    const [lng, lat] = first.center;
    return NextResponse.json({ lat, lng }, { status: 200 });
  } catch {
    return NextResponse.json({ lat: undefined, lng: undefined }, { status: 200 });
  }
}
