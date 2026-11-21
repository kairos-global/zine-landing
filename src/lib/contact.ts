export const CONTACT_EMAIL = "hello@zineground.com";

export const CONTACT_TOPICS = {
  map: {
    label: "Map & listings",
    description: "Suggest a zine spot or correct a distributor listing.",
    reference: "Shop name or listing link",
    prompt: "Include the shop name, city or address, and what we should add or update.",
    link: { href: "/map", label: "Open the map" },
  },
  publishing: {
    label: "Publishing & QR",
    description: "Get help with ZineMat, publishing, or a printed QR code.",
    reference: "Issue link or title",
    prompt: "Tell us where you got stuck. If a QR code is involved, include the link it opens.",
    link: { href: "/zinemat", label: "Open ZineMat" },
  },
  distribution: {
    label: "Distribution",
    description: "Stock zines, check an application, or ask about distribution.",
    reference: "Business name or distributor order number",
    prompt: "Tell us about your location, the zines you want to stock, or your current application.",
    link: { href: "/dashboard/distributor", label: "Open distributor portal" },
  },
  order: {
    label: "Store & orders",
    description: "Ask about a product, shipment, or existing store order.",
    reference: "Product name or order number",
    prompt: "Include your order number if you have one. Keep payment details out of the message.",
    link: { href: "/store", label: "Open the store" },
  },
  general: {
    label: "Something else",
    description: "Get in touch about partnerships, feedback, or another question.",
    reference: "Relevant link or reference",
    prompt: "Tell us what you’d like help with or what you have in mind.",
    link: null,
  },
};

export type ContactTopic = keyof typeof CONTACT_TOPICS;
export type ContactStatus = "new" | "in_progress" | "resolved";

export type ContactRequest = {
  id: string;
  topic: ContactTopic;
  name: string;
  email: string;
  reference: string;
  message: string;
};

export function isContactTopic(value: string): value is ContactTopic {
  return Object.prototype.hasOwnProperty.call(CONTACT_TOPICS, value);
}
