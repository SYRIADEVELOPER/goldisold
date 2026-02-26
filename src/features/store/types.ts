export interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'color' | 'badge' | 'auth_badge';
  value: string; // e.g., hex code for color, or image url for badge
}

export interface UserInventoryItem {
  itemId: string;
  purchaseDate: string;
  isActive: boolean;
}
