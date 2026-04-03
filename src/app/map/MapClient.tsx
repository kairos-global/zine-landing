// src/app/map/MapClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L, { DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// ── Default map center: El Paso, TX ──────────────────────────────────────────
const DEFAULT_CENTER: [number, number] = [31.7619, -106.485];
const DEFAULT_ZOOM = 12;

// ── Types ────────────────────────────────────────────────────────────────────

type DistributorRow = {
  id: string;
  business_name: string | null;
  verified_address: string | null;
  contact_name: string | null;
  business_email: string | null;
  lat: number;
  lng: number;
};

type DistributorDbRow = {
  id: string;
  business_name: string | null;
  verified_address: string | null;
  contact_name: string | null;
  business_email: string | null;
  lat: number | string | null;
  lng: number | string | null;
};

type StockedIssue = { id: string; title: string | null; slug: string };

// ── Supabase (public/anon — RLS must allow it) ───────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

// ── Marker icon ───────────────────────────────────────────────────────────────
const makeDot = (hex: string): DivIcon =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:22px;height:22px;border-radius:9999px;
      border:3px solid #000;background:${hex};
      box-shadow:0 3px 0 rgba(0,0,0,.25);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const ICON_DISTRIB = makeDot("#D16FF2");

// ── Auto-fit helper ───────────────────────────────────────────────────────────
function FitBoundsOnce({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    try { map.fitBounds(bounds, { padding: [56, 56] }); } catch { /* no-op */ }
  }, [bounds, map]);
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MapClient() {
  const router = useRouter();
  const search = useSearchParams();

  // issue filter stores the issue UUID (not slug) for easier stock lookups
  const [issueFilter, setIssueFilter] = useState<string>(search.get("issue") ?? "");
  const [stockedIssues, setStockedIssues] = useState<StockedIssue[]>([]);
  const [distributors, setDistributors] = useState<DistributorRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Load the list of issues that are actually stocked somewhere ────────────
  useEffect(() => {
    let aborted = false;
    (async () => {
      // Grab all stocked issue_ids
      const { data: stockRows } = await supabase
        .from("distributor_stock")
        .select("issue_id");

      if (!stockRows || stockRows.length === 0) return;

      const uniqueIds = [
        ...new Set(
          (stockRows as { issue_id: string }[])
            .map((r) => r.issue_id)
            .filter(Boolean)
        ),
      ];

      if (uniqueIds.length === 0) return;

      const { data: issuesData } = await supabase
        .from("issues")
        .select("id,title,slug")
        .in("id", uniqueIds);

      if (!aborted && issuesData) {
        setStockedIssues(
          (issuesData as { id: string; title: string | null; slug: string }[]).map((i) => ({
            id: i.id,
            title: i.title ?? i.slug,
            slug: i.slug,
          }))
        );
      }
    })();
    return () => { aborted = true; };
  }, []);

  // ── Keep URL synced ────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(search.toString());
    issueFilter ? params.set("issue", issueFilter) : params.delete("issue");
    router.replace(`/map?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueFilter]);

  // ── Fetch distributor pins whenever filter changes ─────────────────────────
  useEffect(() => {
    let aborted = false;
    async function run() {
      setLoading(true);
      let dData: DistributorRow[] = [];

      if (issueFilter) {
        // Find which distributors stock this specific issue
        const { data: stockRows } = await supabase
          .from("distributor_stock")
          .select("distributor_id")
          .eq("issue_id", issueFilter);

        const ids = ((stockRows ?? []) as { distributor_id: string }[]).map(
          (r) => r.distributor_id
        );

        if (ids.length > 0) {
          const { data } = await supabase
            .from("distributors")
            .select("id,business_name,verified_address,contact_name,business_email,lat,lng")
            .eq("status", "approved")
            .not("lat", "is", null)
            .not("lng", "is", null)
            .in("id", ids);

          dData = toDistributorRows(data);
        }
        // If no distributor stocks this issue: dData stays [] and map shows empty
      } else {
        // No filter — show every verified+approved distributor
        const { data } = await supabase
          .from("distributors")
          .select("id,business_name,verified_address,contact_name,business_email,lat,lng")
          .eq("status", "approved")
          .not("lat", "is", null)
          .not("lng", "is", null);

        dData = toDistributorRows(data);
      }

      if (!aborted) {
        setDistributors(dData);
        setLoading(false);
      }
    }
    run();
    return () => { aborted = true; };
  }, [issueFilter]);

  // ── Auto-fit bounds (only when 2+ pins exist) ─────────────────────────────
  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    const pts: [number, number][] = distributors
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng))
      .map((d) => [d.lat, d.lng]);
    if (pts.length < 2) return null;
    return L.latLngBounds(pts);
  }, [distributors]);

  const filteredIssueLabel = issueFilter
    ? (stockedIssues.find((i) => i.id === issueFilter)?.title ?? "this issue")
    : null;

  return (
    <div className="relative min-h-screen">

      {/* ── Control bar ─────────────────────────────────────────────────── */}
      <div className="absolute left-1/2 -translate-x-1/2 top-3 z-[500] w-full max-w-lg px-4">
        <div className="rounded-2xl border-4 border-black bg-[#AAEEFF] shadow-lg px-4 py-3 space-y-2">

          {/* Top row: legend + count + filter */}
          <div className="flex items-center justify-between gap-3 flex-wrap">

            {/* Legend + count */}
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#D16FF2", border: "2.5px solid #000",
                  boxShadow: "0 2px 0 rgba(0,0,0,.2)", flexShrink: 0,
                }}
              />
              <span className="font-bold text-black text-sm sm:text-base tracking-tight">
                Distributors
              </span>
              <span className="bg-black text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {loading ? "…" : distributors.length}
              </span>
            </div>

            {/* Issue filter */}
            <select
              value={issueFilter}
              onChange={(e) => setIssueFilter(e.target.value)}
              className="rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm text-black font-medium focus:outline-none cursor-pointer"
              aria-label="Filter by stocked issue"
            >
              <option value="">All locations</option>
              {stockedIssues.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.title ?? it.slug}
                </option>
              ))}
            </select>
          </div>

          {/* Sub-label when a specific issue is selected */}
          {filteredIssueLabel && (
            <p className="text-xs text-black/60 leading-snug">
              {distributors.length > 0
                ? <>Showing {distributors.length} location{distributors.length !== 1 ? "s" : ""} stocking <span className="font-semibold">{filteredIssueLabel}</span></>
                : <>No distributors are stocking <span className="font-semibold">{filteredIssueLabel}</span> yet</>
              }
            </p>
          )}
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-[calc(100vh-0px)]"
        preferCanvas
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsOnce bounds={bounds} />

        {distributors.map((d) => (
          <Marker key={`d-${d.id}`} position={[d.lat, d.lng]} icon={ICON_DISTRIB}>
            <Popup>
              <div className="min-w-[200px] space-y-1.5">
                <div
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: "#D16FF2" }}
                >
                  Distributor
                </div>
                <div className="font-semibold text-sm leading-snug">
                  {d.business_name ?? "—"}
                </div>
                {d.verified_address && (
                  <div className="text-xs text-gray-600 leading-snug">
                    {d.verified_address}
                  </div>
                )}
                {d.contact_name && (
                  <div className="text-xs text-gray-500">
                    Contact: {d.contact_name}
                  </div>
                )}
                {d.business_email && (
                  <div className="text-xs">
                    <a
                      href={`mailto:${d.business_email}`}
                      className="text-blue-600 underline"
                    >
                      {d.business_email}
                    </a>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-[500] rounded-full border-2 border-black bg-white/90 px-4 py-1.5 text-sm shadow">
          Loading…
        </div>
      )}
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────
function toDistributorRows(data: unknown): DistributorRow[] {
  const rows = (data ?? []) as DistributorDbRow[];
  return rows
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      id: r.id,
      business_name: r.business_name ?? "Distributor",
      verified_address: r.verified_address ?? null,
      contact_name: r.contact_name ?? null,
      business_email: r.business_email ?? null,
      lat: Number(r.lat),
      lng: Number(r.lng),
    }));
}
