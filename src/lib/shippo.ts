/**
 * Shippo integration — live carrier rates + label purchase.
 *
 * We call Shippo's REST API directly with fetch (no SDK — npm is blocked in the
 * Cowork sandbox and the rest of the codebase already calls third-party HTTP
 * APIs this way, e.g. the Nominatim geocode route).
 *
 * The API token lives in SHIPPO_API_KEY (set per Vercel environment). Shippo
 * uses prefixed tokens — shippo_test_* in Preview, shippo_live_* in Production —
 * which mirrors the existing sk_test_/sk_live_ Stripe split.
 *
 * Docs: https://docs.goshippo.com/shippoapi/public-api/
 */

const SHIPPO_BASE = "https://api.goshippo.com";

function shippoToken(): string {
  const key = process.env.SHIPPO_API_KEY;
  if (!key) throw new Error("SHIPPO_API_KEY environment variable is not set");
  return key;
}

async function shippoFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SHIPPO_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${shippoToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Shippo ${path} failed (${res.status}): ${JSON.stringify(json)}`
    );
  }
  return json as T;
}

// ── Tunable constants ─────────────────────────────────────────────────────────
// These are estimates, confirmed with Alex 2026-06-23. Adjust freely once real
// shipments establish actual weights/sizes.

/** Mini zine is the only supported format right now. Weight of one folded copy. */
export const WEIGHT_PER_COPY_OZ = 0.2;

/** Packaging weight added on top of the copies (the mailer/box itself). */
const MAILER_TARE_OZ = 0.5;
const BOX_TARE_OZ = 3.0;

/** Orders up to this many copies ship in a flat rigid mailer; above it, a box. */
const MAILER_MAX_COPIES = 50;

/** Parcel dimensions (inches). Guesses — tune once we know how zines actually ship. */
const MAILER_PARCEL = { length: 10, width: 7, height: 0.75 };
const BOX_PARCEL = { length: 9, width: 6, height: 4 };

/** International customs defaults. value_amount is the per-copy declared value.
 *  Alex flagged the print cost is ~$0.10/copy; we declare $1.00 to avoid
 *  sub-dollar undervaluation flags. Drop to 0.1 here if you'd rather. */
export const CUSTOMS_VALUE_PER_COPY_USD = 1.0;
const CUSTOMS_DESCRIPTION = "Printed zine";
const CUSTOMS_HS_CODE = "490290"; // periodicals / printed matter
const CUSTOMS_ORIGIN_COUNTRY = "US";

/** Fallback parcel for store products that have no weight/dimensions set yet. */
const DEFAULT_PRODUCT_WEIGHT_OZ = 4;
const DEFAULT_PRODUCT_DIMS = { length: 9, width: 6, height: 2 };

/**
 * Zineground return address (ships from El Paso, TX). Override any field via env
 * if/when the real warehouse address differs. TODO(alex): confirm the real
 * return address before going live — Shippo prints this on every label.
 */
export const SHIP_FROM_ADDRESS = {
  name: process.env.SHIP_FROM_NAME || "Zineground",
  street1: process.env.SHIP_FROM_STREET1 || "123 Main St",
  street2: process.env.SHIP_FROM_STREET2 || "",
  city: process.env.SHIP_FROM_CITY || "El Paso",
  state: process.env.SHIP_FROM_STATE || "TX",
  zip: process.env.SHIP_FROM_ZIP || "79901",
  country: process.env.SHIP_FROM_COUNTRY || "US",
  phone: process.env.SHIP_FROM_PHONE || "0000000000",
  email: process.env.SHIP_FROM_EMAIL || "hello@zineground.com",
};

// ── Types ───────────────────────────────────────────────────────────────────

export type ShippoAddress = {
  name?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string; // ISO-2, e.g. "US"
  phone?: string;
  email?: string;
};

export type ShippoRate = {
  object_id: string;
  amount: string; // decimal string, e.g. "5.50"
  currency: string;
  provider: string; // e.g. "USPS"
  servicelevel: { name: string; token: string };
  estimated_days?: number | null;
  attributes?: string[];
};

type ShipmentResponse = {
  object_id: string;
  rates: ShippoRate[];
  messages?: Array<{ text?: string }>;
};

type TransactionResponse = {
  object_id: string;
  status: string; // "SUCCESS" | "ERROR" | "QUEUED"
  tracking_number?: string;
  label_url?: string;
  messages?: Array<{ text?: string }>;
};

// ── Parcel / customs builders ─────────────────────────────────────────────────

/** Build a parcel payload for a given copy count (weight scales with copies). */
export function buildParcel(copies: number) {
  const useBox = copies > MAILER_MAX_COPIES;
  const tare = useBox ? BOX_TARE_OZ : MAILER_TARE_OZ;
  const dims = useBox ? BOX_PARCEL : MAILER_PARCEL;
  const weightOz = Math.max(1, copies * WEIGHT_PER_COPY_OZ + tare);
  return {
    length: String(dims.length),
    width: String(dims.width),
    height: String(dims.height),
    distance_unit: "in",
    weight: weightOz.toFixed(2),
    mass_unit: "oz",
  };
}

/** One line on a customs declaration. */
export type CustomsItem = {
  description: string;
  quantity: number;
  netWeightOz: number;
  valueAmount: number; // total USD value for the line
  hsCode?: string;
};

/** Create a customs declaration for an international shipment, return its id. */
async function createCustomsDeclaration(items: CustomsItem[]): Promise<string> {
  const decl = await shippoFetch<{ object_id: string }>(
    "/customs/declarations/",
    {
      certify: true,
      certify_signer: SHIP_FROM_ADDRESS.name,
      contents_type: "MERCHANDISE",
      non_delivery_option: "RETURN",
      incoterm: "DDU",
      items: items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        net_weight: Math.max(0.1, it.netWeightOz).toFixed(2),
        mass_unit: "oz",
        value_amount: Math.max(0.1, it.valueAmount).toFixed(2),
        value_currency: "USD",
        origin_country: CUSTOMS_ORIGIN_COUNTRY,
        ...(it.hsCode ? { tariff_number: it.hsCode } : {}),
      })),
    }
  );
  return decl.object_id;
}

/** Core: create a shipment for a parcel + destination, return sorted rates. */
async function quoteShipment(
  toAddress: ShippoAddress,
  parcel: Record<string, string>,
  customsDeclarationId?: string
): Promise<GetRatesResult> {
  const shipmentBody: Record<string, unknown> = {
    address_from: SHIP_FROM_ADDRESS,
    address_to: toAddress,
    parcels: [parcel],
    async: false,
  };
  if (customsDeclarationId) shipmentBody.customs_declaration = customsDeclarationId;

  const shipment = await shippoFetch<ShipmentResponse>("/shipments/", shipmentBody);

  // Cheapest first so callers can default to the lowest reliable rate.
  const rates = [...(shipment.rates ?? [])].sort(
    (a, b) => parseFloat(a.amount) - parseFloat(b.amount)
  );
  return { shipmentId: shipment.object_id, rates };
}

// ── Public API ────────────────────────────────────────────────────────────────

export type GetRatesResult = {
  shipmentId: string;
  rates: ShippoRate[];
};

/**
 * Get live carrier rates for shipping `copies` to `toAddress`. Adds a customs
 * declaration automatically when the destination is outside the US.
 */
export async function getRates(
  toAddress: ShippoAddress,
  copies: number
): Promise<GetRatesResult> {
  let customsId: string | undefined;
  if (toAddress.country.toUpperCase() !== "US") {
    customsId = await createCustomsDeclaration([
      {
        description: CUSTOMS_DESCRIPTION,
        quantity: copies,
        netWeightOz: copies * WEIGHT_PER_COPY_OZ,
        valueAmount: copies * CUSTOMS_VALUE_PER_COPY_USD,
        hsCode: CUSTOMS_HS_CODE,
      },
    ]);
  }
  return quoteShipment(toAddress, buildParcel(copies), customsId);
}

// ── Store (per-product) rates ──────────────────────────────────────────────────

/** A cart line for the store, carrying its parcel attributes + declared value. */
export type StoreParcelItem = {
  quantity: number;
  weightOz?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  description: string;
  unitValueUsd: number; // retail price per unit, used as customs value
};

/** Combine store cart lines into a single parcel (sum weight, stack heights). */
export function combineStoreParcel(items: StoreParcelItem[]): Record<string, string> {
  let weightOz = 0;
  let maxLen = 0;
  let maxWid = 0;
  let sumHeight = 0;
  for (const it of items) {
    const qty = Math.max(1, it.quantity);
    weightOz += (it.weightOz ?? DEFAULT_PRODUCT_WEIGHT_OZ) * qty;
    maxLen = Math.max(maxLen, it.length ?? DEFAULT_PRODUCT_DIMS.length);
    maxWid = Math.max(maxWid, it.width ?? DEFAULT_PRODUCT_DIMS.width);
    sumHeight += (it.height ?? DEFAULT_PRODUCT_DIMS.height) * qty;
  }
  return {
    length: String(maxLen || DEFAULT_PRODUCT_DIMS.length),
    width: String(maxWid || DEFAULT_PRODUCT_DIMS.width),
    height: String(sumHeight || DEFAULT_PRODUCT_DIMS.height),
    distance_unit: "in",
    weight: Math.max(1, weightOz).toFixed(2),
    mass_unit: "oz",
  };
}

/** Live rates for a store order. Builds customs from the cart for non-US destinations. */
export async function getStoreRates(
  toAddress: ShippoAddress,
  items: StoreParcelItem[]
): Promise<GetRatesResult> {
  let customsId: string | undefined;
  if (toAddress.country.toUpperCase() !== "US") {
    customsId = await createCustomsDeclaration(
      items.map((it) => ({
        description: it.description,
        quantity: Math.max(1, it.quantity),
        netWeightOz: (it.weightOz ?? DEFAULT_PRODUCT_WEIGHT_OZ) * Math.max(1, it.quantity),
        valueAmount: it.unitValueUsd * Math.max(1, it.quantity),
      }))
    );
  }
  return quoteShipment(toAddress, combineStoreParcel(items), customsId);
}

/**
 * Pick the rate matching a previously-selected carrier/service, falling back to
 * the cheapest available rate. Returns null if there are no rates.
 */
export function pickRate(
  rates: ShippoRate[],
  provider?: string | null,
  serviceToken?: string | null
): ShippoRate | null {
  if (!rates.length) return null;
  if (serviceToken) {
    const match = rates.find(
      (r) =>
        r.servicelevel.token === serviceToken &&
        (!provider || r.provider === provider)
    );
    if (match) return match;
  }
  // rates are already sorted cheapest-first
  return rates[0];
}

export type BoughtLabel = {
  transactionId: string;
  trackingNumber: string;
  labelUrl: string;
};

/** Purchase the actual shipping label for a rate. Throws on failure. */
export async function buyLabel(rateId: string): Promise<BoughtLabel> {
  const txn = await shippoFetch<TransactionResponse>("/transactions/", {
    rate: rateId,
    label_file_type: "PDF",
    async: false,
  });

  if (txn.status !== "SUCCESS" || !txn.label_url) {
    const msg = (txn.messages ?? []).map((m) => m.text).join("; ");
    throw new Error(`Shippo label purchase failed (status=${txn.status}): ${msg}`);
  }

  return {
    transactionId: txn.object_id,
    trackingNumber: txn.tracking_number ?? "",
    labelUrl: txn.label_url,
  };
}
