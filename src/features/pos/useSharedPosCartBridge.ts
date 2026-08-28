import { useEffect, useRef } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { Product } from "../../types/models";
import type { SharedPosCartLineDto } from "../../types/sharedPosCart";
import type { CartPriceSource, PosCartLine } from "./posCartLine";

function serializeCartLine(line: PosCartLine): SharedPosCartLineDto {
  return {
    productId: line.id,
    qty: line.qty,
    priceSource: line.priceSource,
    manualUnitPriceKurus: line.manualUnitPriceKurus,
    lineExtraDiscountPercent: line.lineExtraDiscountPercent,
    manualLineTotalTlWhole: line.manualLineTotalTlWhole
  };
}

/** Mobil telefondan gelen sepet islemlerini PC aktif sepetine yansitir; PC sepetini mobil icin paylasir. */
export function useSharedPosCartBridge(options: {
  activeCartId: number;
  cart: PosCartLine[];
  products: Product[];
  addToCart: (product: Product, priceSource?: CartPriceSource) => void;
}) {
  const { activeCartId, cart, products, addToCart } = options;
  const addToCartRef = useRef(addToCart);
  addToCartRef.current = addToCart;
  const appliedOpIds = useRef(new Set<string>());
  const skipPushRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const snap = await getMarinaApi().posCartPull();
        const freshOps = snap.pendingOps.filter((op) => !appliedOpIds.current.has(op.id));
        if (freshOps.length === 0) return;
        skipPushRef.current = true;
        for (const op of freshOps) {
          appliedOpIds.current.add(op.id);
          if (op.type === "add_barcode" && op.barcode) {
            const q = op.barcode.trim().toLowerCase();
            const product = products.find((p) => p.isActive && p.barcode.trim().toLowerCase() === q);
            if (product) addToCartRef.current(product, op.priceSource);
          } else if (op.type === "add_product" && op.productId) {
            const product = products.find((p) => p.id === op.productId && p.isActive);
            if (product) {
              const times = Math.max(1, Math.floor(op.qty));
              for (let i = 0; i < times; i++) addToCartRef.current(product, op.priceSource);
            }
          }
        }
        await getMarinaApi().posCartAckOps(freshOps.map((op) => op.id));
        window.setTimeout(() => {
          skipPushRef.current = false;
        }, 120);
      } catch {
        /* mobil sunucu kapali */
      }
    };
    const id = window.setInterval(() => void poll(), 900);
    return () => window.clearInterval(id);
  }, [products]);

  useEffect(() => {
    if (skipPushRef.current) return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      void getMarinaApi().posCartPush({
        activeCartId,
        lines: cart.map(serializeCartLine)
      });
    }, 350);
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [activeCartId, cart]);
}
