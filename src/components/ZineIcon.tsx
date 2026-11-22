const paths = {
  book: "M12 5c-3-2-6-2-10-1v14c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v14",
  bookmark: "M6 3h12v18l-6-4-6 4V3Z",
  box: "M3 7 12 3l9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10M7.5 5l9 4",
  cart: "M2 3h3l3 13h11l3-9H6m4 13h.01M18 20h.01",
  check: "m4 12 5 5L20 6",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  map: "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  pause: "M9 5v14M15 5v14",
  play: "M8 5l11 7-11 7V5Z",
  share: "M12 16V3m-4 4 4-4 4 4M6 10H4v11h16V10h-2",
  printer: "M7 8V3h10v5M7 16H3V8h18v8h-4M7 13h10v8H7zM17 11h1",
  sheet: "M3 5h18v14H3zM3 12h18M8 5v14m8-14v14",
};

export default function ZineIcon({ name, className }: { name: keyof typeof paths; className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
