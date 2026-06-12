'use client'

const intro = {
  headline: 'Zineground is a platform for independent zine culture.',
  body: 'We build the tools, the network, and the physical infrastructure so creators can publish, distribute, and get their work into the hands of real readers — offline and in person.',
}

const sections = [
  {
    color: '#A4A4A4',
    title: 'Browse Zines',
    body: 'Discover self-published zines from creators in your community. Poetry, personal essays, local guides, niche obsessions — all independent, all on the ground.',
  },
  {
    color: '#65CBF1',
    title: 'Make a Zine',
    body: 'ZineMat is our built-in zine toolkit. Set your format, build your layout, add interactive links and QR codes, and publish — without ever leaving the platform.',
  },
  {
    color: '#F2DC6F',
    title: 'My Library',
    body: 'Everything you make lives here. Save drafts as you go, manage your published issues, download your PDFs, and see who has collected your work.',
  },
  {
    color: '#D16FF2',
    title: 'Distribution',
    body: 'Print copies of your zine and get them into local shops, cafes, and venues through the Zineground distributor network. We handle print fulfillment — you set the terms.',
  },
  {
    color: '#F26565',
    title: 'The Map',
    body: 'Every verified Zineground distributor is on the map. Readers can find where to pick up physical zines near them. Distributors appear once approved and address-verified.',
  },
  {
    color: '#82E385',
    title: 'The Market',
    body: 'A space to buy and sell creative services inside the Zineground community. Covers, layouts, illustrations, logos — if it belongs on a zine, it belongs here.',
  },
  {
    color: '#FAB95B',
    title: 'Store',
    body: 'Physical tools for the zine maker. Displays for your shop or venue, creasing plates, cutting tools, and more — designed around the formats we support.',
  },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#F0EBCC] text-black">
      {/* Intro block */}
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-4 md:px-8">
        <h1 className="text-4xl md:text-5xl font-black leading-tight mb-5">
          {intro.headline}
        </h1>
        <p className="text-lg leading-relaxed text-gray-700 max-w-xl">
          {intro.body}
        </p>
      </div>

      {/* Feature sections */}
      <div className="max-w-3xl mx-auto px-6 pb-20 md:px-8 flex flex-col gap-5 mt-10">
        {sections.map((section, i) => (
          <div
            key={i}
            className={`rounded-3xl p-8 w-[85%] ${i % 2 === 0 ? 'mr-auto' : 'ml-auto'} border-[3px] border-dashed border-black`}
            style={{ backgroundColor: section.color }}
          >
            <h2 className="text-xl font-semibold mb-2">{section.title}</h2>
            <p className="text-base leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
