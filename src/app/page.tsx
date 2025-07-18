import Image from 'next/image';
import Navbar from './components/Navbar';
import BubbleGrid from './components/BubbleGrid';
import RollingQuotes from './components/RollingQuotes';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[#F0EBCC] text-black relative overflow-hidden">
      <Navbar />

      <section className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center">
        <BubbleGrid />
      </section>

      <RollingQuotes />

      {/* Fixed Kairos Graphic Bottom-Right */}
      <div className="fixed bottom-[-30px] right-[-30px] z-0 w-[900px] h-auto rounded-4xl border-[5px] border-black overflow-hidden">
        <Image
          src="/images/kairos-bp.jpg"
          alt="Kairos Graphic"
          width={600}
          height={400}
          className="w-full h-auto object-cover"
          priority
        />
      </div>
    </main>
  );
}
