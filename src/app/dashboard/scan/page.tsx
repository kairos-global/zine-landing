import QRScanner from "./QRScanner";

export const metadata = {
  title: "Scan a QR code · Zineground",
  description: "Open a zine, follow a story, or discover what is behind a QR code.",
};

export default function ScanPage() {
  return <QRScanner />;
}
