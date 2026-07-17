import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getRates, type ShippoAddress } from "@/lib/shippo";
import { calculateTotalCharge, isLocalDeliveryEligible } from "@/lib/shipping";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/distributors/shipping-rates
 * Live Shippo carrier rates for the logged-in distributor's verified address,
 * sized to the cart quantity. Used by the cart sidebar to show real options.
 *
 * Falls back gracefully: if the distributor has no structured (map-verified)
 * address yet, returns { available: false } so the UI shows the tier estimate
 * and the order can still be placed (admin buys the label manually).
 *
 * Body: { items: [{ issue_id, quantity }] }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { items } = body as {
      items: Array<{ issue_id: string; quantity: number }>;
    };

    const totalCopies = (items ?? []).reduce(
      (s, i) => s + (Number(i.quantity) || 0),
      0
    );
    if (totalCopies <= 0) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400 }
      );
    }

    const { data: distributor } = await supabase
      .from("distributors")
      .select(
        "id, status, ship_street1, ship_street2, ship_city, ship_state, ship_zip, ship_country, business_name, contact_email, contact_phone"
      )
      .eq("user_id", userId)
      .single();

    if (!distributor || distributor.status !== "approved") {
      return NextResponse.json(
        { error: "Approved distributor not found" },
        { status: 403 }
      );
    }

    // El Paso distributors can choose free local delivery instead of shipping.
    const localDeliveryAvailable = isLocalDeliveryEligible(
      distributor.ship_city,
      distributor.ship_country
    );

    // No verified structured address → can't quote. UI falls back to estimate.
    if (!distributor.ship_street1 || !distributor.ship_city || !distributor.ship_country) {
      return NextResponse.json({
        available: false,
        reason: "no_verified_address",
        estimate: calculateTotalCharge(totalCopies),
        localDeliveryAvailable,
      });
    }

    const toAddress: ShippoAddress = {
      name: distributor.business_name || undefined,
      street1: distributor.ship_street1,
      street2: distributor.ship_street2 || undefined,
      city: distributor.ship_city,
      state: distributor.ship_state || "",
      zip: distributor.ship_zip || "",
      country: distributor.ship_country,
      email: distributor.contact_email || undefined,
      phone: distributor.contact_phone || undefined,
    };

    const { rates } = await getRates(toAddress, totalCopies);

    if (!rates.length) {
      return NextResponse.json({
        available: false,
        reason: "no_rates",
        estimate: calculateTotalCharge(totalCopies),
        localDeliveryAvailable,
      });
    }

    // Trim the payload to what the cart needs to render + remember a selection.
    const options = rates.map((r) => ({
      rateId: r.object_id,
      amount: r.amount,
      currency: r.currency,
      provider: r.provider,
      service: r.servicelevel.name,
      serviceToken: r.servicelevel.token,
      estimatedDays: r.estimated_days ?? null,
    }));

    return NextResponse.json({ available: true, rates: options, localDeliveryAvailable });
  } catch (err) {
    console.error("[ShippingRates] Error:", err);
    // Soft-fail to the estimate so checkout is never blocked by a Shippo hiccup.
    return NextResponse.json({ available: false, reason: "error" });
  }
}
