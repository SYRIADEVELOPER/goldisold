import React, { useEffect, useState } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: 'followers' | 'following';
  title: string;
}

interface User {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function UserListModal({ isOpen, onClose, userId, type, title }: UserListModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && userId) {
      fetchUsers();
    }
  }, [isOpen, userId, type]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let q;
      if (type === 'followers') {
        q = query(collection(db, 'followers'), where('following_id', '==', userId));
      } else {
        q = query(collection(db, 'followers'), where('follower_id', '==', userId));
      }

      const snapshot = await getDocs(q);
      const userIds = snapshot.docs.map(doc => 
        type === 'followers' ? doc.data().follower_id : doc.data().following_id
      );

      const fetchedUsers: User[] = [];
      for (const id of userIds) {
        try {
          const userDoc = await getDoc(doc(db, 'profiles', id));
          if (userDoc.exists()) {
            fetchedUsers.push({
              id: userDoc.id,
              username: userDoc.data().username,
              avatar_url: userDoc.data().avatar_url || null
            });
          }
        } catch (e) {
          console.error(`Error fetching user ${id}:`, e);
        }
      }

      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Error fetching users list:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#141414] w-full max-w-md rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-white/10 rounded-full" />
                  <div className="h-4 bg-white/10 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : users.length > 0 ? (
            users.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  navigate(`/profile/${user.id}`);
                  onClose();
                }}
                className="flex items-center space-x-4 w-full hover:bg-white/5 p-2 rounded-xl transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden border border-white/5">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
                      {user.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="font-medium text-white">{user.username}</span>
              </button>
            ))
          ) : (
            <div className="text-center text-gray-500 py-8">
              No users found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
