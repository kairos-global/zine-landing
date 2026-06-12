'use client';

import { useState, useEffect } from 'react';

type StoreProduct = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string | null;
  image_url: string | null;
  in_stock: boolean;
};

type CartItem = {
  productId: string;
  name: string;
  price_cents: number;
  quantity: number;
  image_url: string | null;
};

const CART_KEY = 'zineground_store_cart';

const NOTEPAD_BG = {
  backgroundColor: '#F0EBCC',
  backgroundImage: `
    repeating-linear-gradient(
      transparent,
      transparent 31px,
      #d1d5db 31px,
      #d1d5db 32px
    )
  `,
} as React.CSSProperties;

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function StorePage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) setCart(JSON.parse(saved));
    } catch {}

    if (window.location.search.includes('order=success')) {
      setOrderSuccess(true);
      localStorage.removeItem(CART_KEY);
      setCart([]);
      window.history.replaceState({}, '', '/store');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    fetch('/api/store/products?in_stock=true')
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function addToCart(product: StoreProduct) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price_cents: product.price_cents,
          quantity: 1,
          image_url: product.image_url,
        },
      ];
    });
    setSelected(null);
    setCartOpen(true);
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  async function handleCheckout() {
    if (cart.length === 0 || checkingOut) return;
    setCheckingOut(true);
    try {
      const res = await fetch('/api/payments/store-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? 'Checkout failed. Please try again.');
        setCheckingOut(false);
      }
    } catch {
      alert('Checkout failed. Please try again.');
      setCheckingOut(false);
    }
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price_cents * i.quantity, 0);

  return (
    <>
      <main className="min-h-screen text-black" style={NOTEPAD_BG}>
        <div className="max-w-6xl mx-auto px-8 py-16">

          {orderSuccess && (
            <div className="mb-8 p-4 bg-green-50 border-2 border-green-400 rounded-xl text-green-800 font-semibold text-sm">
              Order placed. You&apos;ll receive a confirmation email. Thank you.
            </div>
          )}

          {loading && <p className="text-sm text-gray-400">Loading...</p>}

          {!loading && products.length === 0 && (
            <p className="text-sm text-gray-400 font-medium pt-2">Coming soon.</p>
          )}

          <div className="grid grid-cols-4 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="border-2 border-black rounded-2xl overflow-hidden bg-white flex flex-col"
              >
                <button
                  onClick={() => setSelected(product)}
                  className="w-full aspect-square bg-white border-b-2 border-black flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors group overflow-hidden"
                  aria-label={`View ${product.name}`}
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300 group-hover:text-gray-400 transition-colors">
                        {product.category ?? 'Product'}
                      </span>
                      <div className="w-10 h-10 border-2 border-dashed border-gray-200 rounded-lg group-hover:border-gray-300 transition-colors" />
                    </>
                  )}
                </button>

                <div className="p-4 flex flex-col gap-1.5">
                  <p className="font-bold text-sm leading-snug">{product.name}</p>
                  <p className="text-sm font-semibold text-gray-500">{fmt(product.price_cents)}</p>
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

      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-8 right-8 z-40 bg-black text-white rounded-full px-5 py-3 text-sm font-bold shadow-lg hover:bg-gray-900 transition-colors flex items-center gap-2"
        >
          Cart
          <span className="bg-white text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-black leading-none">
            {cartCount}
          </span>
        </button>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white border-l-2 border-black w-full max-w-sm flex flex-col">
            <div className="flex justify-between items-center p-6 border-b-2 border-black">
              <h2 className="text-lg font-black">Cart</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="text-2xl font-bold leading-none text-gray-400 hover:text-black transition-colors"
                aria-label="Close cart"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {cart.length === 0 ? (
                <p className="text-sm text-gray-400">Your cart is empty.</p>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} className="flex gap-3 items-start">
                    <div className="w-14 h-14 shrink-0 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 border border-dashed border-gray-200 rounded" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-snug truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmt(item.price_cents)} each</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQty(item.productId, -1)}
                          className="w-6 h-6 border border-black rounded text-sm font-bold flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                        >
                          -
                        </button>
                        <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.productId, 1)}
                          className="w-6 h-6 border border-black rounded text-sm font-bold flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="ml-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-bold shrink-0">{fmt(item.price_cents * item.quantity)}</p>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t-2 border-black">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-sm">Subtotal</span>
                <span className="font-black text-lg">{fmt(cartTotal)}</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || checkingOut}
                className="w-full bg-black text-white py-3 rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                {checkingOut ? 'Redirecting...' : 'Checkout'}
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">Shipping & address collected at checkout</p>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-10"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white border-2 border-black rounded-2xl overflow-hidden flex w-full max-w-2xl max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-5/12 shrink-0 bg-gray-50 border-r-2 border-black flex flex-col items-center justify-center overflow-hidden">
              {selected.image_url ? (
                <img
                  src={selected.image_url}
                  alt={selected.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 h-full w-full p-8">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300">
                    {selected.category ?? 'Product'}
                  </span>
                  <div className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl" />
                </div>
              )}
            </div>

            <div className="flex-1 p-8 overflow-y-auto flex flex-col min-h-[420px]">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                  {selected.category ?? 'Product'}
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
              <p className="text-lg font-bold mt-2">{fmt(selected.price_cents)}</p>
              {selected.description && (
                <p className="text-sm text-gray-600 mt-5 leading-relaxed">{selected.description}</p>
              )}

              <div className="mt-auto pt-8 flex flex-col gap-3">
                {selected.in_stock ? (
                  <button
                    onClick={() => addToCart(selected)}
                    className="w-full bg-black text-white py-3 rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors"
                  >
                    Add to Cart
                  </button>
                ) : (
                  <div className="w-full bg-gray-100 text-gray-400 py-3 rounded-xl text-sm font-bold text-center">
                    Out of Stock
                  </div>
                )}
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
