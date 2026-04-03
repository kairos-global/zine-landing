// src/app/map/MapClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L, { DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type ViewMode = "both" | "map_features" | "distributors";

type MapFeatureRow = {
  id: string | number;
  title: string | null;
  lat: number;
  lng: number;
  issue_id: string | number | null;
  issues?: { slug: string | null } | null;
};

type DistributorRow = {
  id: string | number;
  business_name: string | null;
  verified_address: string | null;
  contact_name: string | null;
  business_email: string | null;
  lat: number;
  lng: number;
  issue_id?: string | number | null;
};

type IssueOption = { slug: string; title: string | null };

type IssueRowLite = { slug: string; title: string | null; published_at?: string | null };

type MapFeatureJoinedRow = {
  id: string | number;
  title: string | null;
  lat: number | string | null;
  lng: number | string | null;
  issue_id: string | number | null;
  issues: { slug: string | null } | null;
};

type DistributorDbRow = {
  id: string | number;
  business_name: string | null;
  verified_address: string | null;
  contact_name: string | null;
  business_email: string | null;
  lat: number | string | null;
  lng: number | string | null;
  issue_id: string | number | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

/** Brand markers */
const makeDot = (hex: string): DivIcon =>
  L.divIcon({
    className: "",
    html: `<div style="
        width:20px;height:20px;border-radius:9999px;
        border:3px solid #000; background:${hex};
        box-shadow: 0 3px 0 rgba(0,0,0,.2);
      "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

// Map Feature pins = sky blue, Distributor pins = brand purple
const ICON_MAP_FEATURE = makeDot("#65CBF1");
const ICON_DISTRIB     = makeDot("#D16FF2");

function FitBoundsOnce({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    try {
      map.fitBounds(bounds, { padding: [32, 32] });
    } catch {
      /* no-op */
    }
  }, [bounds, map]);
  return null;
}

export default function MapClient() {
  const router = useRouter();
  const search = useSearchParams();

  const initialView = (search.get("view") as ViewMode) || "both";
  const initialIssue = search.get("issue") || "";

  const [view, setView]           = useState<ViewMode>(initialView);
  const [issueSlug, setIssueSlug] = useState<string>(initialIssue);
  const [issuesList, setIssuesList] = useState<IssueOption[]>([]);
  const [loading, setLoading]     = useState(false);

  const [mapFeatures, setMapFeatures] = useState<MapFeatureRow[]>([]);
  const [distributors, setDistributors] = useState<DistributorRow[]>([]);

  /** Load issues dropdown once */
  useEffect(() => {
    let aborted = false;
    (async () => {
      const { data } = await supabase
        .from("issues")
        .select("slug,title,published_at,status")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (!aborted) {
        const issues = ((data ?? []) as IssueRowLite[]).map((i) => ({
          slug: i.slug,
          title: i.title ?? i.slug,
        }));
        setIssuesList(issues);
      }
    })();
    return () => { aborted = true; };
  }, []);

  /** Keep URL in sync with active filters */
  useEffect(() => {
    const params = new URLSearchParams(search.toString());
    view === "both" ? params.delete("view") : params.set("view", view);
    issueSlug ? params.set("issue", issueSlug) : params.delete("issue");
    router.replace(`/map?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, issueSlug]);

  /** Fetch pins whenever filters change */
  useEffect(() => {
    let aborted = false;
    async function run() {
      setLoading(true);

      // Resolve issue id if filtering by slug
      let issueId: string | number | null = null;
      if (issueSlug) {
        const { data: issue } = await supabase
          .from("issues")
          .select("id,slug")
          .eq("slug", issueSlug)
          .maybeSingle();
        issueId = (issue?.id as string | number | undefined) ?? null;
      }

      // Map features (join to published issues)
      let mfData: MapFeatureRow[] = [];
      if (view === "both" || view === "map_features") {
        let mfQuery = supabase
          .from("map_features")
          .select("id,title,lat,lng,issue_id,issues:issues!inner(slug,status)");
        mfQuery = mfQuery.eq("issues.status", "published");
        if (issueSlug) mfQuery = mfQuery.eq("issues.slug", issueSlug);

        const { data } = await mfQuery;
        const rows = (data ?? []) as unknown as MapFeatureJoinedRow[];
        mfData = rows
          .filter((r) => r.lat != null && r.lng != null)
          .map((r) => ({
            id: r.id,
            title: r.title ?? "Map Feature",
            lat: Number(r.lat),
            lng: Number(r.lng),
            issue_id: r.issue_id ?? null,
            issues: r.issues ?? null,
          }));
      }

      // Distributors — only approved + address-verified
      let dData: DistributorRow[] = [];
      if (view === "both" || view === "distributors") {
        let dQuery = supabase
          .from("distributors")
          .select("id,business_name,verified_address,contact_name,business_email,lat,lng,issue_id")
          .eq("status", "approved")
          .not("lat", "is", null)
          .not("lng", "is", null);
        if (issueId) dQuery = dQuery.eq("issue_id", issueId);
        const { data } = await dQuery;

        const rows = (data ?? []) as unknown as DistributorDbRow[];
        dData = rows
          .filter((r) => r.lat != null && r.lng != null)
          .map((r) => ({
            id: r.id,
            business_name: r.business_name ?? "Distributor",
            verified_address: r.verified_address ?? null,
            contact_name: r.contact_name ?? null,
            business_email: r.business_email ?? null,
            lat: Number(r.lat),
            lng: Number(r.lng),
            issue_id: r.issue_id ?? null,
          }));
      }

      if (!aborted) {
        setMapFeatures(mfData);
        setDistributors(dData);
        setLoading(false);
      }
    }
    run();
    return () => { aborted = true; };
  }, [view, issueSlug]);

  /** Auto-fit bounds to visible pins */
  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    const pts: [number, number][] = [];
    if (view !== "distributors") {
      mapFeatures.forEach((f) => {
        if (Number.isFinite(f.lat) && Number.isFinite(f.lng))
          pts.push([f.lat, f.lng]);
      });
    }
    if (view !== "map_features") {
      distributors.forEach((d) => {
        if (Number.isFinite(d.lat) && Number.isFinite(d.lng))
          pts.push([d.lat, d.lng]);
      });
    }
    if (pts.length === 0) return null;
    return L.latLngBounds(pts);
  }, [mapFeatures, distributors, view]);

  const countMF = mapFeatures.length;
  const countD  = distributors.length;

  return (
    <div className="relative min-h-screen">
      {/* Controls */}
      <div className="absolute left-1/2 -translate-x-1/2 top-3 z-[500]">
        <div className="rounded-2xl border-4 border-black bg-[#AAEEFF] shadow-md px-3 py-2 flex items-center gap-2 sm:gap-3">
          <button
            className={`rounded-md border-2 border-black px-3 py-1 text-sm sm:text-base text-black ${
              view === "both" ? "bg-white" : "bg-white/70"
            }`}
            onClick={() => setView("both")}
          >
            All ({countMF + countD})
          </button>
          <button
            className={`rounded-md border-2 border-black px-3 py-1 text-sm sm:text-base text-black ${
              view === "map_features" ? "bg-white" : "bg-white/70"
            }`}
            onClick={() => setView("map_features")}
          >
            Map Features ({countMF})
          </button>
          <button
            className={`rounded-md border-2 border-black px-3 py-1 text-sm sm:text-base text-black ${
              view === "distributors" ? "bg-white" : "bg-white/70"
            }`}
            onClick={() => setView("distributors")}
          >
            Distributors ({countD})
          </button>

          {/* Issue filter */}
          <select
            value={issueSlug}
            onChange={(e) => setIssueSlug(e.target.value)}
            className="ml-2 rounded-md border-2 border-black bg-white px-2 py-1 text-sm sm:text-base text-black"
            aria-label="Filter by issue"
          >
            <option value="">All issues</option>
            {issuesList.map((it) => (
              <option key={it.slug} value={it.slug}>
                {it.title ?? it.slug}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Map */}
      <MapContainer
        center={[40.73, -73.93]}
        zoom={11}
        className="w-full h-[calc(100vh-0px)]"
        preferCanvas
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsOnce bounds={bounds} />

        {/* Map Feature pins — sky blue */}
        {(view === "both" || view === "map_features") &&
          mapFeatures.map((f) => (
            <Marker key={`mf-${f.id}`} position={[f.lat, f.lng]} icon={ICON_MAP_FEATURE}>
              <Popup>
                <div className="min-w-[180px] space-y-1">
                  <div
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: "#65CBF1" }}
                  >
                    Map Feature
                  </div>
                  <div className="font-semibold text-sm">{f.title ?? "—"}</div>
                  {f.issues?.slug && (
                    <a
                      href={`/issues/${f.issues.slug}`}
                      className="underline text-xs text-blue-600"
                    >
                      View issue
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Distributor pins — purple */}
        {(view === "both" || view === "distributors") &&
          distributors.map((d) => (
            <Marker key={`d-${d.id}`} position={[d.lat, d.lng]} icon={ICON_DISTRIB}>
              <Popup>
                <div className="min-w-[200px] space-y-1">
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

      {loading && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-[500] rounded-full border-2 border-black bg-white/90 px-3 py-1 text-sm shadow">
          Loading…
        </div>
      )}
    </div>
  );
}
