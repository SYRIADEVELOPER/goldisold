import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Story {
  id: string;
  image_url: string;
  text_overlay: string | null;
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

export default function ViewStoryModal({ stories, initialIndex, isOpen, onClose }: ViewStoryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setProgress(0);
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (!isOpen) return;

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
  }, [currentIndex, isOpen]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  if (!isOpen || !stories.length) return null;

  const currentStory = stories[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-2xl overflow-hidden bg-[#141414]">
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
                  {currentStory.profiles?.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-col drop-shadow-md">
              <span className="font-semibold text-white text-sm">{currentStory.profiles?.username}</span>
              <span className="text-xs text-white/70">
                {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Image */}
        <img 
          src={currentStory.image_url} 
          alt="Story" 
          className="w-full h-full object-cover"
        />

        {/* Text Overlay */}
        {currentStory.text_overlay && (
          <div className="absolute inset-0 flex items-center justify-center p-6 z-10">
            <p className="text-white text-center text-2xl font-bold drop-shadow-lg whitespace-pre-wrap">
              {currentStory.text_overlay}
            </p>
          </div>
        )}

        {/* Navigation Areas */}
        <div className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer" onClick={handlePrev} />
        <div className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer" onClick={handleNext} />
      </div>
    </div>
  );
}
