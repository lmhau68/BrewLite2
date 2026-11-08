'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const CART_KEY = 'brewlite-cart-v1';
const CART_EVENT = 'brewlite-cart-changed';

export interface CartTopping {
  id: string;
  name: string;
  price: number;
}

export interface CartLine {
  id: string;
  productId: string;
  productName: string;
  sizeId: string | null;
  sizeName: string | null;
  toppings: CartTopping[];
  quantity: number;
  unitPrice: number;
}

interface AddCartLine {
  productId: string;
  productName: string;
  sizeId: string | null;
  sizeName: string | null;
  toppings: CartTopping[];
  quantity: number;
  unitPrice: number;
}

interface CartContextValue {
  lines: CartLine[];
  initialized: boolean;
  itemCount: number;
  totalAmount: number;
  addItem: (line: AddCartLine) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  removePurchased: (purchased: Array<{ lineId: string; quantity: number }>) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as Partial<CartLine>;
  return (
    typeof line.id === 'string' &&
    typeof line.productId === 'string' &&
    typeof line.productName === 'string' &&
    (typeof line.sizeId === 'string' || line.sizeId === null) &&
    (typeof line.sizeName === 'string' || line.sizeName === null) &&
    Array.isArray(line.toppings) &&
    line.toppings.every(
      (topping) =>
        topping &&
        typeof topping.id === 'string' &&
        typeof topping.name === 'string' &&
        typeof topping.price === 'number',
    ) &&
    Number.isInteger(line.quantity) &&
    (line.quantity ?? 0) > 0 &&
    typeof line.unitPrice === 'number'
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CART_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every(isCartLine)) {
          setLines(parsed);
        } else {
          console.error('Stored BrewLite cart has an invalid shape.');
          window.localStorage.removeItem(CART_KEY);
        }
      }
    } catch (error) {
      console.error('Unable to load the BrewLite cart from browser storage.', error);
    } finally {
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!initialized) return;
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
      window.dispatchEvent(new Event(CART_EVENT));
    } catch (error) {
      console.error('Unable to save the BrewLite cart to browser storage.', error);
    }
  }, [initialized, lines]);

  const addItem = useCallback((item: AddCartLine) => {
    const toppingKey = item.toppings.map((topping) => topping.id).sort().join(',');
    setLines((current) => {
      const existing = current.find(
        (line) =>
          line.productId === item.productId &&
          line.sizeId === item.sizeId &&
          line.toppings.map((topping) => topping.id).sort().join(',') === toppingKey,
      );
      if (existing) {
        return current.map((line) =>
          line.id === existing.id
            ? { ...line, quantity: Math.min(99, line.quantity + item.quantity) }
            : line,
        );
      }
      return [...current, { ...item, quantity: Math.min(99, item.quantity), id: crypto.randomUUID() }];
    });
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
    setLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, quantity } : line)),
    );
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setLines((current) => current.filter((line) => line.id !== lineId));
  }, []);

  const removePurchased = useCallback(
    (purchased: Array<{ lineId: string; quantity: number }>) => {
      const amounts = new Map(purchased.map((item) => [item.lineId, item.quantity]));
      setLines((current) =>
        current
          .map((line) => ({
            ...line,
            quantity: line.quantity - (amounts.get(line.id) ?? 0),
          }))
          .filter((line) => line.quantity > 0),
      );
    },
    [],
  );

  const clear = useCallback(() => setLines([]), []);
  const value = useMemo(
    () => ({
      lines,
      initialized,
      itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      totalAmount: lines.reduce(
        (total, line) => total + line.unitPrice * line.quantity,
        0,
      ),
      addItem,
      updateQuantity,
      removeItem,
      removePurchased,
      clear,
    }),
    [addItem, clear, initialized, lines, removeItem, removePurchased, updateQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used within CartProvider');
  return value;
}

export function useOptionalCart() {
  return useContext(CartContext);
}

export function clearStoredCart() {
  window.localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event(CART_EVENT));
}

export function subscribeToCart(callback: () => void) {
  window.addEventListener(CART_EVENT, callback);
  return () => window.removeEventListener(CART_EVENT, callback);
}
