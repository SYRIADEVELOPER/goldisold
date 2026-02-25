import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { Search, UserPlus, UserCheck } from 'lucide-react';
import { useAuthStore } from '../auth/store';
import { Link } from 'react-router-dom';

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  is_following: boolean;
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (searchQuery.trim().length > 2) {
      searchUsers();
    } else {
      setResults([]);
    }
  }, [searchQuery]);

  const searchUsers = async () => {
    setLoading(true);
    try {
      // In Firestore, a simple prefix search is done using >= and <=
      const q = query(
        collection(db, 'profiles'),
        where('username', '>=', searchQuery.toLowerCase()),
        where('username', '<=', searchQuery.toLowerCase() + '\uf8ff')
      );
      
      const querySnapshot = await getDocs(q);
      const fetchedProfiles: Profile[] = [];

      for (const docSnapshot of querySnapshot.docs) {
        if (docSnapshot.id === user?.uid) continue; // Skip current user

        const profileData = docSnapshot.data();
        let isFollowing = false;

        if (user) {
          const followerDoc = await getDoc(doc(db, 'followers', `${user.uid}_${docSnapshot.id}`));
          isFollowing = followerDoc.exists();
        }

        fetchedProfiles.push({
          id: docSnapshot.id,
          username: profileData.username,
          avatar_url: profileData.avatar_url || null,
          is_following: isFollowing
        });
      }

      setResults(fetchedProfiles);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (profileId: string, isFollowing: boolean) => {
    if (!user) return;
    try {
      const followRef = doc(db, 'followers', `${user.uid}_${profileId}`);
      
      if (isFollowing) {
        await deleteDoc(followRef);
      } else {
        await setDoc(followRef, {
          follower_id: user.uid,
          following_id: profileId,
          created_at: new Date().toISOString()
        });
      }
      
      setResults(results.map(p => 
        p.id === profileId ? { ...p, is_following: !isFollowing } : p
      ));
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-[#f5f5f5]">
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-white/10 rounded-xl focus:outline-none focus:border-[#C6A75E] transition-colors text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-[#C6A75E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length > 0 ? (
          results.map((profile) => (
            <div key={profile.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
              <Link to={`/profile/${profile.id}`} className="flex items-center space-x-3 flex-1">
                <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden border border-white/5">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
                      {profile.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-200">{profile.username}</p>
                </div>
              </Link>
              <button
                onClick={() => toggleFollow(profile.id, profile.is_following)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center space-x-1 ${
                  profile.is_following
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-[#C6A75E] text-[#0a0a0a] hover:bg-[#b59855]'
                }`}
              >
                {profile.is_following ? (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            </div>
          ))
        ) : searchQuery.length > 2 ? (
          <div className="text-center text-gray-500 mt-8 text-sm">
            No users found matching "{searchQuery}"
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-8 text-sm">
            Search for users by their username
          </div>
        )}
      </div>
    </div>
  );
}
