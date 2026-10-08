"use client";

import Link from "next/link";
import { useState } from "react";
import ScanIcon from "@/components/ScanIcon";
import styles from "./preview.module.css";

type Tab = "Home" | "Discover" | "Library" | "You";
const links = {
  Discover: [
    { name: "Browse the shelves", detail: "Independent stories, ready to read.", href: "/browse-zines", symbol: "↗" },
    { name: "Find zines near you", detail: "Explore stockists on the map.", href: "/map", symbol: "⌖" },
    { name: "Visit the store", detail: "Goods from the Zineground world.", href: "/store", symbol: "✳" },
  ],
  Library: [
    { name: "Your collection", detail: "Collected zines, drafts, and published work.", href: "/dashboard/library", symbol: "▤" },
    { name: "Make something", detail: "Start a new zine with ZineMat.", href: "/zinemat", symbol: "+" },
    { name: "See what connects", detail: "QR scans and reader engagement.", href: "/dashboard/analytics", symbol: "↗" },
  ],
  You: [
    { name: "Your profile", detail: "Your name, picture, and published zines.", href: "/dashboard/profile", symbol: "☺" },
    { name: "Creator portal", detail: "Manage print orders and fulfillment.", href: "/dashboard/creator", symbol: "✳" },
    { name: "Distributor portal", detail: "Your locations, stock, and orders.", href: "/dashboard/distributor", symbol: "⌖" },
    { name: "Full dashboard", detail: "All your tools in one place.", href: "/dashboard", symbol: "↗" },
  ],
};

function NavIcon({ tab }: { tab: Tab }) {
  const paths = {
    Home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
    Discover: "m15 9-2 4-4 2 2-4 4-2ZM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
    Library: "M4 4h5v16H4V4Zm9 0 5-1 3 16-5 1-3-16Z",
    You: "M20 21v-2a7 7 0 0 0-14 0v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[tab]} /></svg>;
}

export default function MobilePreviewPage() {
  const [tab, setTab] = useState<Tab>("Home");
  return (
    <main className={styles.preview}>
      <div className={styles.shell}>
        <div className={styles.prototype}>MOBILE CONCEPT <Link href="/dashboard">Exit preview ↗</Link></div>
        <header className={styles.header}><Link href="/" className={styles.logo}>zineground<span>A LITTLE OUTSIDE THE ALGORITHM.</span></Link><Link href="/dashboard/profile" className={styles.avatar} aria-label="Your profile">☺</Link></header>
        <div className={styles.content}>
          {tab === "Home" ? <>
            <p className={styles.eyebrow}>PAPER MEETS POSSIBILITY</p>
            <h1>Your world.<br /><span>In small print.</span></h1>
            <p className={styles.intro}>Made by people. Found by you.</p>
            <Link href="/dashboard/scan" className={styles.scanCard}>
              <div><span className={styles.kicker}>FOUND SOMETHING GOOD?</span><h2>Scan it.<br />Get into it.</h2><span className={styles.pill}>Open scanner <span>↗</span></span></div>
              <div className={styles.scanArt}><ScanIcon className="h-20 w-20" /><span>LOOK A LITTLE CLOSER</span></div>
            </Link>
            <div className={styles.sectionHeading}><h2>Take the scenic route.</h2><Link href="/browse-zines">Explore ↗</Link></div>
            <div className={styles.tiles}>
              <Link href="/map" className={styles.mapTile}><div className={styles.mapArt}><span>⌖</span><i /><i /></div><strong>Around the corner</strong><p>Find your local zine spot ↗</p></Link>
              <Link href="/zinemat" className={styles.makeTile}><div className={styles.paperArt}><span>YOUR<br />NEXT<br />IDEA.</span><i>✳</i></div><strong>Make a little noise</strong><p>Start a zine of your own ↗</p></Link>
            </div>
            <Link href="/dashboard/library" className={styles.libraryStrip}><span>▤</span><div><strong>A shelf of your own.</strong><p>Pick up where you left off.</p></div><span>↗</span></Link>
          </> : <>
            <p className={styles.eyebrow}>{tab === "Discover" ? "FOLLOW YOUR CURIOSITY" : tab === "Library" ? "KEEP THE GOOD STUFF" : "YOUR CORNER OF ZINEGROUND"}</p>
            <h1>{tab === "Discover" ? "Out there." : tab === "Library" ? "Your shelf." : "Hello, you."}</h1>
            <p className={styles.intro}>{tab === "Discover" ? "Something worth finding is just around the corner." : tab === "Library" ? "The stories you keep. The ones you’re making." : "Make, share, and keep things moving."}</p>
            <div className={styles.linkList}>{links[tab].map((link) => <Link key={link.href} href={link.href}><span>{link.symbol}</span><div><h2>{link.name}</h2><p>{link.detail}</p></div><span>↗</span></Link>)}</div>
          </>}
          <p className={styles.previewNote}>Navigation prototype · Links open existing Zineground pages.</p>
        </div>
        <nav className={styles.nav} aria-label="Mobile prototype navigation">
          {(["Home", "Discover", "Scan", "Library", "You"] as const).map((item) => item === "Scan" ? <Link key={item} href="/dashboard/scan" className={styles.scanNav}><span><ScanIcon className="h-7 w-7" /></span>Scan</Link> : <button key={item} onClick={() => setTab(item)} aria-current={tab === item ? "page" : undefined}><NavIcon tab={item} />{item}</button>)}
        </nav>
      </div>
    </main>
  );
}
