import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthStore } from '@/src/features/auth/store';
import { StoreItem, UserInventoryItem } from './types';

export default function MyColors() {
  const { user } = useAuthStore();
  const [myColors, setMyColors] = useState<StoreItem[]>([]);
  const [activeColor, setActiveColor] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const userProfileRef = doc(db, 'profiles', user.uid);
    const unsubscribe = onSnapshot(userProfileRef, async (doc) => {
      if (doc.exists()) {
        const inventory = doc.data().inventory || [];
        setActiveColor(doc.data().active_color || null);

        const colorIds = inventory
          .map((item: UserInventoryItem) => item.itemId);

        if (colorIds.length > 0) {
          const colorsQuery = query(collection(db, 'store_items'), where('__name__', 'in', colorIds));
          const colorsSnapshot = await getDocs(colorsQuery);
          const colorItems = colorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StoreItem[];
          setMyColors(colorItems);
        } else {
          setMyColors([]);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleSetColor = async (color: StoreItem | null) => {
    if (!user) return;
    await updateDoc(doc(db, 'profiles', user.uid), { active_color: color ? color.value : null });
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-white mb-4">My Colors</h2>
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
        <div className="text-center cursor-pointer" onClick={() => handleSetColor(null)}>
          <div 
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center bg-white/5 ${activeColor === null ? 'border-[#C6A75E]' : 'border-white/10'}`}>
            <span className="text-[10px] text-gray-500">None</span>
          </div>
          <p className="text-xs mt-1 text-gray-500">Default</p>
        </div>
        {myColors.map(color => (
          <div key={color.id} className="text-center cursor-pointer" onClick={() => handleSetColor(color)}>
            <div 
              style={{ backgroundColor: color.value }}
              className={`w-12 h-12 rounded-full border-2 ${activeColor === color.value ? 'border-[#C6A75E]' : 'border-white/10'}`}>
            </div>
            <p className="text-xs mt-1">{color.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
