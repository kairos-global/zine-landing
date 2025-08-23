import Link from "next/link";

interface BubbleProps {
  label: string;
  color: string;
  href?: string; // Optional route path
}

const Bubble = ({ label, color, href }: BubbleProps) => {
  const bubbleContent = (
    <div
      className="
        flex items-center justify-center
        aspect-square
        w-28 sm:w-28 md:w-30 lg:w-34
        rounded-full border-[5px] border-black shadow-md
        text-black font-medium
        hover:bg-gray-100 transition
        z-10
      "
      style={{ backgroundColor: `#${color}` }}
    >
      {label}
    </div>
  );

  return href ? <Link href={href}>{bubbleContent}</Link> : bubbleContent;
};

export default Bubble;
