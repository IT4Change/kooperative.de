import { atom, computed } from 'nanostores';
import type { CartItem } from './types';

const STORAGE_KEY = 'kooperative-cart';

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const $cartItems = atom<CartItem[]>(loadCart());

$cartItems.subscribe((items) => {
  saveCart(items);
});

export const $cartCount = computed($cartItems, (items) =>
  items.reduce((sum, item) => sum + item.quantity, 0)
);

export const $cartTotal = computed($cartItems, (items) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);

export function addToCart(item: Omit<CartItem, 'quantity'>, quantity: number = 1): void {
  const items = $cartItems.get();
  const existing = items.find((i) => i.productId === item.productId);

  if (existing) {
    $cartItems.set(
      items.map((i) =>
        i.productId === item.productId ? { ...i, quantity: i.quantity + quantity } : i
      )
    );
  } else {
    $cartItems.set([...items, { ...item, quantity }]);
  }
}

export function removeFromCart(productId: number): void {
  $cartItems.set($cartItems.get().filter((i) => i.productId !== productId));
}

export function updateQuantity(productId: number, quantity: number): void {
  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  $cartItems.set(
    $cartItems.get().map((i) => (i.productId === productId ? { ...i, quantity } : i))
  );
}

export function clearCart(): void {
  $cartItems.set([]);
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}
