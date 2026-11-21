export const MINI_DISPLAY_ID = "fa67dab9-13d7-4b4e-b085-9ba63bb9f4f3";
export const MAX_CART_LINES = 25;
export const MAX_LINE_QUANTITY = 20;

export type StoreProduct = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string | null;
  image_url: string | null;
  in_stock: boolean;
};

export type StoreCartEntry = { productId: string; quantity: number };

export function isMiniDisplay(product: Pick<StoreProduct, "id" | "name">) {
  return product.id === MINI_DISPLAY_ID || product.name.trim().toLowerCase() === "mini zine display";
}
