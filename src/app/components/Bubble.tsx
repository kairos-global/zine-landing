"use client";

import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

interface BubbleProps {
  label: string;
  color: string;
  href?: string;
  /** When set, signed-out users see the sign-in modal (like Login) instead of redirecting. */
  forceRedirectUrl?: string;
}

const Bubble = ({ label, color, href, forceRedirectUrl }: BubbleProps) => {
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

  if (forceRedirectUrl != null && href) {
    return (
      <>
        <SignedIn>
          <Link href={href}>{bubbleContent}</Link>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal" forceRedirectUrl={forceRedirectUrl}>
            <button type="button" className="cursor-pointer border-0 bg-transparent p-0 block">
              {bubbleContent}
            </button>
          </SignInButton>
        </SignedOut>
      </>
    );
  }

  return href ? <Link href={href}>{bubbleContent}</Link> : bubbleContent;
};

export default Bubble;
