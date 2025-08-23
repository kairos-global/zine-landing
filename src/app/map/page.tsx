// src/app/map/page.tsx
import MapClient from "./MapClient";

export const dynamic = "force-dynamic"; // always render fresh

export default function MapPage() {
  // Server component just renders the client map.
  return (
    <main className="relative min-h-screen">
      <MapClient />
    </main>
  );
}
