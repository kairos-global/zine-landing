interface BubbleProps {
    label: string;
    color: string;
  }
  
  const Bubble = ({ label, color }: BubbleProps) => {
    return (
      <div
        className={`flex items-center justify-center w-28 h-28 rounded-full border-5 border-black shadow-md text-black font-medium hover:bg-gray-100 transition z-10`}
        style={{ backgroundColor: `#${color}` }}
      >
        {label}
      </div>
    );
  };
  
  export default Bubble;
  