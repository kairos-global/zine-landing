// src/app/layout.tsx
import './globals.css'
import { ReactNode } from 'react'
import { Space_Grotesk } from 'next/font/google'

export const metadata = {
  title: 'Kairos Zine',
  description: 'Discover your local creative community',
}

const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-space-grotesk',
  })

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body>{children}</body>
    </html>
  )
}
