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
  is_viewed?: boolean;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface UserStories {
  user_id: string;
  stories: Story[];
  all_viewed: boolean;
  profile: {
    username: string;
    avatar_url: string | null;
  };
}

export default function StoriesList() {
  const [displayGroups, setDisplayGroups] = useState<UserStories[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewStoryIndex, setViewStoryIndex] = useState<number | null>(null);
  const [activeStories, setActiveStories] = useState<Story[]>([]);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchStories();
  }, [user]);

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

      // Fetch views for current user
      const viewedStoryIds = new Set<string>();
      if (user) {
        const viewsQuery = query(collection(db, 'story_views'), where('user_id', '==', user.uid));
        const viewsSnapshot = await getDocs(viewsQuery);
        viewsSnapshot.docs.forEach(doc => viewedStoryIds.add(doc.data().story_id));
      }

      for (const storyDoc of querySnapshot.docs) {
        const storyData = storyDoc.data();
        
        // Skip stories pending moderation
        if (storyData.status === 'pending_moderation') continue;

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
          } catch (e: any) {
            if (e.code !== 'unavailable') {
              console.error('Error fetching profile for story:', e);
            }
          }
        }

        fetchedStories.push({
          id: storyDoc.id,
          user_id: storyData.user_id,
          image_url: storyData.image_url,
          text_overlay: storyData.text_overlay,
          created_at: storyData.created_at,
          expires_at: storyData.expires_at,
          is_viewed: viewedStoryIds.has(storyDoc.id),
          profiles: profileData
        });
      }

      // Group stories by user
      const groupedStories = fetchedStories.reduce((acc, story) => {
        if (!acc[story.user_id]) {
          acc[story.user_id] = {
            user_id: story.user_id,
            stories: [],
            all_viewed: true,
            profile: story.profiles
          };
        }
        acc[story.user_id].stories.push(story);
        if (!story.is_viewed) {
          acc[story.user_id].all_viewed = false;
        }
        return acc;
      }, {} as Record<string, UserStories>);

      const groups = Object.values(groupedStories);
      setDisplayGroups(groups);
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewStories = (groupIndex: number) => {
    const group = displayGroups[groupIndex];
    setActiveStories(group.stories);
    setViewStoryIndex(0);
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
          displayGroups.map((group, index) => (
            <div 
              key={group.user_id} 
              className="flex flex-col items-center space-y-2 flex-shrink-0 cursor-pointer group"
              onClick={() => handleViewStories(index)}
            >
              <div className={`w-16 h-16 rounded-full p-[2px] transition-all duration-300 ${
                group.all_viewed 
                  ? 'bg-white/10' 
                  : 'bg-gradient-to-tr from-[#C6A75E] to-[#f5d98a] group-hover:scale-105'
              }`}>
                <div className="w-full h-full rounded-full bg-[#0a0a0a] p-[2px]">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white/10">
                    {group.profile?.avatar_url ? (
                      <img src={group.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
                        {group.profile?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs font-medium text-gray-300 w-16 truncate text-center">
                {group.profile?.username}
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
        stories={activeStories} 
        initialIndex={viewStoryIndex ?? 0} 
        isOpen={viewStoryIndex !== null} 
        onClose={() => {
          setViewStoryIndex(null);
          fetchStories(); // Refresh to update viewed status
        }} 
      />
    </div>
  );
}
