// src/app/api/geocode/suggest/route.ts
// Geocoding via Nominatim (OpenStreetMap) — no API key required.
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
// We include a descriptive User-Agent as required.
//
// addressdetails=1 so each result carries structured components. These are
// derived into a `structured` block (street1/city/state/zip/country) that the
// admin verify step stores on the distributor for Shippo label generation.
import { NextResponse } from "next/server";

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  ["ISO3166-2-lvl4"]?: string;
};

type NominatimResult = {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
};

type StructuredAddress = {
  street1: string;
  city: string;
  state: string;
  zip: string;
  country: string; // ISO-2, uppercase
};

type Suggestion = {
  id: string;
  label: string;
  lng: number | null;
  lat: number | null;
  structured: StructuredAddress | null;
};

/** Map a Nominatim address object into the fields Shippo needs. */
function toStructured(a?: NominatimAddress): StructuredAddress | null {
  if (!a) return null;
  const street1 = [a.house_number, a.road].filter(Boolean).join(" ").trim();
  const city =
    a.city || a.town || a.village || a.hamlet || a.suburb || a.county || "";
  // Prefer the ISO subdivision code (e.g. "US-TX" → "TX") over the full name.
  const iso = a["ISO3166-2-lvl4"];
  const state = iso && iso.includes("-") ? iso.split("-")[1] : a.state || "";
  return {
    street1,
    city,
    state,
    zip: a.postcode || "",
    country: (a.country_code || "").toUpperCase(),
  };
}

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
      `&addressdetails=1`;

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
      structured: toStructured(result.address),
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
