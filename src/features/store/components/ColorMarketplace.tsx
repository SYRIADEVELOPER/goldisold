import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, getDocs, doc, runTransaction, arrayUnion } from 'firebase/firestore';
import { useAuthStore } from '@/src/features/auth/store';
import { StoreItem } from './types';

interface ColorMarketplaceProps {
  setPreviewColor: (color: string) => void;
}

export default function ColorMarketplace({ setPreviewColor }: ColorMarketplaceProps) {
  const { user } = useAuthStore();
  const [colors, setColors] = useState<StoreItem[]>([]);
  const [selectedColor, setSelectedColor] = useState<StoreItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchColors = async () => {
      const querySnapshot = await getDocs(collection(db, 'store_items'));
      const colorsData = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => (item as StoreItem).type === 'color') as StoreItem[];
      setColors(colorsData);
    };
    fetchColors();
  }, []);

  const handlePurchase = async (color: StoreItem) => {
    if (!user) return;
    setIsPurchasing(true);
    setError(null);

    try {
      await runTransaction(db, async (transaction) => {
        const userProfileRef = doc(db, 'profiles', user.uid);
        const userProfileDoc = await transaction.get(userProfileRef);

        if (!userProfileDoc.exists()) {
          throw new Error('User profile not found');
        }

        const currentBalance = userProfileDoc.data().balance || 0;
        if (currentBalance < color.price) {
          throw new Error('Insufficient funds');
        }

        transaction.update(userProfileRef, { 
          balance: currentBalance - color.price,
          inventory: arrayUnion({
            itemId: color.id,
            purchaseDate: new Date().toISOString(),
            isActive: false,
          })
        });
      });
      alert('Purchase successful!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-white mb-4">Username Colors</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {colors.map(color => (
          <div key={color.id} className="bg-white/5 p-4 rounded-xl text-center cursor-pointer" onClick={() => setPreviewColor(color.value)}>
            <div style={{ backgroundColor: color.value }} className="w-full h-16 rounded-md border border-white/10 mb-2"></div>
            <p className="font-semibold">{color.name}</p>
            <p className="text-sm text-gray-400">{color.price} coins</p>
            <button 
              onClick={() => handlePurchase(color)}
              disabled={isPurchasing}
              className="mt-2 bg-[#C6A75E] text-[#0a0a0a] px-3 py-1 rounded-md text-sm font-medium hover:bg-[#b59855] transition-colors disabled:opacity-50"
            >
              {isPurchasing ? '...' : 'Buy'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
