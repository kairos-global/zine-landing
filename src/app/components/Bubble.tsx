import Link from "next/link";

interface BubbleProps {
  label: string;
  color: string;
  href?: string; // Optional route path
}

const Bubble = ({ label, color, href }: BubbleProps) => {
  const bubbleContent = (
    <div
      className={`flex items-center justify-center w-34 h-34 rounded-full border-5 border-black shadow-md text-black font-medium hover:bg-gray-100 transition z-10`}
      style={{ backgroundColor: `#${color}` }}
    >
      {label}
    </div>
  );

  return href ? <Link href={href}>{bubbleContent}</Link> : bubbleContent;
};

export default Bubble;
