"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isMiniDisplay, MAX_CART_LINES, MAX_LINE_QUANTITY, type StoreCartEntry, type StoreProduct } from "@/lib/store";
import DisplayPreview from "./DisplayPreview";

const CART_KEY = "zineground_store_cart";
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (cents: number) => usd.format(cents / 100);

function readCart(raw: string | null): StoreCartEntry[] {
  if (!raw) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries)) return [];
  const cart = new Map<string, StoreCartEntry>();
  for (const entry of entries) {
    if (typeof entry?.productId !== "string" || !Number.isInteger(entry.quantity) || entry.quantity < 1) continue;
    cart.set(entry.productId, { productId: entry.productId, quantity: Math.min(entry.quantity, MAX_LINE_QUANTITY) });
  }
  return [...cart.values()].slice(0, MAX_CART_LINES);
}

function PackPreview() {
  return (
    <section className="zg-panel flex flex-col overflow-hidden">
      <div className="flex min-h-[270px] flex-1 items-center justify-center border-b-2 border-black bg-[#AAEEFF] p-5 sm:min-h-[340px] sm:p-8">
        <div className="grid w-full max-w-[365px] grid-cols-4 items-center gap-2">
          <div className="relative aspect-[2/3] -rotate-8 overflow-hidden border-2 border-black bg-black shadow-[3px_4px_0_#000]">
            <Image src="/store/shdwmtn.webp" alt="shdwmtn zine cover" fill sizes="100px" className="object-cover" />
          </div>
          <div className="relative aspect-[2/3] -rotate-2 overflow-hidden border-2 border-black bg-white shadow-[3px_4px_0_#000]">
            <Image src="/store/salamanderprint.webp" alt="salamanderprint zine cover" fill sizes="100px" className="object-cover" />
          </div>
          <div aria-hidden="true" className="aspect-[2/3] rotate-4 overflow-hidden border-2 border-black bg-[#eb9bca] shadow-[3px_4px_0_#000]">
            <div className="h-full scale-110 bg-[repeating-linear-gradient(40deg,#cb46aa_0%,#cb46aa_18%,#f6c476_23%,#ee7db8_34%)] blur-[7px]" />
          </div>
          <div aria-hidden="true" className="aspect-[2/3] rotate-9 overflow-hidden border-2 border-black bg-[#a7bd64] shadow-[3px_4px_0_#000]">
            <div className="h-full scale-110 bg-[repeating-linear-gradient(160deg,#436b55_0%,#436b55_17%,#e2d884_20%,#a7bd64_33%)] blur-[7px]" />
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h2 className="text-2xl font-black leading-tight sm:text-3xl">Featured Zine Pack No. 1</h2>
          <span className="rounded-full border border-black bg-[#F0EBCC] px-2.5 py-1 text-xs font-black">Coming soon</span>
        </div>
        <p className="mt-2 text-sm">Featuring shdwmtn and salamanderprint.</p>
        <Link href="/issues/untitled" className="mt-4 inline-block text-sm font-bold underline">Read the shdwmtn issue ↗</Link>
      </div>
    </section>
  );
}

export default function StorePage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [catalog, setCatalog] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [cart, setCart] = useState<StoreCartEntry[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try { setCart(readCart(localStorage.getItem(CART_KEY))); } catch {}
    setCartLoaded(true);
    const params = new URLSearchParams(window.location.search);
    const session = params.get("session_id");
    if (params.get("order") === "cancelled") {
      setNotice("Checkout cancelled. Your cart is saved.");
      window.history.replaceState(null, "", "/store");
    }
    if (!session) return;
    setNotice("Checking your payment…");
    const controller = new AbortController();
    fetch(`/api/payments/store-checkout?session_id=${encodeURIComponent(session)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (result.status === "paid") {
          setCart([]);
          setNotice(`Payment received. Your order reference is ${result.orderId}.`);
        } else if (result.status === "processing") {
          setCart([]);
          setNotice(`Payment is processing. Your order reference is ${result.orderId}.`);
        } else {
          setNotice("Payment is incomplete. Your cart is saved.");
        }
      }).catch(() => { if (!controller.signal.aborted) setNotice("We couldn’t confirm the payment. Refresh to try again or contact us for help."); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }, [cart, cartLoaded]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/products", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        setProducts(data.products);
        setCatalog("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setCatalog("error"); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const panel = dialog.current;
    if (!panel) return;
    if (cartOpen && !panel.open) panel.showModal();
    if (!cartOpen && panel.open) panel.close();
  }, [cartOpen]);

  const display = products.find(isMiniDisplay);
  const others = products.filter((product) => !isMiniDisplay(product));
  const cartItems = cart.map((entry) => ({ ...entry, product: products.find(({ id }) => id === entry.productId) }));
  const cartCount = cart.reduce((count, entry) => count + entry.quantity, 0);
  const cartTotal = cartItems.reduce((total, entry) => total + (entry.product?.price_cents ?? 0) * entry.quantity, 0);
  const canCheckOut = catalog === "ready" && cartItems.length > 0 && cartItems.every(({ product }) => product?.in_stock);

  function changeCart(productId: string, quantity: number) {
    setError("");
    setCart((previous) => {
      const exists = previous.some((entry) => entry.productId === productId);
      if (quantity <= 0) return previous.filter((entry) => entry.productId !== productId);
      if (exists) return previous.map((entry) => entry.productId === productId ? { productId, quantity } : entry);
      if (previous.length >= MAX_CART_LINES) return previous;
      return [...previous, { productId, quantity }];
    });
  }

  function buy(product: StoreProduct) {
    const quantity = cart.find(({ productId }) => productId === product.id)?.quantity ?? 0;
    changeCart(product.id, Math.min(quantity + 1, MAX_LINE_QUANTITY));
    setCartOpen(true);
  }

  async function checkout() {
    if (!canCheckOut || checkingOut) return;
    setCheckingOut(true);
    setError("");
    try {
      const response = await fetch("/api/payments/store-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error ?? "Checkout is unavailable. Try again.");
      window.location.assign(data.url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Checkout is unavailable. Try again.");
      setCheckingOut(false);
    }
  }

  return (
    <main className="zg-page px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="zg-title">Store</h1><p className="mt-3">Zines and displays for your shelf.</p></div>
          <button className="zg-button zg-button-dark px-5" onClick={() => setCartOpen(true)}>Cart · {cartCount}</button>
        </header>
        {notice && <p role="status" className="zg-panel mb-4 break-words p-4 text-sm font-bold">{notice} <Link href="/contact?topic=order" className="ml-1 underline">Order help ↗</Link></p>}
        {catalog === "error" && <div role="alert" className="zg-panel mb-4 flex flex-wrap items-center gap-3 p-4 text-sm"><p>Live availability couldn’t load.</p><button className="zg-button" onClick={() => { setCatalog("loading"); setAttempt(attempt + 1); }}>Try again</button></div>}
        <div className="grid items-stretch gap-4 lg:grid-cols-[1.08fr_1fr]">
          <section className="zg-panel overflow-hidden">
            <div className="border-b-2 border-black"><DisplayPreview /></div>
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <h2 className="text-2xl font-black leading-tight sm:text-3xl">{display?.name ?? "Mini Zine Display"}</h2>
                {display?.in_stock && <span className="text-lg font-black">{money(display.price_cents)}</span>}
                {catalog === "ready" && !display?.in_stock && <span className="rounded-full border border-black bg-[#F0EBCC] px-2.5 py-1 text-xs font-black">Unavailable</span>}
              </div>
              <p className="mt-2 text-sm">A 3D-printed tabletop holder for mini zines.</p>
              {display?.in_stock ? <button className="zg-button zg-button-dark mt-4" onClick={() => buy(display)}>Add to cart</button> :
                <Link className="mt-4 inline-block text-sm font-bold underline" href="/contact?topic=order&reference=Mini%20Zine%20Display">Ask about availability ↗</Link>}
            </div>
          </section>
          <PackPreview />
        </div>
        {others.length > 0 && <section aria-label="More products" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((product) => <article className="zg-panel overflow-hidden" key={product.id}>
            {product.image_url && (
              // Merchant-supplied image hosts are dynamic.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="aspect-square w-full border-b-2 border-black object-cover" />
            )}
            <div className="p-5">
              <h2 className="text-xl font-black">{product.name}</h2>
              {product.description && <p className="my-2 text-sm">{product.description}</p>}
              {product.in_stock ? <><p className="my-2 font-bold">{money(product.price_cents)}</p><button className="zg-button zg-button-dark" onClick={() => buy(product)}>Add to cart</button></> : <p className="font-bold">Unavailable</p>}
            </div>
          </article>)}
        </section>}
      </div>
      <dialog ref={dialog} onClose={() => setCartOpen(false)} aria-labelledby="store-cart-title" className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md border-l-2 border-black bg-white p-0 text-black backdrop:bg-black/45">
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b-2 border-black bg-[#AAEEFF] p-4">
            <h2 id="store-cart-title" className="text-2xl font-black">Cart</h2>
            <button autoFocus className="zg-button" onClick={() => setCartOpen(false)}>Close</button>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            {!cartItems.length && <p className="text-sm">Your cart is empty.</p>}
            {cartItems.map(({ quantity, productId, product }) => (
              <div className="mb-3 rounded-lg border border-black p-3" key={productId}>
                <p className="font-black">{product?.name ?? (catalog === "loading" ? "Loading product…" : "Unavailable product")}</p>
                {product && <p className="text-sm">{product.in_stock ? `${money(product.price_cents)} each` : "Unavailable"}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <button className="zg-button" aria-label={`Decrease quantity for ${product?.name ?? "product"}`} onClick={() => changeCart(productId, quantity - 1)} disabled={checkingOut}>−</button>
                  <span className="min-w-5 text-center font-bold">{quantity}</span>
                  <button className="zg-button" aria-label={`Increase quantity for ${product?.name ?? "product"}`} onClick={() => changeCart(productId, quantity + 1)} disabled={checkingOut || !product?.in_stock || quantity >= MAX_LINE_QUANTITY}>+</button>
                  <button className="ml-auto text-sm font-bold underline" onClick={() => changeCart(productId, 0)} disabled={checkingOut}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          <footer className="border-t-2 border-black p-4">
            {error && <p role="alert" className="mb-3 text-sm font-bold text-red-800">{error}</p>}
            <div className="mb-2 flex justify-between font-black"><span>Subtotal</span><span>{money(cartTotal)}</span></div>
            {cartItems.length > 0 && catalog === "ready" && !canCheckOut && <p className="mb-2 text-sm">Remove unavailable items to continue.</p>}
            <button className="zg-button zg-button-dark w-full" onClick={checkout} disabled={!canCheckOut || checkingOut}>{checkingOut ? "Opening Stripe…" : "Checkout"}</button>
            <p className="mt-2 text-xs">U.S. shipping address collected at checkout.</p>
          </footer>
        </div>
      </dialog>
    </main>
  );
}
