import React, { useEffect, useState } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc, deleteDoc, where, startAfter, QueryDocumentSnapshot, runTransaction } from 'firebase/firestore';
import { useAuthStore } from '@/src/features/auth/store';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, MoreHorizontal, ShieldAlert, Flag, Loader2, Smile } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import CommentsModal from './CommentsModal';
import StoriesList from '../stories/StoriesList';
import { ModerationService } from '@/src/services/moderationService';
import { NotificationService } from '@/src/services/notificationService';
import { cacheService } from '@/src/services/cacheService';
import ReactionModal from '@/src/components/ReactionModal';

interface Post {
  id: string;
  text_content: string;
  image_url: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_url: string;
  };
  likes: { count: number }[];
  comments: { count: number }[];
  user_has_liked?: boolean;
  reactions?: { [key: string]: number };
}

export default function FeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [activeReactionPostId, setActiveReactionPostId] = useState<string | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'latest' | 'trending'>('latest');
  const { user } = useAuthStore();

  // Pull to refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);

  useEffect(() => {
    const init = async () => {
      if (user) {
        const blocked = await ModerationService.getBlockedUsers(user.uid);
        setBlockedUserIds(blocked);
      }
      fetchPosts();
    };
    init();
  }, [user, activeTab]);

  const fetchPosts = async (isLoadMore = false) => {
    if (isLoadMore && !hasMore) return;
    
    try {
      if (isLoadMore) setLoadingMore(true);
      else if (!refreshing) setLoading(true);

      // Try to load from cache first if not loading more
      if (!isLoadMore && !refreshing) {
        const cachedPosts = await cacheService.getPosts();
        if (cachedPosts.length > 0) {
          // Sort cached posts by date
          cachedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setPosts(cachedPosts);
          setLoading(false); // Show cached content immediately
        }
      }

      let postsQuery;

      if (activeTab === 'latest') {
        // ... existing query logic ...
        postsQuery = query(
          collection(db, 'posts'), 
          orderBy('created_at', 'desc'), 
          limit(10)
        );

        if (isLoadMore && lastVisible) {
          postsQuery = query(
            collection(db, 'posts'),
            orderBy('created_at', 'desc'),
            startAfter(lastVisible),
            limit(10)
          );
        }
      } else {
        // ... trending query logic ...
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        postsQuery = query(
          collection(db, 'posts'),
          where('created_at', '>=', yesterday.toISOString()),
          limit(50)
        );
      }

      const querySnapshot = await getDocs(postsQuery);
      
      if (querySnapshot.empty) {
        setHasMore(false);
        if (!isLoadMore && posts.length === 0) setPosts([]); // Only clear if no cached posts either
        return;
      }

      if (activeTab === 'latest') {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        if (querySnapshot.size < 10) setHasMore(false);
      } else {
        setHasMore(false);
      }

      let fetchedPosts: Post[] = [];
      
      for (const postDoc of querySnapshot.docs) {
        // ... post processing ...
        const postData = postDoc.data() as any;
        
        // Skip if user is blocked
        if (blockedUserIds.includes(postData.user_id)) continue;

        // ... profile fetching ...
        let profileData = { username: 'Unknown', avatar_url: '' };
        if (postData.user_id) {
          try {
            // Try cache first for profile
            const cachedProfile = await cacheService.getProfile(postData.user_id);
            if (cachedProfile) {
              profileData = cachedProfile;
            } else {
              // Then fetch fresh
              const profileDoc = await getDoc(doc(db, 'profiles', postData.user_id));
              if (profileDoc.exists()) {
                profileData = {
                  username: profileDoc.data().username,
                  avatar_url: profileDoc.data().avatar_url || ''
                };
                // Update cache
                await cacheService.saveProfile({ id: postData.user_id, ...profileData });
              }
            }
          } catch (e: any) {
             if (e.code !== 'unavailable') {
              console.error('Error fetching profile for post:', e);
            }
          }
        }

        fetchedPosts.push({
          id: postDoc.id,
          user_id: postData.user_id,
          text_content: postData.text_content || '',
          image_url: postData.image_url || '',
          created_at: postData.created_at,
          profiles: profileData,
          likes: [{ count: 0 }], // Will be updated below
          comments: [{ count: 0 }], // Will be updated below
          reactions: {}, // Will be updated below
        });
      }

      // Sort latest posts in memory if we removed orderBy (though latest query is simple)
      if (activeTab === 'latest') {
        fetchedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      // Fetch likes/comments/reactions for each post
      for (let post of fetchedPosts) {
        // Fetch likes count
        try {
          const likesQuery = query(collection(db, 'likes'), where('post_id', '==', post.id));
          const likesSnapshot = await getDocs(likesQuery);
          post.likes = [{ count: likesSnapshot.size }];
        } catch (e) {
          console.error('Error fetching likes:', e);
        }

        // Fetch comments count
        try {
          const commentsQuery = query(collection(db, 'comments'), where('post_id', '==', post.id));
          const commentsSnapshot = await getDocs(commentsQuery);
          post.comments = [{ count: commentsSnapshot.size }];
        } catch (e) {
          console.error('Error fetching comments:', e);
        }

        // Fetch reactions
        try {
          const reactionsQuery = query(collection(db, 'reactions'), where('post_id', '==', post.id));
          const reactionsSnapshot = await getDocs(reactionsQuery);
          reactionsSnapshot.forEach(reactionDoc => {
            const reaction = reactionDoc.data();
            if (post.reactions) {
              if (post.reactions[reaction.emoji]) {
                post.reactions[reaction.emoji]++;
              } else {
                post.reactions[reaction.emoji] = 1;
              }
            }
          });
        } catch (e) {
          console.error('Error fetching reactions:', e);
        }
      }

      // ... existing user likes check ...
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

      if (activeTab === 'trending') {
        fetchedPosts.sort((a, b) => {
          const scoreA = (a.likes[0]?.count || 0) + (a.comments[0]?.count || 0);
          const scoreB = (b.likes[0]?.count || 0) + (b.comments[0]?.count || 0);
          return scoreB - scoreA;
        });
      }

      if (isLoadMore && activeTab === 'latest') {
        setPosts(prev => {
           const newPosts = [...prev, ...fetchedPosts];
           // Save to cache (only latest 50 to avoid bloat)
           if (activeTab === 'latest') {
             cacheService.savePosts(newPosts.slice(0, 50));
           }
           return newPosts;
        });
      } else {
        setPosts(fetchedPosts);
        // Save to cache
        if (activeTab === 'latest') {
          cacheService.savePosts(fetchedPosts);
        }
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      // If error (e.g. offline), we already showed cached posts if available
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleReport = async (postId: string) => {
    if (!user) return;
    const reason = window.prompt('Why are you reporting this post?');
    if (reason) {
      try {
        await ModerationService.reportContent(user.uid, postId, 'post', reason);
        alert('Thank you for your report. We will review it shortly.');
      } catch (error) {
        console.error('Error reporting post:', error);
      }
    }
  };

  const handleReaction = async (postId: string, emoji: string) => {
    if (!user) return;

    const reactionRef = doc(db, 'reactions', `${user.uid}_${postId}_${emoji}`);
    const postRef = doc(db, 'posts', postId);

    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) {
          throw 'Post does not exist!';
        }

        const postData = postDoc.data() as Post;
        const reactions = postData.reactions || {};

        if (reactions[emoji]) {
          reactions[emoji]++;
        } else {
          reactions[emoji] = 1;
        }

        transaction.update(postRef, { reactions });
        transaction.set(reactionRef, {
          post_id: postId,
          user_id: user.uid,
          emoji: emoji,
          created_at: new Date().toISOString(),
        });
      });
    } catch (e) {
      console.error('Error adding reaction: ', e);
    }
  };
  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!user) return;

    const post = posts.find(p => p.id === postId);
    const postOwnerId = post?.user_id;

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
        if (postOwnerId) {
          await NotificationService.removeNotification(postOwnerId, user.uid, 'like', postId);
        }
      } else {
        await setDoc(likeRef, {
          post_id: postId,
          user_id: user.uid,
          created_at: new Date().toISOString()
        });
        if (postOwnerId) {
          await NotificationService.sendNotification(postOwnerId, user.uid, 'like', postId);
        }
      }
    } catch (error: any) {
      console.error('Error toggling like:', error);
      // Revert optimistic update
      fetchPosts();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY > 0) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - startY;
      if (distance > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(distance * 0.5, 100)); // Max pull distance
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60) {
      setRefreshing(true);
      await fetchPosts();
      setRefreshing(false);
    }
    setStartY(0);
    setPullDistance(0);
  };

  if (loading && !refreshing) {
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
    <div 
      className="flex flex-col pb-20 sm:pb-0 relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center items-center overflow-hidden transition-all duration-200 ease-out z-50 pointer-events-none"
        style={{ height: `${pullDistance}px`, opacity: pullDistance / 100 }}
      >
        <div className={cn(
          "w-8 h-8 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center shadow-lg",
          refreshing && "animate-spin"
        )}>
          <Loader2 className="w-4 h-4 text-[#C6A75E]" />
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex flex-col space-y-3 sm:hidden">
        <h1 className="text-xl font-bold tracking-tight text-[#C6A75E]">old Gold</h1>
        
        {/* Mobile Tabs */}
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('latest')}
            className={cn(
              "text-sm font-medium transition-colors pb-1 border-b-2",
              activeTab === 'latest' ? "text-white border-[#C6A75E]" : "text-gray-500 border-transparent hover:text-gray-300"
            )}
          >
            Latest
          </button>
          <button
            onClick={() => setActiveTab('trending')}
            className={cn(
              "text-sm font-medium transition-colors pb-1 border-b-2",
              activeTab === 'trending' ? "text-white border-[#C6A75E]" : "text-gray-500 border-transparent hover:text-gray-300"
            )}
          >
            Trending
          </button>
        </div>
      </header>

      {/* Desktop Tabs */}
      <div className="hidden sm:flex items-center space-x-6 px-6 py-4 border-b border-white/5">
        <button
          onClick={() => setActiveTab('latest')}
          className={cn(
            "text-sm font-medium transition-colors pb-1 border-b-2",
            activeTab === 'latest' ? "text-white border-[#C6A75E]" : "text-gray-500 border-transparent hover:text-gray-300"
          )}
        >
          Latest
        </button>
        <button
          onClick={() => setActiveTab('trending')}
          className={cn(
            "text-sm font-medium transition-colors pb-1 border-b-2",
            activeTab === 'trending' ? "text-white border-[#C6A75E]" : "text-gray-500 border-transparent hover:text-gray-300"
          )}
        >
          Trending
        </button>
      </div>

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
                      {post.profiles?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-200">{post.profiles?.username || 'Unknown'}</h3>
                  <p className="text-xs text-gray-500">
                    {post.created_at ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : 'Recently'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => handleReport(post.id)}
                  className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded-full hover:bg-white/5"
                  title="Report Post"
                >
                  <Flag className="w-4 h-4" />
                </button>
                <button className="text-gray-500 hover:text-gray-300 transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
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

            {/* Post Reactions */}
            {post.reactions && Object.keys(post.reactions).length > 0 && (
              <div className="flex items-center space-x-2 pt-2">
                {Object.entries(post.reactions).map(([emoji, count]) => (
                  <div key={emoji} className="flex items-center space-x-1 bg-white/10 px-2 py-1 rounded-full">
                    <span>{emoji}</span>
                    <span className="text-xs font-medium text-gray-400">{count}</span>
                  </div>
                ))}
              </div>
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
              <button 
                onClick={() => setActiveReactionPostId(post.id)}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Smile className="w-5 h-5" />
              </button>
              <button className="flex items-center space-x-2 text-gray-500 hover:text-gray-300 transition-colors ml-auto">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </article>
        ))}

        {hasMore && (
          <div className="p-8 flex justify-center">
            <button
              onClick={() => fetchPosts(true)}
              disabled={loadingMore}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors font-medium disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

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
        postOwnerId={posts.find(p => p.id === activeCommentPostId)?.user_id || ''}
        isOpen={!!activeCommentPostId} 
        onClose={() => setActiveCommentPostId(null)} 
        onCommentAdded={fetchPosts} 
      />

      <ReactionModal 
        isOpen={!!activeReactionPostId}
        onClose={() => setActiveReactionPostId(null)}
        onSelect={(emoji) => {
          if (activeReactionPostId) {
            handleReaction(activeReactionPostId, emoji);
          }
          setActiveReactionPostId(null);
        }}
      />
    </div>
  );
}
