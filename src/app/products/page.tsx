'use client';

import { useState } from 'react';

type Product = {
  id: number;
  name: string;
  price: string;
  tag: string;
  description: string;
};

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Half Letter Print Run',
    price: '$12.00 / copy',
    tag: 'Print',
    description:
      'Professional half letter zine printing on quality paper. Folded and trimmed to 5.5×8.5 inches. Perfect for your finished zine ready to go into distribution.',
  },
  {
    id: 2,
    name: 'Mini Zine Print Run',
    price: '$8.00 / copy',
    tag: 'Print',
    description:
      'Compact mini zine format folded from a single letter sheet into 8 panels. Great for quick reads, event giveaways, or sample issues.',
  },
  {
    id: 3,
    name: 'Riso Print — 1 Color',
    price: '$18.00 / copy',
    tag: 'Riso',
    description:
      'Single-color risograph printing. Get that warm, textured, hand-printed look that zine readers love. Choose from a range of available ink colors.',
  },
  {
    id: 4,
    name: 'Riso Print — 2 Color',
    price: '$24.00 / copy',
    tag: 'Riso',
    description:
      'Two-color risograph printing with deliberate slight misregistration for that authentic riso character. Pick two spot colors from our standard palette.',
  },
  {
    id: 5,
    name: 'Sticker Pack',
    price: '$6.00',
    tag: 'Merch',
    description:
      'Pack of 10 vinyl stickers printed full color. Waterproof and durable. Great for adding to your zine orders or selling at the table.',
  },
  {
    id: 6,
    name: 'Zine Tote Bag',
    price: '$22.00',
    tag: 'Merch',
    description:
      'Heavy-duty natural canvas tote with a screen-printed Zineground design. Sturdy enough for a full haul from the zine fair.',
  },
  {
    id: 7,
    name: 'Bundle — 50 Copies',
    price: '$40.00',
    tag: 'Bundle',
    description:
      '50 copies of your half letter zine, printed and shipped to your door. Ideal for creators building their first round of distribution stock.',
  },
  {
    id: 8,
    name: 'Custom Print Quote',
    price: 'Get a quote',
    tag: 'Custom',
    description:
      "Large runs, unusual formats, specialty paper, spiral binding — if it's not in the standard options, reach out and we'll scope a custom print quote for you.",
  },
];

const NOTEPAD_BG = {
  backgroundColor: '#fefce8',
  backgroundImage: `
    repeating-linear-gradient(
      transparent,
      transparent 31px,
      #bfdbfe 31px,
      #bfdbfe 32px
    ),
    linear-gradient(
      90deg,
      transparent 79px,
      #fca5a5 79px,
      #fca5a5 81px,
      transparent 81px
    )
  `,
} as React.CSSProperties;

export default function StorePage() {
  const [selected, setSelected] = useState<Product | null>(null);

  return (
    <>
      <main className="min-h-screen text-black" style={NOTEPAD_BG}>
        <div className="max-w-6xl mx-auto px-8 py-16">
          <h1 className="text-5xl font-black tracking-tight mb-12">Store</h1>

          <div className="grid grid-cols-4 gap-6">
            {PRODUCTS.map((product) => (
              <div
                key={product.id}
                className="border-2 border-black rounded-2xl overflow-hidden bg-white flex flex-col"
              >
                {/* Clickable product image area */}
                <button
                  onClick={() => setSelected(product)}
                  className="w-full aspect-square bg-white border-b-2 border-black flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors group"
                  aria-label={`View ${product.name}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300 group-hover:text-gray-400 transition-colors">
                    {product.tag}
                  </span>
                  <div className="w-10 h-10 border-2 border-dashed border-gray-200 rounded-lg group-hover:border-gray-300 transition-colors" />
                </button>

                {/* Info section */}
                <div className="p-4 flex flex-col gap-1.5">
                  <p className="font-bold text-sm leading-snug">{product.name}</p>
                  <p className="text-sm font-semibold text-gray-500">{product.price}</p>
                  <button
                    onClick={() => setSelected(product)}
                    className="mt-2 w-full border-2 border-black rounded-lg py-1.5 text-sm font-semibold hover:bg-black hover:text-white transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Product detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-10"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white border-2 border-black rounded-2xl overflow-hidden flex w-full max-w-2xl max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: product image panel */}
            <div className="w-5/12 shrink-0 bg-gray-50 border-r-2 border-black flex flex-col items-center justify-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300">
                {selected.tag}
              </span>
              <div className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl" />
            </div>

            {/* Right: details panel */}
            <div className="flex-1 p-8 overflow-y-auto flex flex-col min-h-[420px]">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                  {selected.tag}
                </span>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xl font-bold leading-none text-gray-400 hover:text-black transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <h2 className="text-2xl font-black mt-4 leading-tight">{selected.name}</h2>
              <p className="text-lg font-bold mt-2">{selected.price}</p>
              <p className="text-sm text-gray-600 mt-5 leading-relaxed">{selected.description}</p>

              <div className="mt-auto pt-8 flex flex-col gap-3">
                <a
                  href="/contact"
                  className="block text-center w-full bg-black text-white py-3 rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors"
                >
                  Order / Enquire
                </a>
                <button
                  onClick={() => setSelected(null)}
                  className="w-full border-2 border-black py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
