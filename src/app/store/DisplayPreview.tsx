import Image from "next/image";
import styles from "./DisplayPreview.module.css";

export default function DisplayPreview() {
  return (
    <div className="grid min-h-[270px] place-items-center overflow-hidden bg-[#e7d2f8] sm:min-h-[340px]">
      <div className="relative aspect-square w-full max-w-[380px]">
        <Image src="/store/mini-zine-display.webp" alt="Mini Zine Display, rendered from its 3D model" fill sizes="(max-width: 412px) 100vw, 380px" priority className="object-contain" />
        <div aria-hidden="true" className={styles.spin} />
      </div>
    </div>
  );
}
