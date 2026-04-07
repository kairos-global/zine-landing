'use client'

const sections = [
  {
    color: '#A4A4A4',
    title: 'Browse Zines',
    body: 'Discover self-published zines from creators in your community. From poetry and personal essays to local guides and niche obsessions — everything is independent and on the ground.',
  },
  {
    color: '#65CBF1',
    title: 'Upload Zines',
    body: 'Use ZineMat, our built-in zine toolkit, to design and publish your zine directly on Zineground. Build your layout, add interactive links, generate QR codes, and publish — all in one place.',
  },
  {
    color: '#F2DC6F',
    title: 'My Library',
    body: 'All your work, always accessible. Save drafts as you go, manage your published issues, and download your PDFs whenever you need them.',
  },
  {
    color: '#D16FF2',
    title: 'Distribution',
    body: 'Physical zine distribution through a growing network of local shops, cafés, and venues. Apply to become a distributor or order print copies of your work to put in the hands of real readers.',
  },
  {
    color: '#F26565',
    title: 'The Map',
    body: 'Find Zineground distributors near you. Every approved location is verified and pinned so readers always know where to pick up a copy.',
  },
  {
    color: '#82E385',
    title: 'The Market',
    body: 'A space to buy and sell creative services within the Zineground community. Covers, layouts, illustrations, logos — if it belongs on a zine, it belongs here.',
  },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen px-6 py-14 md:px-16 bg-[#F0EBCC] text-black">
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
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
