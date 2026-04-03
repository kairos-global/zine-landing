// src/app/api/geocode/suggest/route.ts
// Geocoding via Nominatim (OpenStreetMap) — no API key required.
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
// We include a descriptive User-Agent as required.
import { NextResponse } from "next/server";

type NominatimResult = {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
};

type Suggestion = {
  id: string;
  label: string;
  lng: number | null;
  lat: number | null;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawQuery = searchParams.get("query") ?? "";
  const query = rawQuery.trim();

  const rawLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 10)
    : 5;

  if (!query) {
    return NextResponse.json<{ suggestions: Suggestion[] }>(
      { suggestions: [] },
      { status: 200 }
    );
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}` +
      `&format=json` +
      `&limit=${limit}` +
      `&addressdetails=0`;

    const r = await fetch(url, {
      headers: {
        // Nominatim requires a meaningful User-Agent identifying your app + contact
        "User-Agent": "Zineground/1.0 (hello@zineground.com)",
        "Accept-Language": "en",
      },
      next: { revalidate: 60 },
    });

    if (!r.ok) {
      return NextResponse.json<{ suggestions: Suggestion[] }>(
        { suggestions: [] },
        { status: 200 }
      );
    }

    const results = (await r.json()) as NominatimResult[];

    const suggestions: Suggestion[] = results.map((result, i) => ({
      id: String(result.place_id ?? i),
      label: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    }));

    return NextResponse.json<{ suggestions: Suggestion[] }>(
      { suggestions },
      { status: 200 }
    );
  } catch {
    return NextResponse.json<{ suggestions: Suggestion[] }>(
      { suggestions: [] },
      { status: 200 }
    );
  }
}
