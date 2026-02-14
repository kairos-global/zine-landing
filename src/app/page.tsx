import Image from 'next/image';
import BubbleGrid from './components/BubbleGrid';
import RollingQuotes from './components/RollingQuotes';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[#F0EBCC] text-black relative overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-[#F0EBCC]" aria-hidden="true" />

      <section className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center">
        <BubbleGrid />
      </section>

      <RollingQuotes />

      {/* Fixed Landing Page Graphic – hide on small screens */}
      <div className="hidden md:block fixed bottom-[-30px] right-[-30px] z-0 w-[725px] h-auto rounded-4xl border-[5px] border-black overflow-hidden">
        <Image
          src="/images/ZG_Collage.png"
          alt="Landing Page Graphic"
          width={900}
          height={600}
          className="w-full h-full object-cover"
          priority
        />
      </div>
    </main>
  );
}
