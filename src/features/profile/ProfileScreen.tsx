import React, { useEffect, useState } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { Grid, Settings, LogOut, Heart, UserPlus, UserCheck } from 'lucide-react';
import EditProfileModal from './EditProfileModal';
import { useParams } from 'react-router-dom';

interface Profile {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  followers: { count: number }[];
  following: { count: number }[];
}

interface Post {
  id: string;
  image_url: string | null;
}

export default function ProfileScreen() {
  const { id } = useParams<{ id: string }>();
  const { user, signOut } = useAuthStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const profileId = id || user?.uid;
  const isOwnProfile = user?.uid === profileId;

  useEffect(() => {
    if (profileId) {
      fetchProfile();
      fetchPosts();
      if (!isOwnProfile && user) {
        checkFollowStatus();
      }
    }
  }, [profileId, user]);

  const checkFollowStatus = async () => {
    if (!user || !profileId) return;
    try {
      const followerDoc = await getDoc(doc(db, 'followers', `${user.uid}_${profileId}`));
      setIsFollowing(followerDoc.exists());
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const toggleFollow = async () => {
    if (!user || !profileId) return;
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
      setIsFollowing(!isFollowing);
      fetchProfile(); // Refresh follower count
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const fetchProfile = async () => {
    if (!profileId) return;
    try {
      const profileDoc = await getDoc(doc(db, 'profiles', profileId));
      if (profileDoc.exists()) {
        const profileData = profileDoc.data();
        
        // Fetch followers count
        const followersQuery = query(collection(db, 'followers'), where('following_id', '==', profileId));
        const followersSnapshot = await getDocs(followersQuery);
        
        // Fetch following count
        const followingQuery = query(collection(db, 'followers'), where('follower_id', '==', profileId));
        const followingSnapshot = await getDocs(followingQuery);

        setProfile({
          id: profileDoc.id,
          username: profileData.username,
          bio: profileData.bio || null,
          avatar_url: profileData.avatar_url || null,
          followers: [{ count: followersSnapshot.size }],
          following: [{ count: followingSnapshot.size }]
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchPosts = async () => {
    if (!profileId) return;
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        where('user_id', '==', profileId),
        orderBy('created_at', 'desc')
      );
      const querySnapshot = await getDocs(postsQuery);
      const fetchedPosts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        image_url: doc.data().image_url || null,
      }));
      setPosts(fetchedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col space-y-8 p-4 animate-pulse">
        <div className="flex items-center space-x-6">
          <div className="w-20 h-20 bg-white/10 rounded-full" />
          <div className="flex-1 space-y-4">
            <div className="h-6 bg-white/10 rounded w-1/3" />
            <div className="flex space-x-4">
              <div className="h-4 bg-white/10 rounded w-1/4" />
              <div className="h-4 bg-white/10 rounded w-1/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-20 sm:pb-0">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-white">{profile?.username}</h1>
        <div className="flex items-center space-x-4">
          <button className="text-gray-400 hover:text-white transition-colors">
            <Settings className="w-6 h-6" />
          </button>
          <button onClick={signOut} className="text-gray-400 hover:text-red-500 transition-colors">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="w-20 h-20 rounded-full bg-white/10 overflow-hidden border border-white/5">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-2xl font-medium">
                {profile?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex space-x-6 text-center">
            <div>
              <p className="text-xl font-bold text-white">{posts.length}</p>
              <p className="text-xs text-gray-500 font-medium tracking-wide">POSTS</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">{profile?.followers?.[0]?.count || 0}</p>
              <p className="text-xs text-gray-500 font-medium tracking-wide">FOLLOWERS</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">{profile?.following?.[0]?.count || 0}</p>
              <p className="text-xs text-gray-500 font-medium tracking-wide">FOLLOWING</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-white">{profile?.username}</h2>
          {profile?.bio && <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{profile.bio}</p>}
        </div>

        <div className="flex space-x-2">
          {isOwnProfile ? (
            <>
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 bg-white/10 hover:bg-white/15 text-white font-medium py-1.5 rounded-lg text-sm transition-colors"
              >
                Edit Profile
              </button>
              <button className="flex-1 bg-white/10 hover:bg-white/15 text-white font-medium py-1.5 rounded-lg text-sm transition-colors">
                Share Profile
              </button>
            </>
          ) : (
            <button
              onClick={toggleFollow}
              className={`flex-1 font-medium py-1.5 rounded-lg text-sm transition-colors flex items-center justify-center space-x-2 ${
                isFollowing
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'bg-[#C6A75E] text-[#0a0a0a] hover:bg-[#b59855]'
              }`}
            >
              {isFollowing ? (
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
          )}
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="flex justify-center border-b border-white/5">
          <button className="flex items-center justify-center w-1/2 py-3 border-b-2 border-[#C6A75E] text-[#C6A75E]">
            <Grid className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-0.5">
          {posts.map((post) => (
            <div key={post.id} className="aspect-square bg-[#141414] relative group cursor-pointer">
              {post.image_url ? (
                <img src={post.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-2">
                  <p className="text-[10px] text-gray-500 line-clamp-4 text-center">
                    Text Post
                  </p>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {isEditModalOpen && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          currentBio={profile?.bio || null}
          currentAvatarUrl={profile?.avatar_url || null}
          onProfileUpdated={fetchProfile}
        />
      )}
    </div>
  );
}
