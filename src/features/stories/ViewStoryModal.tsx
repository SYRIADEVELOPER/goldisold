import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Send, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { db } from '@/src/lib/firebase';
import { doc, setDoc, collection, addDoc, query, where, orderBy, onSnapshot, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { cn } from '@/src/lib/utils';

interface Story {
  id: string;
  image_url: string | null;
  text_overlay: string | null;
  background_style?: string | null;
  font_style?: string | null;
  text_color?: string | null;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface ViewStoryModalProps {
  stories: Story[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

interface StoryReply {
  id: string;
  story_id: string;
  user_id: string;
  reply_text: string;
  created_at: string;
  user: {
    username: string;
    avatar_url: string | null;
  };
}

export default function ViewStoryModal({ stories, initialIndex, isOpen, onClose }: ViewStoryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [replies, setReplies] = useState<StoryReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const { user } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && user && stories[currentIndex]) {
      // ... existing view recording logic ...
      const recordView = async () => {
        try {
          const viewRef = doc(db, 'story_views', `${user.uid}_${stories[currentIndex].id}`);
          await setDoc(viewRef, {
            story_id: stories[currentIndex].id,
            user_id: user.uid,
            viewed_at: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error recording story view:', error);
        }
      };
      recordView();

      // Fetch replies
      const repliesQuery = query(
        collection(db, 'story_replies'),
        where('story_id', '==', stories[currentIndex].id)
      );

      const unsubscribe = onSnapshot(repliesQuery, async (snapshot) => {
        const fetchedReplies: StoryReply[] = [];
        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();
          let userData = { username: 'Unknown', avatar_url: null };
          
          if (data.user_id) {
            try {
              // Try to get user data from cache or fetch it
              // For simplicity in this modal, we'll just fetch or use what's stored if we denormalize later
              // But let's fetch profile to be safe and consistent
              const userDoc = await getDoc(doc(db, 'profiles', data.user_id));
              if (userDoc.exists()) {
                userData = {
                  username: userDoc.data().username,
                  avatar_url: userDoc.data().avatar_url || null
                };
              }
            } catch (e) {
              console.error('Error fetching reply user:', e);
            }
          }

          fetchedReplies.push({
            id: docSnapshot.id,
            story_id: data.story_id,
            user_id: data.user_id,
            reply_text: data.reply_text,
            created_at: data.created_at,
            user: userData
          });
        }
        
        // Sort in memory
        fetchedReplies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        setReplies(fetchedReplies);
      });

      return () => unsubscribe();
    }
  }, [currentIndex, isOpen, user, stories]);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setProgress(0);
      setIsReplying(false);
      setReplyText('');
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (!isOpen || isPaused || isReplying) return;

    const duration = 5000; // 5 seconds per story
    const interval = 50; // Update progress every 50ms
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, isOpen, isPaused, isReplying]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
      setIsReplying(false);
      setReplyText('');
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
      setIsReplying(false);
      setReplyText('');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !user || !stories[currentIndex]) return;

    try {
      await addDoc(collection(db, 'story_replies'), {
        story_id: stories[currentIndex].id,
        user_id: user.uid,
        reply_text: replyText.trim(),
        created_at: new Date().toISOString()
      });
      setReplyText('');
      // Keep replying open or close it? Let's keep it open to see the message sent
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  if (!isOpen || !stories.length) return null;

  const currentStory = stories[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-2xl overflow-hidden bg-[#141414] flex flex-col">
        {/* Progress Bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex space-x-1 p-2 bg-gradient-to-b from-black/50 to-transparent">
          {stories.map((story, idx) => (
            <div key={story.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-50 linear"
                style={{ 
                  width: `${idx < currentIndex ? 100 : idx === currentIndex ? progress : 0}%` 
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-between px-4 pt-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden border border-white/20">
              {currentStory.profiles?.avatar_url ? (
                <img src={currentStory.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
                  {currentStory.profiles?.username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="flex flex-col drop-shadow-md">
              <span className="font-semibold text-white text-sm">{currentStory.profiles?.username || 'Unknown'}</span>
              <span className="text-xs text-white/70">
                {currentStory.created_at ? formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true }) : 'Recently'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors z-30 relative">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div 
          className={cn(
            "w-full flex-1 relative",
            !currentStory.image_url && (currentStory.background_style || "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500")
          )}
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {currentStory.image_url && (
            <img 
              src={currentStory.image_url} 
              alt="Story" 
              className="w-full h-full object-cover"
            />
          )}

          {/* Text Overlay */}
          {currentStory.text_overlay && (
            <div className="absolute inset-0 flex items-center justify-center p-8 z-10 pointer-events-none">
              <p 
                style={{ color: currentStory.text_color || '#FFFFFF' }}
                className={cn(
                  "text-center text-4xl uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] leading-none whitespace-pre-wrap",
                  currentStory.font_style || "font-black tracking-tighter"
                )}
              >
                {currentStory.text_overlay}
              </p>
            </div>
          )}

          {/* Navigation Areas */}
          <div className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer" onClick={handlePrev} />
          <div className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer" onClick={handleNext} />
          
          {/* Replies Overlay */}
          <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
             <div className="max-h-32 overflow-y-auto space-y-2 mb-4 pointer-events-auto scrollbar-hide">
               {replies.map((reply) => (
                 <div key={reply.id} className="flex items-start space-x-2 animate-in fade-in slide-in-from-bottom-2">
                   <div className="w-6 h-6 rounded-full bg-white/10 overflow-hidden flex-shrink-0 border border-white/20">
                     {reply.user.avatar_url ? (
                       <img src={reply.user.avatar_url} alt="" className="w-full h-full object-cover" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center text-[10px] text-white font-medium bg-gray-700">
                         {reply.user.username?.[0]?.toUpperCase()}
                       </div>
                     )}
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-white/90">{reply.user.username}</span>
                     <p className="text-xs text-white/80 leading-snug">{reply.reply_text}</p>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>

        {/* Reply Input */}
        <div className="p-3 bg-black border-t border-white/10 z-30">
          <form onSubmit={handleSendReply} className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={() => setIsReplying(true)}
              onBlur={() => !replyText && setIsReplying(false)}
              placeholder="Send a reply..."
              className="flex-1 bg-white/10 border-none rounded-full px-4 py-2 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-white/30"
            />
            <button 
              type="submit"
              disabled={!replyText.trim()}
              className="p-2 bg-[#C6A75E] text-black rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#b59855] transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
