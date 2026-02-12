import Bubble from "./Bubble";

const BubbleGrid = () => {
  const bubbles = [
    { label: "Map", color: "F26565", href: "/map" },
    { label: "Upload Zine", color: "65CBF1", href: "/zinemat" },
    { label: "About", color: "FFFFFF", href: "/about" },
    { label: "Ad Bounties", color: "82E385", href: "/dashboard/ad-bounties" },
    { label: "My Library", color: "F2DC6F", href: "/dashboard/library" },
    { label: "Distribute", color: "D16FF2", href: "/dashboard/distribute" },
    { label: "Browse Zines", color: "A4A4A4", href: "/browse-zines" },
  ];

  return (
    <section className="relative w-full z-10">
      {/* Mobile: 5-row pattern from your sketch */}
      <div className="md:hidden flex flex-col gap-5 px-4 py-6">
        {/* Row 1: Map (left) | About (right) */}
        <div className="grid grid-cols-2 gap-4 place-items-center">
          <div className="justify-self-start">
            <Bubble {...bubbles[0]} /> {/* Map */}
          </div>
          <div className="justify-self-end">
            <Bubble {...bubbles[2]} /> {/* About */}
          </div>
        </div>

        {/* Row 2: Browse Zines (center) */}
        <div className="flex justify-center">
          <Bubble {...bubbles[6]} /> {/* Browse Zines */}
        </div>

        {/* Row 3: Upload Zine (left) | Ad Bounties (right) */}
        <div className="grid grid-cols-2 gap-4 place-items-center">
          <div className="justify-self-start">
            <Bubble {...bubbles[1]} /> {/* Upload Zine */}
          </div>
          <div className="justify-self-end">
            <Bubble {...bubbles[3]} /> {/* Ad Bounties */}
          </div>
        </div>

        {/* Row 4: Distribute (center) */}
        <div className="flex justify-center">
          <Bubble {...bubbles[5]} /> {/* Distribute */}
        </div>

        {/* Row 5: My Library (center) */}
        <div className="flex justify-center">
          <Bubble {...bubbles[4]} /> {/* My Library */}
        </div>
      </div>

      {/* Desktop: keep your absolute hex layout unchanged */}
      <div className="hidden md:block relative w-full h-[500px]">
        {/* Red - Map */}
        <div className="absolute top-[0px] left-[300px]">
          <Bubble {...bubbles[0]} />
        </div>

        {/* Blue - Upload Zine */}
        <div className="absolute top-[200px] left-[175px]">
          <Bubble {...bubbles[1]} />
        </div>

        {/* White - About */}
        <div className="absolute top-[0px] left-[550px]">
          <Bubble {...bubbles[2]} />
        </div>

        {/* Green - Ad Bounties */}
        <div className="absolute top-[200px] left-[675px]">
          <Bubble {...bubbles[3]} />
        </div>

        {/* Yellow - My Library */}
        <div className="absolute top-[400px] left-[300px]">
          <Bubble {...bubbles[4]} />
        </div>

        {/* Purple - Distribute */}
        <div className="absolute top-[400px] left-[550px]">
          <Bubble {...bubbles[5]} />
        </div>

        {/* Gray - Browse Zines */}
        <div className="absolute top-[200px] left-[425px]">
          <Bubble {...bubbles[6]} />
        </div>
      </div>
    </section>
  );
};

export default BubbleGrid;
