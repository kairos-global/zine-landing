import Image from 'next/image';
import BubbleGrid from './components/BubbleGrid';
import RollingQuotes from './components/RollingQuotes';
import AnnouncementsBox from './components/AnnouncementsBox';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[#F0EBCC] text-black relative overflow-hidden">
      <section className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center">
        <BubbleGrid />
      </section>

      <RollingQuotes />

      {/* Fixed Announcements Box – hide on small screens */}
      <div className="hidden md:block fixed top-21 right-25 z-10">
        <AnnouncementsBox />
      </div>

      {/* Fixed Landing Page Graphic – hide on small screens */}
      <div className="hidden md:block fixed bottom-[-30px] right-[-30px] z-0 w-[900px] h-auto rounded-4xl border-[5px] border-black overflow-hidden">
        <Image
          src="/images/kairos-bp.jpg"
          alt="Landing Page Graphic"
          width={600}
          height={400}
          className="w-full h-auto object-cover"
          priority
        />
      </div>
    </main>
  );
}
