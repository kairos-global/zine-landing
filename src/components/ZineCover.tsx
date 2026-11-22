export default function ZineCover({ src, title }: { src?: string | null; title?: string | null }) {
  return (
    <div className="grid aspect-[198/306] w-full place-items-center bg-neutral-100">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title ? `Cover of ${title}` : "Zine cover"} className="size-full object-contain" loading="lazy" />
      ) : <span className="text-sm text-neutral-500">No cover</span>}
    </div>
  );
}
