import type { Metadata } from "next";
import MapClient from "./MapClient";

export const metadata: Metadata = {
  title: "Zine Map | Zineground",
  description: "Find verified Zineground distributors and see which issues they stock.",
};

export default async function MapPage({ searchParams }: { searchParams: Promise<{ issue?: string; location?: string }> }) {
  const { issue, location } = await searchParams;
  return <MapClient initialIssue={typeof issue === "string" ? issue : ""} initialLocation={typeof location === "string" ? location : ""} />;
}
