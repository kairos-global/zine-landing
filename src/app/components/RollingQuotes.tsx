'use client';
import { useEffect, useState } from 'react';

const quotes = [
  "When the power of love overcomes the love of power the world will know peace.",
  "Need to talk to an electrical engineer. hmu. yes, it will be dangerous and complicated",
  "Exude Love",
  "My favorite gateway drug is vibe coding",
  "viva daft punk, la monogamia, los amigos, la cafeina, y el cine"
];

export default function RollingQuotes() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % quotes.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center text-lg font-medium text-gray-800 py-4 transition-all duration-500 ease-in-out">
      <p className="animate-fade">{quotes[index]}</p>
    </div>
  );
}
