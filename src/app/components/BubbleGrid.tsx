import Bubble from "./Bubble";

const BubbleGrid = () => {
  const bubbles = [
    { label: "Map", color: "F26565" },          // Red
    { label: "Feature Me", color: "65CBF1" },   // Blue
    { label: "About", color: "FFFFFF" },        // White
    { label: "Advertise", color: "82E385" },    // Green
    { label: "Share Feedback", color: "F2DC6F" }, // Yellow
    { label: "Distribute", color: "D16FF2" },   // Purple
  ];

  return (
    <section className="flex relative z-10 flex-col items-center gap-12 p-2">
      {/* Top bubble */}
      <div>
        <Bubble label={bubbles[0].label} color={bubbles[0].color} />
      </div>

      {/* Middle row with 3 */}
      <div className="flex gap-12">
        <Bubble label={bubbles[1].label} color={bubbles[1].color} />
        <Bubble label={bubbles[2].label} color={bubbles[2].color} />
        <Bubble label={bubbles[3].label} color={bubbles[3].color} />
      </div>

      {/* Bottom column */}
      <div className="flex flex-col items-center gap-6">
        <Bubble label={bubbles[4].label} color={bubbles[4].color} />
        <Bubble label={bubbles[5].label} color={bubbles[5].color} />
      </div>
    </section>
  );
};

export default BubbleGrid;
