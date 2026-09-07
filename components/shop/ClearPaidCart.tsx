"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/components/shop/CartProvider";

export function ClearPaidCart({ paid }: { paid: boolean }) {
  const cart = useCart();
  const cleared = useRef(false);
  useEffect(() => {
    if (paid && !cleared.current) {
      cleared.current = true;
      cart.clear();
    }
  }, [paid, cart]);
  return null;
}
