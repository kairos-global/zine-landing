// src/app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';
import { Space_Grotesk } from 'next/font/google';
import { ClerkProvider } from "@clerk/nextjs";
import Navbar from './components/Navbar';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'Zineground',
  description: 'Zineground is a zine distribution network.',
  icons: {
    icon: "/zineground.ico",
  },
};

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={spaceGrotesk.variable}>
        <body className="bg-[#F0EBCC] text-black antialiased min-h-screen overflow-x-hidden">
          <Navbar />
          {children}
          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              className:
                "rounded-xl shadow-md bg-white text-black px-4 py-2 font-medium border border-gray-200",
              duration: 3000,
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
