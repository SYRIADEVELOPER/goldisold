export interface StoreItem {
  id: string;
  name: string;
  value: string;
  price: number;
  type: 'color';
}

export interface UserInventoryItem {
  itemId: string;
  purchaseDate: string;
  isActive: boolean;
}
