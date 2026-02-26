import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { formatDistanceToNow } from 'date-fns';
import { X, Send, Loader2, Flag } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ModerationService } from '@/src/services/moderationService';
import { NotificationService } from '@/src/services/notificationService';

interface Comment {
  id: string;
  text_content: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string;
  };
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

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, postId]);

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

  const fetchComments = async () => {
    try {
      setLoading(true);
      const commentsQuery = query(
        collection(db, 'comments'),
        where('post_id', '==', postId),
        orderBy('created_at', 'asc')
      );
      const querySnapshot = await getDocs(commentsQuery);
      
      const fetchedComments: Comment[] = [];
      for (const commentDoc of querySnapshot.docs) {
        const commentData = commentDoc.data();
        let profileData = { username: 'Unknown', avatar_url: '' };
        
        if (commentData.user_id) {
          const profileDoc = await getDoc(doc(db, 'profiles', commentData.user_id));
          if (profileDoc.exists()) {
            profileData = {
              username: profileDoc.data().username,
              avatar_url: profileDoc.data().avatar_url || ''
            };
          }
        }

        fetchedComments.push({
          id: commentDoc.id,
          text_content: commentData.text_content,
          created_at: commentData.created_at,
          profiles: profileData
        });
      }
      
      setComments(fetchedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
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
      fetchComments();
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
                  <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                    {comment.profiles?.avatar_url ? (
                      <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-medium">
                        {comment.profiles?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline space-x-2">
                      <span className="font-semibold text-sm text-gray-200">
                        {comment.profiles?.username}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1 break-words">
                      {comment.text_content}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleReport(comment.id)}
                    className="p-1 text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Report Comment"
                  >
                    <Flag className="w-3 h-3" />
                  </button>
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
