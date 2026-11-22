import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { MapIssue, MapLocation } from "@/lib/map-directory";

export async function GET() {
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const locations: MapLocation[] = [];
    const pageSize = 500;

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db.from("distributors")
        .select("id,business_name,verified_address,business_email,lat,lng")
        .eq("status", "approved")
        .not("verified_address", "is", null)
        .gte("lat", -90).lte("lat", 90).gte("lng", -180).lte("lng", 180)
        .order("id").range(offset, offset + pageSize - 1);

      if (error) throw error;
      for (const row of data) {
        if (!row.verified_address.trim()) continue;
        locations.push({
          id: row.id,
          name: row.business_name?.trim() || "Zine distributor",
          address: row.verified_address,
          email: row.business_email,
          lat: row.lat,
          lng: row.lng,
          issues: [],
        });
      }
      if (data.length < pageSize) break;
    }

    const byId = new Map(locations.map((location) => [location.id, location]));
    for (let start = 0; start < locations.length; start += 100) {
      const ids = locations.slice(start, start + 100).map(({ id }) => id);
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await db.from("distributor_stock")
          .select("distributor_id,issue:issues!inner(id,slug,title,category)")
          .in("distributor_id", ids).gt("quantity", 0).eq("issue.status", "published")
          .order("distributor_id").order("issue_id").range(offset, offset + pageSize - 1)
          .returns<{ distributor_id: string; issue: MapIssue }[]>();

        if (error) throw error;
        for (const { distributor_id, issue } of data) {
          if (issue.slug) byId.get(distributor_id)?.issues.push({ ...issue, title: issue.title || issue.slug });
        }
        if (data.length < pageSize) break;
      }
    }

    return NextResponse.json({ locations }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[MapDirectory]", error);
    return NextResponse.json({ error: "The directory is temporarily unavailable." }, { status: 503 });
  }
}
