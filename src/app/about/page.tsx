'use client'

export default function AboutPage() {
  return (
    <main className="min-h-screen px-4 py-12 md:px-16 bg-[#F0EBCC] text-black">
      <h1 className="text-4xl md:text-5xl font-semibold text-center mb-12">About</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto [&>*]:min-h-[280px]">
        <div className="bg-[#888888] text-white rounded-3xl p-6 md:p-8 shadow-md flex flex-col justify-between">
          <h2 className="text-2xl font-semibold mb-2">What is a zine?</h2>
          <p className="text-base leading-relaxed">
            A zine is a small, self-published magazine. You can design it, write it, collage it, or create it however you want.
            <br /><br />
            Use digital tools, print it by hand, fold it, copy it, or leave it messy on purpose. There are no rules — just your voice on the page.
          </p>
        </div>

        <div className="bg-[#888888] text-white rounded-3xl p-6 md:p-8 shadow-md flex flex-col justify-between">
          <h2 className="text-2xl font-semibold mb-2">What is zineground?</h2>
          <p className="text-base leading-relaxed">
            A local print and digital zine.
            <br /><br />
            We feature creative talent, local events, and standout businesses from our community.
          </p>
        </div>

        <div className="bg-[#888888] text-white rounded-3xl p-6 md:p-8 shadow-md flex flex-col justify-between">
          <h2 className="text-2xl font-semibold mb-2">Get Featured!</h2>
          <p className="text-base leading-relaxed">
            Artists, musicians, designers, writers, organizers, and more.
            <br /><br />
            If you’re making something or moving culture, we want to highlight you. Use the “Feature Me!” page to apply.
          </p>
        </div>

        <div className="bg-[#888888] text-white rounded-3xl p-6 md:p-8 shadow-md flex flex-col justify-between">
          <h2 className="text-2xl font-semibold mb-2">Advertise or Distribute</h2>
          <p className="text-base leading-relaxed">
            Run a shop, café, venue, or want to support the zine? You can advertise or become a local distributor of the zine!
            <br /><br />
            Check out “Advertise” and “Distribute” to get started.
          </p>
        </div>
      </div>
    </main>
  )
}
