'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const intro = {
  headline: 'Zineground is independent zine culture, on the ground.',
  body: "We build the tools, the network, and the physical infrastructure so creators can publish, distribute, and get their work into real readers' hands — offline and in person.",
}

type Announcement = {
  title: string
  body: string
  date: string
  category: string
  cta?: { label: string; href: string }
}

type Profile = {
  key: string
  label: string
  blurb: string
  items: Announcement[]
}

const PROFILES: Profile[] = [
  {
    key: 'distributors',
    label: 'Distributors',
    blurb: 'Stock real zines in your space and get them shipped to your door.',
    items: [
      {
        title: 'Browse and order print-ready zines',
        body: "Registered distributors browse and order zines that are ready for distribution — the creator has approved and paid us to print and ship them, or they fulfill it themselves. When you place an order, the creator receives it in their portal to approve or decline. Distributors are charged for shipping once approvals are complete, then we print, fold, pack, and ship the zines to you.",
        date: 'Jun 2, 2026',
        category: 'Distribution',
        cta: { label: 'Open distributor portal', href: '/dashboard/distributor' },
      },
      {
        title: 'Order displays to stock zines in',
        body: 'Distributors can order from the different displays we offer to showcase and stock zines in their shop, cafe, or venue — built around the formats we support.',
        date: 'May 20, 2026',
        category: 'Distribution',
        cta: { label: 'Open distributor portal', href: '/dashboard/distributor' },
      },
    ],
  },
  {
    key: 'creators',
    label: 'Creators & Zines',
    blurb: 'Make a zine, publish it, and put physical copies into the world.',
    items: [
      {
        title: 'Publish and distribute physical copies',
        body: 'Upload your zines and publish them to distribute physical copies. Build everything in ZineMat, our built-in zine toolkit — or try Canvas, our freeform drawing editor currently in testing.',
        date: 'Jun 10, 2026',
        category: 'Creators',
        cta: { label: 'Open ZineMat', href: '/zinemat' },
      },
      {
        title: 'QR codes and links that just work',
        body: 'Add QR codes to your zine from the Interactivity section. Every issue gets an auto-generated issue QR linking to its page, a collection QR readers can scan to collect it, and any custom links you add — each with its own downloadable QR.',
        date: 'May 28, 2026',
        category: 'Creators',
      },
      {
        title: 'We never take your work',
        body: 'Zineground will never claim your work. We make our own zines — even for marketing — and we will never use yours unless we are in direct communication to work together.',
        date: 'Apr 15, 2026',
        category: 'Policy',
      },
      {
        title: 'Offline zines (proposed)',
        body: 'A concept we are building toward: only zine covers are shown online. Once enough distributors join a city or area, that zone can go offline — full zine files are hidden from general users and only covers are shown. Distributors always keep full access through the distributor portal.',
        date: 'On the roadmap',
        category: 'Roadmap',
      },
    ],
  },
  {
    key: 'readers',
    label: 'Find & Collect',
    blurb: 'Discover zines near you and keep the ones you love.',
    items: [
      {
        title: 'Your library',
        body: "After you sign up, your library is where everything lives — browse published zines and keep every issue you've collected in one place.",
        date: 'Jun 1, 2026',
        category: 'Readers',
        cta: { label: 'Browse zines', href: '/browse-zines' },
      },
      {
        title: 'Collection QR codes',
        body: 'Scan the collection QR printed inside a physical zine and the digital issue is added to your library — a simple bridge between the copy in your hands and your account.',
        date: 'May 12, 2026',
        category: 'Readers',
      },
    ],
  },
]

const FAQS = [
  {
    q: 'What formats are accepted?',
    cat: 'Formats',
    a: "Currently only the mini zine. We'll be offering half-letter zines in the near future.",
  },
  {
    q: 'What file types can I upload in the ZineMat uploads section?',
    cat: 'Uploads',
    a: "Any file type works. If you're distributing, follow our recommended print settings. For now, your layout must be a single horizontal 8.5 × 11 letter-size document.",
  },
  {
    q: 'How do I know when my zines reach the distributor?',
    cat: 'Orders',
    a: 'We notify creators and distributors at every step — when an order is placed, approved or declined, paid, processed, packed, shipped, and delivered. Distributors always get tracking for their order. Turn on email or SMS notifications in your profile settings to stay on top of things.',
  },
  {
    q: 'What if my work is duplicated or reproduced?',
    cat: 'Protection',
    a: 'Report it. Published zines are actively monitored, and violations result in account bans and, where applicable, accreditation of the order to the rightful owner of the work.',
  },
]

const CARD_BG = '#E5DBC4'

export default function AboutPage() {
  const [active, setActive] = useState(0)
  const [start, setStart] = useState(0)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const profile = PROFILES[active]
  const items = profile.items

  // Reset the carousel window whenever the profile changes
  useEffect(() => {
    setStart(0)
  }, [active])

  // Auto-cycle the 3-card window only when there are more than 3 announcements
  useEffect(() => {
    if (items.length <= 3) return
    const id = setInterval(() => {
      setStart((s) => (s + 1) % items.length)
    }, 5000)
    return () => clearInterval(id)
  }, [items.length])

  const visible =
    items.length <= 3
      ? items
      : [0, 1, 2].map((o) => items[(start + o) % items.length])

  return (
    <main className="min-h-screen bg-[#F0EBCC] text-black">
      {/* Intro */}
      <section className="max-w-6xl mx-auto px-6 md:px-8 pt-16 pb-10">
        <h1 className="text-4xl md:text-6xl font-black leading-[1.05] max-w-3xl">
          {intro.headline}
        </h1>
        <p className="text-lg md:text-xl leading-relaxed text-black/70 max-w-2xl mt-6">
          {intro.body}
        </p>
      </section>

      {/* Latest releases */}
      <section className="max-w-6xl mx-auto px-6 md:px-8 pb-16">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between mb-8">
          <h2 className="text-3xl md:text-4xl font-black">Latest releases</h2>
          <div className="flex flex-wrap gap-2">
            {PROFILES.map((p, i) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setActive(i)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition border-2 border-black ${
                  i === active
                    ? 'bg-black text-white'
                    : 'bg-transparent text-black hover:bg-black/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-black/60 mb-8 max-w-2xl">{profile.blurb}</p>

        <div key={`${active}-${start}`} className="grid gap-6 md:grid-cols-3">
          {visible.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl p-7 flex flex-col h-full"
              style={{ backgroundColor: CARD_BG }}
            >
              <h3 className="text-2xl font-bold leading-tight">{item.title}</h3>
              <p className="text-base leading-relaxed text-black/75 mt-4">
                {item.body}
              </p>

              <div className="mt-auto pt-8">
                <div className="flex items-center justify-between border-t border-black/15 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-black/50">
                    Date
                  </span>
                  <span className="text-sm font-medium">{item.date}</span>
                </div>
                <div className="flex items-center justify-between border-t border-black/15 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-black/50">
                    Category
                  </span>
                  <span className="text-sm font-medium">{item.category}</span>
                </div>

                {item.cta && (
                  <Link
                    href={item.cta.href}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-black text-white px-5 py-3 text-sm font-semibold hover:bg-gray-800 transition"
                  >
                    {item.cta.label} <span aria-hidden>→</span>
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>

        {items.length > 3 && (
          <div className="flex gap-2 mt-6">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStart(i)}
                aria-label={`Show release ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === start ? 'w-6 bg-black' : 'w-2 bg-black/25 hover:bg-black/40'
                }`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Closing statement + FAQ */}
      <section className="max-w-6xl mx-auto px-6 md:px-8 pb-24">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <h2 className="text-3xl md:text-5xl font-black leading-tight">
            Built for zine makers, readers, and the shops that carry them.
          </h2>

          <div className="flex flex-col">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i
              return (
                <div key={i} className="border-t border-black/15 last:border-b">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-start justify-between gap-6 py-5 text-left"
                  >
                    <span className="text-lg font-bold">{faq.q}</span>
                    <span className="text-sm text-black/50 shrink-0 mt-1">
                      {faq.cat}
                    </span>
                  </button>
                  {isOpen && (
                    <p className="text-base leading-relaxed text-black/70 pb-6 max-w-xl">
                      {faq.a}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}
