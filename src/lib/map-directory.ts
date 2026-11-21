export type MapIssue = { id: string; slug: string; title: string };
export type MapLocation = {
  id: string;
  name: string;
  address: string;
  email: string | null;
  lat: number;
  lng: number;
  issues: MapIssue[];
};
export type Coordinates = { lat: number; lng: number };
