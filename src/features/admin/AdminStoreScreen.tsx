import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { StoreItem } from '../store/types';
import { Trash2, Edit, PlusCircle } from 'lucide-react';

export default function AdminStoreScreen() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: 0, type: 'color' as const, value: '#FFFFFF' });
  const [isEditing, setIsEditing] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      const querySnapshot = await getDocs(collection(db, 'store_items'));
      const itemsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StoreItem[];
      setItems(itemsData);
    };
    fetchItems();
  }, []);

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price || !newItem.value) return;
    const docRef = await addDoc(collection(db, 'store_items'), newItem);
    setItems([...items, { id: docRef.id, ...newItem }]);
    setNewItem({ name: '', description: '', price: 100, type: 'color', value: '#FFFFFF' });
  };

  const handleDeleteItem = async (id: string) => {
    await deleteDoc(doc(db, 'store_items', id));
    setItems(items.filter(item => item.id !== id));
  };

  const handleUpdateItem = async (id: string) => {
    const itemToUpdate = items.find(item => item.id === id);
    if (!itemToUpdate) return;
    await updateDoc(doc(db, 'store_items', id), { ...itemToUpdate });
    setIsEditing(null);
  };

  return (
    <div className="p-4 sm:p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">Manage Store Items</h1>

      <div className="bg-white/5 p-6 rounded-xl mb-8">
        <h2 className="text-lg font-semibold mb-4">Add New Color</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder="Name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2" />
          <input type="number" placeholder="Price" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: parseInt(e.target.value) })} className="bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2" />
          <div className="flex items-center space-x-2">
            <input type="color" value={newItem.value} onChange={(e) => setNewItem({ ...newItem, value: e.target.value })} className="h-10 w-10 rounded-md" />
            <span className="font-mono">{newItem.value}</span>
          </div>
        </div>
        <button onClick={handleAddItem} className="mt-4 bg-[#C6A75E] text-[#0a0a0a] px-4 py-2 rounded-xl font-medium flex items-center space-x-2 hover:bg-[#b59855] transition-colors">
          <PlusCircle className="w-5 h-5" />
          <span>Add Item</span>
        </button>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Existing Items</h2>
        <div className="space-y-4">
          {items.map(item => (
            <div key={item.id} className="bg-white/5 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div style={{ backgroundColor: item.value }} className="w-8 h-8 rounded-md border border-white/10"></div>
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-400">{item.price} coins</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
