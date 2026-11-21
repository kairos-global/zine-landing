"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, CircleMarker, TileLayer, useMap } from "react-leaflet";
import type { Coordinates, MapLocation } from "@/lib/map-directory";
import "leaflet/dist/leaflet.css";

const center: [number, number] = [31.7619, -106.485];
const marker = (selected: boolean) => L.divIcon({
  className: selected ? "zg-pin zg-pin-selected" : "zg-pin",
  html: "<span></span>",
  iconSize: [25, 25],
  iconAnchor: [12, 12],
});
const pin = marker(false);
const activePin = marker(true);

type Props = {
  locations: MapLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  position: Coordinates | null;
  command: { type: "all" | "location" | "nearby"; target?: Coordinates | MapLocation; sequence: number };
  onBounds: (bounds: { south: number; west: number; north: number; east: number }) => void;
};

function Camera({ locations, command, onBounds }: Pick<Props, "locations" | "command" | "onBounds">) {
  const map = useMap();
  const locationsRef = useRef(locations);
  locationsRef.current = locations;
  const onBoundsRef = useRef(onBounds);
  onBoundsRef.current = onBounds;

  useEffect(() => {
    const publish = () => {
      const bounds = map.getBounds();
      onBoundsRef.current({
        south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast(),
      });
    };
    publish();
    map.on("moveend resize", publish);
    return () => { map.off("moveend resize", publish); };
  }, [map]);

  useEffect(() => {
    if (command.target) {
      map.setView(command.target, Math.max(map.getZoom(), command.type === "nearby" ? 12 : 15));
      return;
    }
    const points = locationsRef.current.map(({ lat, lng }) => L.latLng(lat, lng));
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: points.length === 1 ? 14 : 15 });
  }, [command, map]);

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <div className="pointer-events-none absolute right-3 top-16 z-[450] grid gap-1.5 md:right-4 md:top-4">
      <button type="button" className="zg-button pointer-events-auto !px-3 !text-lg shadow-md" onClick={() => map.zoomIn()} aria-label="Zoom in">+</button>
      <button type="button" className="zg-button pointer-events-auto !px-3 !text-lg shadow-md" onClick={() => map.zoomOut()} aria-label="Zoom out">−</button>
    </div>
  );
}

export default function DirectoryMap({ locations, selectedId, onSelect, position, command, onBounds }: Props) {
  return (
    <MapContainer center={center} zoom={11} minZoom={2} zoomControl={false} className="relative isolate h-full w-full bg-[#e6e3dc]">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Camera locations={locations} command={command} onBounds={onBounds} />
      <ZoomControls />
      {position && <CircleMarker center={position} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: "#1565bf", fillOpacity: 1 }} />}
      {locations.map((location) => (
        <Marker
          key={location.id}
          position={location}
          title={location.name}
          alt={location.name}
          icon={location.id === selectedId ? activePin : pin}
          zIndexOffset={location.id === selectedId ? 100 : 0}
          eventHandlers={{ click: () => onSelect(location.id) }}
        />
      ))}
    </MapContainer>
  );
}
