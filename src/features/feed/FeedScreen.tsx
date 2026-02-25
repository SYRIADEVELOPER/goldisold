import React, { useEffect, useState } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc, deleteDoc, where } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import CommentsModal from './CommentsModal';
import StoriesList from '../stories/StoriesList';

interface Post {
  id: string;
  text_content: string;
  image_url: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string;
  };
  likes: { count: number }[];
  comments: { count: number }[];
  user_has_liked?: boolean;
}

export default function FeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const postsQuery = query(collection(db, 'posts'), orderBy('created_at', 'desc'), limit(20));
      const querySnapshot = await getDocs(postsQuery);
      
      const fetchedPosts: Post[] = [];
      
      for (const postDoc of querySnapshot.docs) {
        const postData = postDoc.data();
        
        // Fetch profile
        let profileData = { username: 'Unknown', avatar_url: '' };
        if (postData.user_id) {
          try {
            const profileDoc = await getDoc(doc(db, 'profiles', postData.user_id));
            if (profileDoc.exists()) {
              profileData = {
                username: profileDoc.data().username,
                avatar_url: profileDoc.data().avatar_url || ''
              };
            }
          } catch (e) {
            console.error('Error fetching profile for post:', e);
          }
        }

        // Fetch likes count
        let likesCount = 0;
        try {
          const likesQuery = query(collection(db, 'likes'), where('post_id', '==', postDoc.id));
          const likesSnapshot = await getDocs(likesQuery);
          likesCount = likesSnapshot.size;
        } catch (e) {
          console.error('Error fetching likes:', e);
        }

        // Fetch comments count
        let commentsCount = 0;
        try {
          const commentsQuery = query(collection(db, 'comments'), where('post_id', '==', postDoc.id));
          const commentsSnapshot = await getDocs(commentsQuery);
          commentsCount = commentsSnapshot.size;
        } catch (e) {
          console.error('Error fetching comments:', e);
        }

        fetchedPosts.push({
          id: postDoc.id,
          text_content: postData.text_content || '',
          image_url: postData.image_url || '',
          created_at: postData.created_at,
          profiles: profileData,
          likes: [{ count: likesCount }],
          comments: [{ count: commentsCount }],
        });
      }

      if (user && fetchedPosts.length > 0) {
        try {
          const userLikesQuery = query(collection(db, 'likes'), where('user_id', '==', user.uid));
          const userLikesSnapshot = await getDocs(userLikesQuery);
          
          const likedPostIds = new Set(userLikesSnapshot.docs.map(doc => doc.data().post_id));
          
          for (let i = 0; i < fetchedPosts.length; i++) {
            fetchedPosts[i].user_has_liked = likedPostIds.has(fetchedPosts[i].id);
          }
        } catch (e) {
          console.error('Error fetching user likes:', e);
        }
      }

      setPosts(fetchedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!user) return;

    // Optimistic update
    setPosts((currentPosts) =>
      currentPosts.map((p) => {
        if (p.id === postId) {
          const currentCount = p.likes?.[0]?.count || 0;
          return {
            ...p,
            user_has_liked: !isLiked,
            likes: [{ count: currentCount + (isLiked ? -1 : 1) }],
          };
        }
        return p;
      })
    );

    try {
      const likeRef = doc(db, 'likes', `${user.uid}_${postId}`);
      if (isLiked) {
        await deleteDoc(likeRef);
      } else {
        await setDoc(likeRef, {
          post_id: postId,
          user_id: user.uid,
          created_at: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error('Error toggling like:', error);
      // Revert optimistic update
      fetchPosts();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col space-y-8 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white/10 rounded-full" />
              <div className="h-4 bg-white/10 rounded w-1/4" />
            </div>
            <div className="h-64 bg-white/10 rounded-2xl w-full" />
            <div className="h-4 bg-white/10 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-20 sm:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between sm:hidden">
        <h1 className="text-xl font-bold tracking-tight text-[#C6A75E]">old Gold</h1>
      </header>

      {/* Stories */}
      <StoriesList />

      {/* Feed List */}
      <div className="flex flex-col divide-y divide-white/5">
        {posts.map((post) => (
          <article key={post.id} className="p-4 sm:p-6 flex flex-col space-y-4">
            {/* Post Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden border border-white/5">
                  {post.profiles?.avatar_url ? (
                    <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
                      {post.profiles?.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-200">{post.profiles?.username}</h3>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <button className="text-gray-500 hover:text-gray-300 transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* Post Content */}
            {post.image_url && (
              <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#141414]">
                <img 
                  src={post.image_url} 
                  alt="Post content" 
                  className="w-full h-auto max-h-[600px] object-cover"
                  loading="lazy"
                />
              </div>
            )}
            
            {post.text_content && (
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {post.text_content}
              </p>
            )}

            {/* Post Actions */}
            <div className="flex items-center space-x-6 pt-2">
              <button 
                onClick={() => handleLike(post.id, !!post.user_has_liked)}
                className={cn(
                  "flex items-center space-x-2 transition-colors group",
                  post.user_has_liked ? "text-[#C6A75E]" : "text-gray-500 hover:text-[#C6A75E]"
                )}
              >
                <Heart className={cn("w-5 h-5", post.user_has_liked ? "fill-[#C6A75E]" : "group-hover:fill-[#C6A75E]/20")} />
                <span className="text-xs font-medium">{post.likes?.[0]?.count || 0}</span>
              </button>
              <button 
                onClick={() => setActiveCommentPostId(post.id)}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-xs font-medium">{post.comments?.[0]?.count || 0}</span>
              </button>
              <button className="flex items-center space-x-2 text-gray-500 hover:text-gray-300 transition-colors ml-auto">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </article>
        ))}

        {posts.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-sm">No posts yet. Be the first to share something!</p>
          </div>
        )}
      </div>

      <CommentsModal 
        postId={activeCommentPostId || ''} 
        isOpen={!!activeCommentPostId} 
        onClose={() => setActiveCommentPostId(null)} 
        onCommentAdded={fetchPosts} 
      />
    </div>
  );
}
