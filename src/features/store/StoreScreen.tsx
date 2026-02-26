import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../auth/store';
import { db } from '@/src/lib/firebase';
import { doc, onSnapshot, collection, getDocs, setDoc } from 'firebase/firestore';
import { DollarSign, PlusCircle, RefreshCw } from 'lucide-react';
import ColorMarketplace from './components/ColorMarketplace';

export default function StoreScreen() {
  const { user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [previewColor, setPreviewColor] = useState('#FFFFFF');
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    if (!user) return;

    const userProfileRef = doc(db, 'profiles', user.uid);
    const unsubscribe = onSnapshot(userProfileRef, (doc) => {
      if (doc.exists()) {
        setBalance(doc.data().balance || 0);
        setPreviewColor(doc.data().active_color || '#FFFFFF');
      }
    });

    return () => unsubscribe();
  }, [user]);

  const seedStore = async () => {
    setIsSeeding(true);
    try {
      const colors = [
        { id: 'color_1', name: 'Premium Pink', value: '#DCB8CC', price: 999, type: 'color' },
        { id: 'color_2', name: 'Soft Coral', value: '#F08478', price: 1038.96, type: 'color' },
        { id: 'color_3', name: 'Deep Sage', value: '#647A73', price: 1080.52, type: 'color' },
        { id: 'color_4', name: 'Mint Green', value: '#83CBBA', price: 1123.74, type: 'color' },
        { id: 'color_5', name: 'Pale Lime', value: '#CCD9B4', price: 1168.69, type: 'color' },
        { id: 'color_6', name: 'Peach Cream', value: '#FCDBC5', price: 1215.44, type: 'color' },
        { id: 'color_7', name: 'Royal Purple', value: '#76328E', price: 1264.06, type: 'color' },
      ];

      for (const color of colors) {
        await setDoc(doc(db, 'store_items', color.id), color);
      }
      alert('Store seeded successfully!');
    } catch (error) {
      console.error('Error seeding store:', error);
      alert('Failed to seed store');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Store</h1>
        <div className="flex items-center space-x-4">
          <button 
            onClick={seedStore}
            disabled={isSeeding}
            className="text-gray-500 hover:text-white transition-colors p-2"
            title="Seed Store Items"
          >
            <RefreshCw className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center space-x-2 bg-white/5 px-4 py-2 rounded-xl">
            <DollarSign className="w-5 h-5 text-[#C6A75E]" />
            <span className="text-lg font-semibold text-white">{balance.toFixed(2)}</span>
          </div>
          <button className="bg-[#C6A75E] text-[#0a0a0a] px-3 py-2 rounded-xl text-sm font-medium flex items-center space-x-2 hover:bg-[#b59855] transition-colors">
            <PlusCircle className="w-4 h-4" />
            <span>Add Funds</span>
          </button>
        </div>
      </div>

      <div className="bg-white/5 p-6 rounded-xl mb-8">
        <h2 className="text-lg font-semibold mb-4">Preview</h2>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-gray-700"></div>
          <div>
            <p className="font-bold text-lg" style={{ color: previewColor }}>{user?.displayName || 'username'}</p>
            <p className="text-sm text-gray-400">This is how your name will appear.</p>
          </div>
        </div>
      </div>

      <ColorMarketplace setPreviewColor={setPreviewColor} />
    </div>
  );
}
