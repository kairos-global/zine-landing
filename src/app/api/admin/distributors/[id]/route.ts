import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PATCH /api/admin/distributors/[id]
 * Update a distributor's status OR verify/set their map address.
 *
 * Status update body:   { status: "approved" | "rejected" | "pending" }
 * Address verify body:  { lat: number, lng: number, verified_address: string }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(userId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // ── Address verification path ──────────────────────────────────────────────
    if ("lat" in body || "lng" in body || "verified_address" in body) {
      const { lat, lng, verified_address, structured } = body as {
        lat: number;
        lng: number;
        verified_address: string;
        structured?: {
          street1?: string;
          street2?: string;
          city?: string;
          state?: string;
          zip?: string;
          country?: string;
        } | null;
      };

      if (
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        !verified_address
      ) {
        return NextResponse.json(
          { error: "lat (number), lng (number), and verified_address (string) are required" },
          { status: 400 }
        );
      }

      const updatePayload: Record<string, unknown> = {
        lat,
        lng,
        verified_address,
        address_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Structured shipping address (from the geocode result) — used by Shippo
      // for live rates and label generation. Only write fields we actually have.
      if (structured) {
        if (structured.street1 != null) updatePayload.ship_street1 = structured.street1;
        if (structured.street2 != null) updatePayload.ship_street2 = structured.street2;
        if (structured.city != null) updatePayload.ship_city = structured.city;
        if (structured.state != null) updatePayload.ship_state = structured.state;
        if (structured.zip != null) updatePayload.ship_zip = structured.zip;
        if (structured.country != null) updatePayload.ship_country = structured.country;
      }

      const { data, error } = await supabase
        .from("distributors")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error verifying distributor address:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        distributor: data,
        message: "Address verified and mapped",
      });
    }

    // ── Status update path ─────────────────────────────────────────────────────
    const { status } = body;

    if (!status || !["pending", "approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: pending, approved, or rejected" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("distributors")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating distributor:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      distributor: data,
      message: `Distributor ${status}`
    });
  } catch (err) {
    console.error("Admin distributor PATCH error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/distributors/[id]
 * Get a single distributor by ID
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(userId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from("distributors")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching distributor:", error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ distributor: data });
  } catch (err) {
    console.error("Admin distributor GET error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}


