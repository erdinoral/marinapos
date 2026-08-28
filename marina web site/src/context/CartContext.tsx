import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { products, type Product } from "../data/products";
import { FREE_SHIPPING_THRESHOLD } from "../data/categories";

export type CartLine = {
  productId: string;
  qty: number;
};

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
  freeShippingRemaining: number;
  addItem: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  getLineProduct: (productId: string) => Product | undefined;
};

const STORAGE_KEY = "marina-cart-v1";

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed.filter((l) => l.productId && l.qty > 0) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() =>
    typeof window === "undefined" ? [] : loadCart()
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const getLineProduct = useCallback(
    (productId: string) => products.find((p) => p.id === productId),
    []
  );

  const addItem = useCallback((productId: string, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === productId ? { ...l, qty: l.qty + qty } : l
        );
      }
      return [...prev, { productId, qty }];
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setLines((prev) => {
      if (qty <= 0) return prev.filter((l) => l.productId !== productId);
      return prev.map((l) => (l.productId === productId ? { ...l, qty } : l));
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const product = products.find((p) => p.id === line.productId);
        return sum + (product?.price ?? 0) * line.qty;
      }, 0),
    [lines]
  );

  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 79;
  const total = subtotal + shipping;
  const freeShippingRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);

  const value = useMemo(
    () => ({
      lines,
      itemCount,
      subtotal,
      shipping,
      total,
      freeShippingRemaining,
      addItem,
      setQty,
      removeItem,
      clear,
      getLineProduct
    }),
    [
      lines,
      itemCount,
      subtotal,
      shipping,
      total,
      freeShippingRemaining,
      addItem,
      setQty,
      removeItem,
      clear,
      getLineProduct
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
