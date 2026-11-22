"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Coordinates, MapLocation } from "@/lib/map-directory";
import { isZineCategoryKey, stockedZineCategories, ZINE_CATEGORIES, zineCategoryLabel, type ZineCategoryKey } from "@/lib/zine-categories";

const DirectoryMap = dynamic(() => import("./DirectoryMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm">Loading map…</div>,
});

type Bounds = { south: number; west: number; north: number; east: number };

function distance(a: Coordinates, b: Coordinates) {
  const radians = Math.PI / 180;
  const arc = Math.sin((b.lat - a.lat) * radians / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin((b.lng - a.lng) * radians / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(Math.min(1, arc)));
}

function inBounds(location: MapLocation, bounds: Bounds) {
  const longitude = bounds.west + ((location.lng - bounds.west) % 360 + 360) % 360;
  return location.lat >= bounds.south && location.lat <= bounds.north && longitude <= bounds.east;
}

export default function MapClient({ initialIssue, initialLocation, initialCategory }: {
  initialIssue: string;
  initialLocation: string;
  initialCategory: ZineCategoryKey | "";
}) {
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [category, setCategory] = useState(initialCategory);
  const [issueFilter, setIssueFilter] = useState(initialIssue);
  const [selectedId, setSelectedId] = useState<string | null>(initialLocation);
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [inView, setInView] = useState(false);
  const [panelOpen, setPanelOpen] = useState(Boolean(initialLocation));
  const selectedRow = useRef<HTMLLIElement>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [camera, setCamera] = useState<{ type: "all" | "location" | "nearby"; target?: Coordinates; sequence: number }>({ type: "all", sequence: 0 });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/map", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Directory unavailable");
        return res.json() as Promise<{ locations: MapLocation[] }>;
      })
      .then(({ locations: data }) => {
        const target = data.find((location) => location.id === initialLocation);
        setLocations(data);
        setCamera((prev) => ({ type: target ? "location" : "all", target, sequence: prev.sequence + 1 }));
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadStatus("error");
          setPanelOpen(true);
        }
      });
    return () => controller.abort();
  }, [attempt, initialLocation]);

  useEffect(() => {
    const url = new URL(window.location.href);
    for (const [key, value] of [["category", category], ["issue", issueFilter], ["location", selectedId]] as const) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url);
  }, [category, issueFilter, selectedId]);

  const activeIssue = useMemo(() => {
    if (!issueFilter) return;
    for (const { issues } of locations) {
      const issue = issues.find(({ slug, id }) => slug === issueFilter || id === issueFilter);
      if (issue) return issue;
    }
  }, [issueFilter, locations]);
  const categoryLabel = zineCategoryLabel(category);

  const matches = useMemo(() => locations.filter(({ issues }) => (
    (!category || issues.some((issue) => issue.category === category))
    && (!issueFilter || issues.some(({ slug, id }) => slug === issueFilter || id === issueFilter))
  )).sort((a, b) => position ? distance(position, a) - distance(position, b) : a.name.localeCompare(b.name)),
  [locations, category, issueFilter, position]);

  const shown = inView && bounds ? matches.filter((location) => inBounds(location, bounds)) : matches;
  const selected = shown.find(({ id }) => id === selectedId);
  const selectedCategories = selected ? stockedZineCategories(selected.issues) : [];

  useEffect(() => {
    if (panelOpen && selected) selectedRow.current?.scrollIntoView({ block: "nearest" });
  }, [panelOpen, selected]);

  function select(id: string, pan: boolean) {
    const target = matches.find((match) => match.id === id);
    if (!target) return;
    setSelectedId(id);
    if (pan) setCamera((prev) => ({ type: "location", target, sequence: prev.sequence + 1 }));
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocationError("Location is unavailable on this device.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const target = { lat: coords.latitude, lng: coords.longitude };
      setPosition(target);
      setInView(false);
      setCamera((prev) => ({ type: "nearby", target, sequence: prev.sequence + 1 }));
      setLocating(false);
    }, () => {
      setLocating(false);
      setLocationError("Couldn’t get your location. You can still pan or zoom the map.");
    }, { timeout: 8000, maximumAge: 60000 });
  }

  return (
    <main className="relative isolate h-dvh w-full overflow-hidden bg-[#e6e3dc] text-black">
      <h1 className="sr-only">Zine Map</h1>
      <div className="absolute inset-x-3 top-3 z-20 mx-auto max-w-lg rounded-2xl border-4 border-black bg-[#AAEEFF] px-3 py-2.5 shadow-lg sm:px-4 sm:py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:gap-x-3">
          <Link href="/" aria-label="Zineground home" className="zg-button !min-h-8 shrink-0 !px-2 !py-0">
            <span aria-hidden="true">←</span>
          </Link>
          <button
            className="flex min-h-8 items-center gap-2 rounded font-bold tracking-tight hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            type="button"
            aria-controls="map-results"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
          >
            <span aria-hidden="true" className="size-4 rounded-full border-[2.5px] border-black bg-[#D16FF2] shadow-[0_2px_0_#0003]" />
            <span className="text-sm sm:text-base">Distributors</span>
            {loadStatus !== "error" && (
              <span className="rounded-full bg-black px-2 py-0.5 text-xs text-white" aria-live="polite">
                {loadStatus === "ready" ? shown.length : "…"}
              </span>
            )}
          </button>
          <select
            aria-label="Stocked zine category"
            className="min-w-[7.5rem] flex-1 cursor-pointer rounded-lg border-2 border-black bg-white px-2 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 sm:max-w-52 sm:px-3"
            value={category}
            onChange={(event) => {
              const value = event.target.value;
              setCategory(isZineCategoryKey(value) ? value : "");
              setSelectedId(null);
            }}
          >
            <option value="">All categories</option>
            {ZINE_CATEGORIES.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        {issueFilter && (
          <button type="button" className="mt-1 block max-w-full truncate rounded text-left text-xs font-bold underline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => setIssueFilter("")}>
            Clear issue filter{activeIssue ? ` · ${activeIssue.title}` : ""}
          </button>
        )}
      </div>

      <section
        id="map-results"
        aria-labelledby="map-results-title"
        hidden={!panelOpen}
        className="zg-panel absolute inset-x-3 bottom-7 z-10 max-h-[min(44%,calc(50%_-_3rem))] overflow-y-auto overscroll-contain scroll-pt-12 shadow-lg md:inset-x-auto md:bottom-auto md:left-4 md:top-28 md:max-h-[calc(100%_-_8.75rem)] md:w-[22rem]"
      >
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b-2 border-black bg-[#AAEEFF] px-4 py-2.5">
          <h2 id="map-results-title" className="font-black" aria-live="polite">{loadStatus === "ready" ? `${shown.length} ${shown.length === 1 ? "location" : "locations"}` : "Locations"}</h2>
          <Link href="/contact?topic=map" className="text-sm font-bold underline">Suggest a distributor</Link>
        </div>
        <div className="space-y-2.5 border-b border-black/15 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className="zg-button" type="button" disabled={locating} onClick={locate}>{locating ? "Locating…" : "Near me"}</button>
            <button className="zg-button" type="button" disabled={!matches.length} onClick={() => { setInView(false); setCamera((prev) => ({ type: "all", sequence: prev.sequence + 1 })); }}>Fit results</button>
            <label className="flex items-center gap-1.5 text-sm font-bold"><input type="checkbox" className="accent-black" checked={inView} onChange={(event) => setInView(event.target.checked)} /> This map area</label>
          </div>
          {locationError && <p role="status" className="text-sm">{locationError}</p>}
        </div>
        {loadStatus === "loading" && <p className="p-4 text-sm" role="status">Loading distributor listings…</p>}
        {loadStatus === "error" && <div className="p-4"><p role="alert" className="mb-2 text-sm">The directory couldn’t load.</p><button className="zg-button" onClick={() => { setLoadStatus("loading"); setAttempt(attempt + 1); }}>Try again</button></div>}
        {loadStatus === "ready" && !shown.length && (
          <div className="space-y-2 p-4 text-sm">
            <p>{inView ? "No matching distributors in this map area." : categoryLabel ? `No matching distributors have ${categoryLabel} zines in stock.` : issueFilter ? "No matching distributors stock this issue." : "No matching distributors."}</p>
            {(category || issueFilter || inView) && <button className="font-bold underline" onClick={() => { setCategory(""); setIssueFilter(""); setInView(false); }}>Clear filters</button>}
          </div>
        )}
        <ul className="divide-y divide-black/15">
          {shown.map((location) => (
            <li ref={selected?.id === location.id ? selectedRow : undefined} key={location.id} className={selected?.id === location.id ? "bg-[#e9faff]" : ""}>
              <button type="button" className="block w-full px-4 py-3 text-left hover:bg-[#e9faff]" aria-expanded={selected?.id === location.id} onClick={() => selected?.id === location.id ? setSelectedId(null) : select(location.id, true)}>
                <span className="block font-black">{location.name}</span>
                <span className="block text-sm text-black/70">{location.address}</span>
                <span className="mt-1 block text-xs font-bold">{location.issues.length} stocked {location.issues.length === 1 ? "issue" : "issues"}{position ? ` · ${distance(position, location).toFixed(1)} mi` : ""}</span>
              </button>
              {selected?.id === location.id && (
                <div className="px-4 pb-4 text-sm">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <a className="zg-button" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address)}`} target="_blank" rel="noreferrer">Directions ↗</a>
                    {location.email && <a className="zg-button" href={`mailto:${location.email}`}>Email shop</a>}
                  </div>
                  {selectedCategories.length > 0 && (
                    <div className="mb-3">
                      <h3 className="mb-1 text-xs font-bold">Categories in stock</h3>
                      <ul className="flex flex-wrap gap-1.5">
                        {selectedCategories.map(({ key, label }) => (
                          <li key={key} className="rounded-full border border-black bg-[#AAEEFF] px-2 py-0.5 text-xs font-bold">{label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {location.issues.map((issue) => <Link key={issue.id} className="block py-0.5 font-bold underline" href={`/issues/${encodeURIComponent(issue.slug)}`}>{issue.title} ↗</Link>)}
                  <Link className="mt-2 inline-block text-xs underline" href={`/contact?topic=map&reference=${encodeURIComponent(location.name)}`}>Report a listing update</Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Distributor map" className="absolute inset-0">
        <DirectoryMap locations={matches} selectedId={selectedId} position={position} command={camera} onBounds={setBounds} onSelect={(id) => {
          select(id, false);
          setPanelOpen(true);
        }} />
      </section>
    </main>
  );
}
