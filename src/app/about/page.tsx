'use client'

import { useState } from 'react'

type Release = { title: string; body: string }
type Group = { key: string; label: string; tint: string; items: Release[] }

const GROUPS: Group[] = [
  {
    key: 'distribute',
    label: 'Distribute',
    tint: '#F3D9FB',
    items: [
      {
        title: 'Browse and order zines ready for distribution',
        body: "Registered distributors can browse and order zines that are ready for distribution. This means the creator has approved and paid us to print and send them to you — or they'll do it themselves! When you place an order, the creator receives it in their portal and can approve or decline it. Distributors are charged for shipping once their order approvals are completed, and we print, fold, pack, and ship the zines to the distributor.",
      },
      {
        title: 'Order displays to stock zines in',
        body: 'Distributors can order from the different displays we offer to stock zines in.',
      },
    ],
  },
  {
    key: 'create',
    label: 'Create',
    tint: '#D6EFFA',
    items: [
      {
        title: 'Upload and publish your zines',
        body: 'Upload your zines and publish them to distribute physical copies. Use ZineMat, our built-in zine toolkit — and Canvas, currently in testing.',
      },
      {
        title: 'QR codes and links',
        body: 'Add QR codes to your zines and control how your links work — issue QRs, collection QRs, and your own custom links, each with a downloadable QR.',
      },
      {
        title: 'We never take your work',
        body: "Zineground never takes your work. We make our own zines — even for marketing purposes — and we never will use yours unless we're in communication to work together.",
      },
      {
        title: 'Offline zines (proposed)',
        body: 'A proposed concept where only zine covers are shown online. Once there are enough distributors in a city or area, that zone can go offline and only display zine covers, no longer allowing all users to see full zine files. Distributors can always see full zines, since they have exclusive access to the distributor portal.',
      },
    ],
  },
  {
    key: 'read',
    label: 'Read',
    tint: '#FBF3C9',
    items: [
      {
        title: 'Find zines and distributors on the map',
        body: 'Find zines and distributors on the map to see what is being made and where to pick up physical copies near you.',
      },
      {
        title: 'Your library',
        body: 'After signing up, your library will allow you to view all your zines and collect them there.',
      },
      {
        title: 'Collection QR codes',
        body: 'Scan the collection QR printed inside a physical zine to add the digital issue to your library — a simple bridge between the copy in your hands and your account.',
      },
    ],
  },
]

const FAQS = [
  {
    q: 'Can I distribute from anywhere?',
    a: "We're currently accepting the USA only, starting in El Paso, Texas. Businesses can be any third space — coffee shops, local bookstores, comic shops, hair salons, and more.",
  },
  {
    q: 'What formats are acceptable?',
    a: "Currently only the mini zine, although we'll be offering half-letter zines in the near future.",
  },
  {
    q: 'What file types can I upload in the ZineMat uploads section?',
    a: "Any file type works. If you're distributing, follow our recommended print settings. For now, your layout must be a horizontal 8.5 × 11 letter-size single document.",
  },
  {
    q: 'How do I know when my zines arrive at the distributor?',
    a: "We notify creators and distributors when orders are placed, approved or declined, paid, processed, packed, shipped, and delivered. We always provide distributors with tracking of their order. You can enable push, email, or SMS notifications in your profile settings if you'd like to stay on top of things.",
  },
  {
    q: 'What if my work is duplicated and reproduced?',
    a: 'Report it. Published zines are actively monitored, and violations will result in account bans and, where applicable, order accreditation to the owner of the work.',
  },
]

export default function AboutPage() {
  const [selected, setSelected] = useState<{ release: Release; group: Group } | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <main className="min-h-screen bg-[#F0EBCC] text-black">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-16">
        {/* Hero */}
        <header className="mb-16">
          <h1 className="text-4xl md:text-6xl font-black leading-[1.05]">
            Zineground is a platform for distribution.
          </h1>
          <p className="text-lg md:text-xl text-black/60 mt-4">
            Starting with the Mini Zine.
          </p>
        </header>

        {/* Releases — one section, divided into Distribute / Create / Read */}
        <div className="flex flex-col gap-14">
          {GROUPS.map((group) => (
            <section key={group.key}>
              <div className="flex items-baseline gap-4 border-b-2 border-black pb-3 mb-6">
                <h2 className="text-2xl md:text-3xl font-black">{group.label}</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {group.items.map((release) => (
                  <div
                    key={release.title}
                    className="border-2 border-black rounded-2xl overflow-hidden bg-white flex flex-col"
                  >
                    <button
                      onClick={() => setSelected({ release, group })}
                      className="w-full aspect-square border-b-2 border-black flex items-center justify-center cursor-pointer transition-colors hover:brightness-95"
                      style={{ backgroundColor: group.tint }}
                      aria-label={`Read: ${release.title}`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
                        {group.label}
                      </span>
                    </button>

                    <div className="p-4 flex flex-col gap-3 flex-1">
                      <p className="font-bold text-sm leading-snug flex-1">{release.title}</p>
                      <button
                        onClick={() => setSelected({ release, group })}
                        className="w-full border-2 border-black rounded-lg py-1.5 text-sm font-semibold hover:bg-black hover:text-white transition-colors"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* FAQ */}
          <section>
            <div className="border-b-2 border-black pb-3 mb-2">
              <h2 className="text-2xl md:text-3xl font-black">FAQ</h2>
            </div>
            <div className="flex flex-col">
              {FAQS.map((faq, i) => {
                const isOpen = openFaq === i
                return (
                  <div key={i} className="border-b border-black/15">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-6 py-5 text-left"
                    >
                      <span className="text-base md:text-lg font-bold">{faq.q}</span>
                      <span className="text-2xl font-light leading-none shrink-0">
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                    {isOpen && (
                      <p className="text-base leading-relaxed text-black/70 pb-6 max-w-2xl">
                        {faq.a}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Read modal — same pattern as the Store */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 md:p-10"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white border-2 border-black rounded-2xl overflow-hidden flex w-full max-w-2xl max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="hidden sm:flex w-4/12 shrink-0 border-r-2 border-black items-center justify-center"
              style={{ backgroundColor: selected.group.tint }}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
                {selected.group.label}
              </span>
            </div>

            <div className="flex-1 p-8 overflow-y-auto flex flex-col min-h-[320px]">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
                  {selected.group.label}
                </span>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xl font-bold leading-none text-gray-400 hover:text-black transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <h2 className="text-2xl font-black mt-4 leading-tight">{selected.release.title}</h2>
              <p className="text-base text-black/75 mt-5 leading-relaxed">{selected.release.body}</p>

              <div className="mt-auto pt-8">
                <button
                  onClick={() => setSelected(null)}
                  className="w-full border-2 border-black py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
