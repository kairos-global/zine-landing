import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStoreRates, type ShippoAddress, type StoreParcelItem } from "@/lib/shippo";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CartItem = { productId: string; quantity: number };
type AddressInput = {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

/**
 * POST /api/store/shipping-rates
 * Live Shippo rates for a public store cart + the customer's shipping address.
 * Parcel + customs are built from each product's weight/dimensions and price.
 *
 * Soft-fails to { available: false } so the cart can guide the user without
 * blocking (e.g. address incomplete, Shippo hiccup).
 *
 * Body: { items: [{ productId, quantity }], address: {...} }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items: CartItem[] = body.items ?? [];
    const address: AddressInput = body.address ?? {};

    if (!items.length) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Require enough address to quote. US needs a state; everywhere needs a country.
    const country = (address.country || "").toUpperCase();
    const hasCore = address.street1 && address.city && address.zip && country;
    const hasState = country !== "US" || !!address.state;
    if (!hasCore || !hasState) {
      return NextResponse.json({ available: false, reason: "incomplete_address" });
    }

    const { data: products, error } = await supabase
      .from("store_products")
      .select("id, name, price_cents, in_stock, weight_oz, length_in, width_in, height_in")
      .in("id", items.map((i) => i.productId));

    if (error || !products) {
      return NextResponse.json({ available: false, reason: "products_error" });
    }

    const parcelItems: StoreParcelItem[] = [];
    for (const item of items) {
      const p = products.find((pr) => pr.id === item.productId);
      if (!p) continue;
      parcelItems.push({
        quantity: item.quantity,
        weightOz: p.weight_oz,
        length: p.length_in,
        width: p.width_in,
        height: p.height_in,
        description: p.name,
        unitValueUsd: (p.price_cents ?? 0) / 100,
      });
    }

    if (!parcelItems.length) {
      return NextResponse.json({ available: false, reason: "products_error" });
    }

    const toAddress: ShippoAddress = {
      street1: address.street1!,
      street2: address.street2 || undefined,
      city: address.city!,
      state: address.state || "",
      zip: address.zip!,
      country,
    };

    const { rates } = await getStoreRates(toAddress, parcelItems);

    if (!rates.length) {
      return NextResponse.json({ available: false, reason: "no_rates" });
    }

    const options = rates.map((r) => ({
      rateId: r.object_id,
      amount: r.amount,
      currency: r.currency,
      provider: r.provider,
      service: r.servicelevel.name,
      serviceToken: r.servicelevel.token,
      estimatedDays: r.estimated_days ?? null,
    }));

    return NextResponse.json({ available: true, rates: options });
  } catch (err) {
    console.error("[StoreShippingRates] Error:", err);
    return NextResponse.json({ available: false, reason: "error" });
  }
}
