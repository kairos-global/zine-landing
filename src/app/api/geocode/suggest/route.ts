// src/app/api/geocode/suggest/route.ts
import { NextResponse } from "next/server";

/** ----- Types ----- */
type MapboxFeature = {
  id?: string;
  place_name?: string;
  center?: [number, number];
};

type MapboxResponse = {
  features?: MapboxFeature[];
};

type Suggestion = {
  id: string;
  label: string;
  lng: number | null;
  lat: number | null;
};

/** Convert a Mapbox feature to our Suggestion type (null if not usable) */
function toSuggestion(f: MapboxFeature): Suggestion | null {
  const label = f.place_name ?? "";
  const id = String(f.id ?? label);
  const lng =
    Array.isArray(f.center) && typeof f.center[0] === "number"
      ? f.center[0]
      : null;
  const lat =
    Array.isArray(f.center) && typeof f.center[1] === "number"
      ? f.center[1]
      : null;

  if (!label) return null;
  return { id, label, lng, lat };
}

/** ----- Route ----- */
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
    const token =
      process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      return NextResponse.json<{ suggestions: Suggestion[]; error: string }>(
        { suggestions: [], error: "Missing MAPBOX token" },
        { status: 200 }
      );
    }

    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
      `${encodeURIComponent(
        query
      )}.json?autocomplete=true&limit=${limit}&access_token=${token}`;

    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) {
      return NextResponse.json<{ suggestions: Suggestion[] }>(
        { suggestions: [] },
        { status: 200 }
      );
    }

    const j = (await r.json()) as MapboxResponse;

    const suggestions: Suggestion[] = (j.features ?? [])
      .map(toSuggestion)
      .filter((s): s is Suggestion => s !== null);

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
