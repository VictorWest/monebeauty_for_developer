"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  CART_STORAGE_KEY,
  cartItemCount,
  cartSubtotal,
  normalizeQty,
  resolveCartLines,
  type CartItemInput,
  type CartLine,
} from "@/lib/cart";
import type { Product } from "@/content/products";
import { CartAddedToast } from "@/components/shop/CartAddedToast";

type CartContextValue = {
  items: CartItemInput[];
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (slug: string, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_CHANGE_EVENT = "monebeauty:cart-change";

function parseStoredCart(serialized: string): CartItemInput[] {
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item?.slug === "string")
      .map((item) => ({
        slug: item.slug,
        qty: normalizeQty(Number(item.qty)),
      }));
  } catch {
    return [];
  }
}

function cartSnapshot() {
  return typeof window === "undefined"
    ? "[]"
    : (localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
}

function serverCartSnapshot() {
  return "[]";
}

function subscribeToCart(onStoreChange: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === CART_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", storage);
  window.addEventListener(CART_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(CART_CHANGE_EVENT, onStoreChange);
  };
}

function writeStoredCart(items: CartItemInput[]) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_CHANGE_EVENT));
}

export function CartProvider({
  children,
  products,
}: {
  children: ReactNode;
  products: Product[];
}) {
  const noticeSequence = useRef(0);
  const [notice, setNotice] = useState<{
    id: number;
    productName: string;
  } | null>(null);
  const serializedItems = useSyncExternalStore(
    subscribeToCart,
    cartSnapshot,
    serverCartSnapshot,
  );
  const items = useMemo(
    () => parseStoredCart(serializedItems),
    [serializedItems],
  );

  const value = useMemo<CartContextValue>(() => {
    const lines = resolveCartLines(items, products);
    return {
      items,
      lines,
      count: cartItemCount(lines),
      subtotal: cartSubtotal(lines),
      add(slug, qty = 1) {
        const current = parseStoredCart(cartSnapshot());
        writeStoredCart(
          (() => {
            const existing = current.find((item) => item.slug === slug);
            if (existing) {
              return current.map((item) =>
                item.slug === slug
                  ? { ...item, qty: normalizeQty(item.qty + qty) }
                  : item,
              );
            }
            return [...current, { slug, qty: normalizeQty(qty) }];
          })(),
        );
        const productName = Object.values(
          products.find((product) => product.slug === slug)?.i18n ?? {},
        ).find(Boolean)?.name;
        if (productName) {
          noticeSequence.current += 1;
          setNotice({ id: noticeSequence.current, productName });
        }
      },
      setQty(slug, qty) {
        const current = parseStoredCart(cartSnapshot());
        writeStoredCart(
          current.map((item) =>
            item.slug === slug ? { ...item, qty: normalizeQty(qty) } : item,
          ),
        );
      },
      remove(slug) {
        const current = parseStoredCart(cartSnapshot());
        writeStoredCart(current.filter((item) => item.slug !== slug));
      },
      clear() {
        writeStoredCart([]);
      },
    };
  }, [items, products]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {notice ? (
        <CartAddedToast
          noticeId={notice.id}
          productName={notice.productName}
          onDismiss={() => setNotice(null)}
        />
      ) : null}
    </CartContext.Provider>
  );
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
