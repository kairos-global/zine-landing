'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';

const Navbar = () => {
  const [open, setOpen] = useState(false);

  const links = [
    { label: 'About', href: '/about' },
    { label: 'Products', href: '/products' },
    { label: 'Contact', href: '/contact' },
    { label: 'Browse zines', href: '/browse-zines' },
  ];

  const buttonCls =
    "rounded-md border border-black bg-white/80 hover:bg-white px-3 py-2 text-sm font-medium text-black";

  return (
    <nav className="w-full px-6 py-4 flex justify-between items-center bg-[#AAEEFF] border-b-3 border-black z-50 relative">
      <Link href="/" className="text-xl font-bold hover:underline text-black">
        Zineground
      </Link>

      {/* Desktop links */}
      <ul className="hidden md:flex items-center gap-14 text-xl font-normal text-black">
        {links.map(({ label, href }, idx) => (
          <li key={idx}>
            <Link href={href} className="hover:underline hover:text-black">
              {label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Right-side auth button (single rectangular button) */}
      <div className="hidden md:block">
        <SignedOut>
          <SignInButton mode="modal" forceRedirectUrl="/dashboard">
            <button className={buttonCls}>Login</button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Link href="/dashboard" className={buttonCls}>
            Dashboard
          </Link>
        </SignedIn>
      </div>

      {/* Mobile toggle */}
      <button
        className="md:hidden px-3 py-2 rounded-md border border-black bg-white/70 hover:bg-white active:bg-black/10"
        aria-label="Toggle menu"
        onClick={() => setOpen((v) => !v)}
      >
        ☰
      </button>

      {/* Mobile sheet */}
      {open && (
        <div className="md:hidden absolute left-0 right-0 top-full border-b-4 border-x-4 border-black bg-[#AAEEFF]">
          <ul className="flex flex-col p-4 gap-3 text-black text-base">
            {links.map(({ label, href }) => (
              <li key={href}>
                <Link href={href} onClick={() => setOpen(false)} className="block py-2">
                  {label}
                </Link>
              </li>
            ))}

            {/* Mobile auth button at bottom of sheet */}
            <li className="pt-2">
              <SignedOut>
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button className={buttonCls} onClick={() => setOpen(false)}>
                    Login
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard" className={buttonCls} onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
              </SignedIn>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
