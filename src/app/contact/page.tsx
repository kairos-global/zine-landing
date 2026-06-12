export default function ContactPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#F0EBCC] text-black px-6 gap-4">
      <p className="text-base font-semibold uppercase tracking-widest text-gray-500">Get in touch</p>
      <a
        href="mailto:hello@zineground.com"
        className="text-3xl md:text-5xl font-black text-black hover:underline"
      >
        hello@zineground.com
      </a>
    </main>
  )
}
