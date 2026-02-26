import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { formatDistanceToNow } from 'date-fns';
import { X, Send, Loader2, Flag, Heart } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ModerationService } from '@/src/services/moderationService';
import { NotificationService } from '@/src/services/notificationService';
import { useNavigate } from 'react-router-dom';

interface Comment {
  id: string;
  user_id: string;
  text_content: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string;
  };
  likes_count: number;
  user_has_liked?: boolean;
}

interface CommentsModalProps {
  postId: string;
  postOwnerId: string;
  isOpen: boolean;
  onClose: () => void;
  onCommentAdded: () => void;
}

export default function CommentsModal({ postId, postOwnerId, isOpen, onClose, onCommentAdded }: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      const q = query(
        collection(db, 'comments'),
        where('post_id', '==', postId)
      );

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const fetchedComments: Comment[] = [];
        
        for (const commentDoc of snapshot.docs) {
          const commentData = commentDoc.data();
          let profileData = { username: 'Unknown', avatar_url: '' };
          
          if (commentData.user_id) {
            try {
              const profileDoc = await getDoc(doc(db, 'profiles', commentData.user_id));
              if (profileDoc.exists()) {
                profileData = {
                  username: profileDoc.data().username,
                  avatar_url: profileDoc.data().avatar_url || ''
                };
              }
            } catch (e) {
              console.error('Error fetching profile for comment:', e);
            }
          }

          // Fetch likes count
          let likesCount = 0;
          let userHasLiked = false;
          try {
            const likesQuery = query(collection(db, 'comment_likes'), where('comment_id', '==', commentDoc.id));
            const likesSnapshot = await getDocs(likesQuery);
            likesCount = likesSnapshot.size;
            
            if (user) {
              userHasLiked = likesSnapshot.docs.some(doc => doc.data().user_id === user.uid);
            }
          } catch (e) {
            console.error('Error fetching comment likes:', e);
          }

          fetchedComments.push({
            id: commentDoc.id,
            user_id: commentData.user_id,
            text_content: commentData.text_content,
            created_at: commentData.created_at,
            profiles: profileData,
            likes_count: likesCount,
            user_has_liked: userHasLiked
          });
        }
        
        // Sort in memory
        fetchedComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        setComments(fetchedComments);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [isOpen, postId, user]);

  const handleReport = async (commentId: string) => {
    if (!user) return;
    const reason = window.prompt('Why are you reporting this comment?');
    if (reason) {
      try {
        await ModerationService.reportContent(user.uid, commentId, 'comment', reason);
        alert('Thank you for your report.');
      } catch (error) {
        console.error('Error reporting comment:', error);
      }
    }
  };

  const toggleLike = async (comment: Comment) => {
    if (!user) return;
    try {
      const likeId = `${user.uid}_${comment.id}`;
      const likeRef = doc(db, 'comment_likes', likeId);
      
      if (comment.user_has_liked) {
        await deleteDoc(likeRef);
      } else {
        await setDoc(likeRef, {
          comment_id: comment.id,
          user_id: user.uid,
          created_at: new Date().toISOString()
        });
        
        // Notify comment owner
        if (comment.user_id !== user.uid) {
          await NotificationService.sendNotification(comment.user_id, user.uid, 'like', postId);
        }
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const renderTextWithMentions = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const username = part.substring(1);
        return (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              // We'd need to find the user ID by username, but for now we'll just navigate to a search or profile if we had the ID
              // A better way would be to store mentions as objects with IDs, but let's do a simple version
              navigate(`/search?q=${username}`);
            }}
            className="text-[#C6A75E] hover:underline font-medium"
          >
            {part}
          </button>
        );
      }
      return part;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    try {
      setSubmitting(true);
      await addDoc(collection(db, 'comments'), {
        post_id: postId,
        user_id: user.uid,
        text_content: newComment.trim(),
        created_at: new Date().toISOString()
      });

      if (postOwnerId) {
        await NotificationService.sendNotification(postOwnerId, user.uid, 'comment', postId);
      }

      setNewComment('');
      onCommentAdded();
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg bg-[#141414] rounded-t-3xl sm:rounded-3xl h-[80vh] sm:h-[600px] flex flex-col border border-white/10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Comments</h2>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#C6A75E]" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                No comments yet. Be the first to comment!
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex space-x-3 group">
                  <button 
                    onClick={() => {
                      navigate(`/profile/${comment.user_id}`);
                      onClose();
                    }}
                    className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
                  >
                    {comment.profiles?.avatar_url ? (
                      <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-medium">
                        {comment.profiles?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-baseline space-x-2">
                      <button 
                        onClick={() => {
                          navigate(`/profile/${comment.user_id}`);
                          onClose();
                        }}
                        className="font-semibold text-sm text-gray-200 hover:text-white transition-colors"
                      >
                        {comment.profiles?.username || 'Unknown'}
                      </button>
                      <span className="text-xs text-gray-500">
                        {comment.created_at ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true }) : 'Recently'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1 break-words">
                      {renderTextWithMentions(comment.text_content)}
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      <button 
                        onClick={() => toggleLike(comment)}
                        className={cn(
                          "flex items-center space-x-1 text-xs transition-colors",
                          comment.user_has_liked ? "text-red-500" : "text-gray-500 hover:text-gray-300"
                        )}
                      >
                        <Heart className={cn("w-3 h-3", comment.user_has_liked && "fill-current")} />
                        <span>{comment.likes_count || 0}</span>
                      </button>
                      <button 
                        onClick={() => handleReport(comment.id)}
                        className="text-xs text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex items-center space-x-1"
                      >
                        <Flag className="w-3 h-3" />
                        <span>Report</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Comment Input */}
          <div className="p-4 border-t border-white/10 bg-[#0a0a0a]">
            <form onSubmit={handleSubmit} className="flex items-end space-x-3">
              <div className="flex-1 bg-white/5 rounded-2xl border border-white/10 overflow-hidden focus-within:border-[#C6A75E]/50 transition-colors">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none max-h-32 min-h-[44px] py-3 px-4 text-white placeholder-gray-500"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="p-3 rounded-full bg-[#C6A75E] text-[#0a0a0a] disabled:opacity-50 disabled:bg-white/10 disabled:text-gray-500 transition-colors flex-shrink-0 mb-0.5"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
