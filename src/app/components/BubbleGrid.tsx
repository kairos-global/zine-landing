import Bubble from "./Bubble";

const BubbleGrid = () => {
  const bubbles = [
    { label: "Map", color: "F26565", href: "/map" },
    { label: "Feature Me", color: "65CBF1", href: "/feature-me" },
    { label: "About", color: "FFFFFF", href: "/about" },
    { label: "Advertise", color: "82E385", href: "/advertise" },
    { label: "Share Feedback", color: "F2DC6F", href: "/share-feedback" },
    { label: "Distribute", color: "D16FF2", href: "/distribute" },
    { label: "Past Issues", color: "A4A4A4", href: "/past-issues" },
  ];

  return (
    <section className="relative w-full h-[500px] z-10">
      {/* Red - Map */}
      <div className="absolute top-[0px] left-[300px]">
        <Bubble {...bubbles[0]} />
      </div>

      {/* Blue - Feature Me */}
      <div className="absolute top-[200px] left-[175px]">
        <Bubble {...bubbles[1]} />
      </div>

      {/* White - About */}
      <div className="absolute top-[0px] left-[550px]">
        <Bubble {...bubbles[2]} />
      </div>

      {/* Green - Advertise */}
      <div className="absolute top-[200px] left-[675px]">
        <Bubble {...bubbles[3]} />
      </div>

      {/* Yellow - Share Feedback */}
      <div className="absolute top-[400px] left-[300px]">
        <Bubble {...bubbles[4]} />
      </div>

      {/* Purple - Distribute */}
      <div className="absolute top-[400px] left-[550px]">
        <Bubble {...bubbles[5]} />
      </div>

      {/* Gray - Past Issues */}
      <div className="absolute top-[200px] left-[425px]">
        <Bubble {...bubbles[6]} />
      </div>
    </section>
  );
};

export default BubbleGrid;
