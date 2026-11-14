import QRScanner from "./QRScanner";

export const metadata = {
  title: "Scanner · Zineground",
  description: "Scan QR codes, capture zine pages, and collect patterns.",
};

export default function ScanPage() {
  return <QRScanner />;
}
