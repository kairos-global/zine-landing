// src/app/browse-zines/MakeZineButton.tsx
import Link from "next/link";

export default function MakeZineButton() {
  return (
    <Link
      href="/zinemat"
      className="rounded-xl border px-3 py-2 hover:bg-black/5"
    >
      Make a Zine
    </Link>
  );
}
