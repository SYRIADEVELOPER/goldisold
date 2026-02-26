import React, { useEffect, useState } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, getDocs, where } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { useNavigate } from 'react-router-dom';
import { Hash, Plus } from 'lucide-react';
import NewChatroomModal from './NewChatroomModal';

interface Chatroom {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  is_private: boolean;
  participants: string[];
}

export default function ChatroomsList() {
  const [rooms, setRooms] = useState<Chatroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewRoomModalOpen, setIsNewRoomModalOpen] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Query for public rooms or rooms where the user is a participant
    const q = query(
      collection(db, 'chatrooms')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRooms: Chatroom[] = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!data.is_private || data.participants.includes(user.uid)) {
          fetchedRooms.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            created_by: data.created_by,
            created_at: data.created_at,
            is_private: data.is_private,
            participants: data.participants || [],
          });
        }
      }
      
      // Sort in memory
      fetchedRooms.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setRooms(fetchedRooms);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center space-x-4 animate-pulse">
            <div className="w-12 h-12 bg-white/10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/10 rounded w-1/3" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-end">
        <button 
          onClick={() => setIsNewRoomModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create Room</span>
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Hash className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-lg font-medium text-gray-400">No rooms yet</p>
          <p className="text-sm mt-2">Create a room to start chatting with the community!</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => navigate(`/rooms/${room.id}`)}
              className="w-full p-4 flex items-center space-x-4 hover:bg-white/5 transition-colors text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#C6A75E]/50 transition-colors">
                <Hash className="w-6 h-6 text-gray-400 group-hover:text-[#C6A75E] transition-colors" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-white truncate">{room.name}</h3>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {room.participants.length} {room.participants.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {room.description || 'No description'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <NewChatroomModal 
        isOpen={isNewRoomModalOpen} 
        onClose={() => setIsNewRoomModalOpen(false)} 
      />
    </div>
  );
}
