// src/app/map/MapClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L, { DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type ViewMode = "both" | "features" | "distributors";

/** Rows as we use them in the map */
type FeatureRow = {
  id: string | number;
  name: string | null;
  url: string | null;
  lat: number;
  lng: number;
  issue_slug: string | null;
};

type DistributorRow = {
  id: string | number;
  name: string | null;
  lat: number;
  lng: number;
  issue_slug: string | null;
};

type IssueOption = { slug: string; title: string | null };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

/** Simple helper: if someone saved "colabsai.com" make it clickable */
function ensureAbsoluteUrl(u?: string | null) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

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

const ICON_FEATURE = makeDot("#65CBF1");   // blue
const ICON_DISTRIB = makeDot("#D16FF2");   // purple

function FitBoundsOnce({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    try {
      map.fitBounds(bounds as any, { padding: [32, 32] });
    } catch {}
  }, [bounds, map]);
  return null;
}

export default function MapClient() {
  const router = useRouter();
  const search = useSearchParams();

  const initialView = (search.get("view") as ViewMode) || "both";
  const initialIssue = search.get("issue") || ""; // slug or ""

  const [view, setView] = useState<ViewMode>(initialView);
  const [issueSlug, setIssueSlug] = useState<string>(initialIssue);
  const [issuesList, setIssuesList] = useState<IssueOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [distributors, setDistributors] = useState<DistributorRow[]>([]);

  /** Load dropdown options once (published issues only) */
  useEffect(() => {
    let aborted = false;
    (async () => {
      const { data } = await supabase
        .from("issues")
        .select("slug,title,status,published_at")
        .eq("status", "published")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false });

      if (!aborted) {
        const issues = (data ?? []).map((i: any) => ({
          slug: i.slug as string,
          title: (i.title as string | null) ?? i.slug,
        }));
        setIssuesList(issues);
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  /** keep URL synced with filters */
  useEffect(() => {
    const params = new URLSearchParams(search.toString());
    view === "both" ? params.delete("view") : params.set("view", view);
    issueSlug ? params.set("issue", issueSlug) : params.delete("issue");
    router.replace(`/map?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, issueSlug]);

  /** fetch data when filters change */
  useEffect(() => {
    let aborted = false;

    async function run() {
      setLoading(true);

      // --- FEATURES (only those with coordinates, from published issues) ---
      let fRows: FeatureRow[] = [];
      if (view === "both" || view === "features") {
        let f = supabase
          .from("features")
          .select(
            `
            id,
            name,
            url,
            lat,
            lng,
            issues!inner ( slug, status )
          `
          )
          .not("lat", "is", null)
          .not("lng", "is", null)
          .eq("issues.status", "published");

        if (issueSlug) f = f.eq("issues.slug", issueSlug);

        const { data } = await f;
        fRows =
          (data ?? []).map((r: any) => ({
            id: r.id,
            name: r.name ?? "Feature",
            url: r.url ?? null,
            lat: Number(r.lat),
            lng: Number(r.lng),
            issue_slug: r.issues?.slug ?? null,
          })) ?? [];
      }

      // --- DISTRIBUTORS (only those with coordinates, from published issues) ---
      let dRows: DistributorRow[] = [];
      if (view === "both" || view === "distributors") {
        let d = supabase
          .from("distributors")
          .select(
            `
            id,
            name,
            lat,
            lng,
            issues!inner ( slug, status )
          `
          )
          .not("lat", "is", null)
          .not("lng", "is", null)
          .eq("issues.status", "published");

        if (issueSlug) d = d.eq("issues.slug", issueSlug);

        const { data } = await d;
        dRows =
          (data ?? []).map((r: any) => ({
            id: r.id,
            name: r.name ?? "Distributor",
            lat: Number(r.lat),
            lng: Number(r.lng),
            issue_slug: r.issues?.slug ?? null,
          })) ?? [];
      }

      if (!aborted) {
        setFeatures(fRows);
        setDistributors(dRows);
        setLoading(false);
      }
    }

    run();
    return () => {
      aborted = true;
    };
  }, [view, issueSlug]);

  /** bounds */
  const bounds = useMemo(() => {
    const pts: [number, number][] = [];
    if (view !== "distributors") {
      features.forEach((f) => {
        if (isFinite(f.lat) && isFinite(f.lng)) pts.push([f.lat, f.lng]);
      });
    }
    if (view !== "features") {
      distributors.forEach((d) => {
        if (isFinite(d.lat) && isFinite(d.lng)) pts.push([d.lat, d.lng]);
      });
    }
    if (pts.length === 0) return null;
    return L.latLngBounds(pts);
  }, [features, distributors, view]);

  const countF = features.length;
  const countD = distributors.length;

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
            All ({countF + countD})
          </button>
          <button
            className={`rounded-md border-2 border-black px-3 py-1 text-sm sm:text-base text-black ${
              view === "features" ? "bg-white" : "bg-white/70"
            }`}
            onClick={() => setView("features")}
          >
            Features ({countF})
          </button>
          <button
            className={`rounded-md border-2 border-black px-3 py-1 text-sm sm:text-base text-black ${
              view === "distributors" ? "bg-white" : "bg-white/70"
            }`}
            onClick={() => setView("distributors")}
          >
            Distributors ({countD})
          </button>

          {/* Issue dropdown */}
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
      <MapContainer center={[40.73, -73.93]} zoom={11} className="w-full h-[calc(100vh-0px)]" preferCanvas>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsOnce bounds={bounds} />

        {/* Features */}
        {(view === "both" || view === "features") &&
          features.map((f) => (
            <Marker key={`f-${f.id}`} position={[f.lat, f.lng]} icon={ICON_FEATURE}>
              <Popup>
                <div className="min-w-[200px]">
                  <div className="font-semibold">{f.name ?? "Feature"}</div>
                  {f.issue_slug && (
                    <a href={`/issues/${f.issue_slug}`} className="underline text-sm block">
                      View issue
                    </a>
                  )}
                  {ensureAbsoluteUrl(f.url) && (
                    <a
                      className="underline text-xs text-blue-700"
                      href={ensureAbsoluteUrl(f.url)!}
                      target="_blank"
                    >
                      {f.url}
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Distributors */}
        {(view === "both" || view === "distributors") &&
          distributors.map((d) => (
            <Marker key={`d-${d.id}`} position={[d.lat, d.lng]} icon={ICON_DISTRIB}>
              <Popup>
                <div className="min-w-[200px]">
                  <div className="font-semibold">{d.name ?? "Distributor"}</div>
                  {d.issue_slug && (
                    <a href={`/issues/${d.issue_slug}`} className="underline text-sm block">
                      View issue
                    </a>
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
