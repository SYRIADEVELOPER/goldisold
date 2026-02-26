import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { useNavigate } from 'react-router-dom';
import { X, Search, User as UserIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface User {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchQuery.trim().length > 2) {
      const delayDebounceFn = setTimeout(() => {
        handleSearch();
      }, 500);

      return () => clearTimeout(delayDebounceFn);
    } else {
      setResults([]);
    }
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'profiles'),
        where('username', '>=', searchQuery),
        where('username', '<=', searchQuery + '\uf8ff')
      );
      const querySnapshot = await getDocs(q);
      const fetchedUsers: User[] = [];
      querySnapshot.forEach((doc) => {
        if (doc.id !== user?.uid) {
          fetchedUsers.push({
            id: doc.id,
            username: doc.data().username,
            avatar_url: doc.data().avatar_url || null,
          });
        }
      });
      setResults(fetchedUsers);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (otherUserId: string) => {
    if (!user) return;
    
    // Check if chat already exists
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );
    const querySnapshot = await getDocs(q);
    let existingChatId = null;

    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      if (data.participants.includes(otherUserId) && data.participants.length === 2) {
        existingChatId = doc.id;
        break;
      }
    }

    if (existingChatId) {
      navigate(`/chats/${existingChatId}`);
      onClose();
    } else {
      // Create new chat
      const newChatRef = await addDoc(collection(db, 'chats'), {
        participants: [user.uid, otherUserId],
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        last_message: null
      });
      navigate(`/chats/${newChatRef.id}`);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#141414] w-full max-w-md rounded-2xl overflow-hidden border border-white/10 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">New Message</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people..."
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#C6A75E] transition-colors"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-4">
              <div className="w-6 h-6 border-2 border-[#C6A75E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => startChat(result.id)}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden border border-white/5 group-hover:border-white/20 transition-colors">
                    {result.avatar_url ? (
                      <img src={result.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
                        {result.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white">{result.username}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery.length > 2 ? (
            <div className="text-center p-8 text-gray-500">
              <p>No users found</p>
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              <p>Type to search for people</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
