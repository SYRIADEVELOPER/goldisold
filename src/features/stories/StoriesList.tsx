import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { Plus } from 'lucide-react';
import CreateStoryModal from './CreateStoryModal';
import ViewStoryModal from './ViewStoryModal';

interface Story {
  id: string;
  user_id: string;
  image_url: string;
  text_overlay: string | null;
  created_at: string;
  expires_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

export default function StoriesList() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewStoryIndex, setViewStoryIndex] = useState<number | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      setLoading(true);
      const now = new Date().toISOString();
      
      const storiesQuery = query(
        collection(db, 'stories'),
        where('expires_at', '>', now),
        orderBy('expires_at', 'asc')
      );
      
      const querySnapshot = await getDocs(storiesQuery);
      const fetchedStories: Story[] = [];

      for (const storyDoc of querySnapshot.docs) {
        const storyData = storyDoc.data();
        let profileData = { username: 'Unknown', avatar_url: null };

        if (storyData.user_id) {
          try {
            const profileDoc = await getDoc(doc(db, 'profiles', storyData.user_id));
            if (profileDoc.exists()) {
              profileData = {
                username: profileDoc.data().username,
                avatar_url: profileDoc.data().avatar_url || null
              };
            }
          } catch (e) {
            console.error('Error fetching profile for story:', e);
          }
        }

        fetchedStories.push({
          id: storyDoc.id,
          user_id: storyData.user_id,
          image_url: storyData.image_url,
          text_overlay: storyData.text_overlay,
          created_at: storyData.created_at,
          expires_at: storyData.expires_at,
          profiles: profileData
        });
      }

      // Group stories by user
      const groupedStories = fetchedStories.reduce((acc, story) => {
        if (!acc[story.user_id]) {
          acc[story.user_id] = [];
        }
        acc[story.user_id].push(story);
        return acc;
      }, {} as Record<string, Story[]>);

      // Flatten to show the first story of each user
      const displayStories = Object.values(groupedStories).map(userStories => userStories[0]);

      setStories(displayStories);
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full overflow-x-auto scrollbar-hide py-4 px-4 border-b border-white/5">
      <div className="flex space-x-4">
        {/* Create Story Button */}
        <div className="flex flex-col items-center space-y-2 flex-shrink-0">
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="w-16 h-16 rounded-full bg-[#141414] border-2 border-dashed border-white/20 flex items-center justify-center hover:border-[#C6A75E] hover:bg-white/5 transition-all relative overflow-hidden group"
          >
            {user?.photoURL ? (
               <img src={user.photoURL} alt="Your avatar" className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center">
              <Plus className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            </div>
          </button>
          <span className="text-xs font-medium text-gray-400">Add Story</span>
        </div>

        {/* Stories List */}
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="flex flex-col items-center space-y-2 flex-shrink-0 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-white/10" />
              <div className="w-12 h-3 bg-white/10 rounded" />
            </div>
          ))
        ) : (
          stories.map((story, index) => (
            <div 
              key={story.id} 
              className="flex flex-col items-center space-y-2 flex-shrink-0 cursor-pointer group"
              onClick={() => setViewStoryIndex(index)}
            >
              <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#C6A75E] to-[#f5d98a] group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-full bg-[#0a0a0a] p-[2px]">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white/10">
                    {story.profiles?.avatar_url ? (
                      <img src={story.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
                        {story.profiles?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs font-medium text-gray-300 w-16 truncate text-center">
                {story.profiles?.username}
              </span>
            </div>
          ))
        )}
      </div>

      <CreateStoryModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onStoryAdded={fetchStories} 
      />

      <ViewStoryModal 
        stories={stories} 
        initialIndex={viewStoryIndex ?? 0} 
        isOpen={viewStoryIndex !== null} 
        onClose={() => setViewStoryIndex(null)} 
      />
    </div>
  );
}
