import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface VoicePlayerProps {
  url: string;
  isOwn?: boolean;
}

export default function VoicePlayer({ url, isOwn }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [url]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center space-x-3 p-2 rounded-xl ${isOwn ? 'bg-black/10' : 'bg-white/5'} min-w-[200px]`}>
      <button
        onClick={togglePlay}
        className={`p-2 rounded-full ${isOwn ? 'bg-[#0a0a0a] text-[#C6A75E]' : 'bg-[#C6A75E] text-[#0a0a0a]'} transition-transform hover:scale-105 active:scale-95`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      
      <div className="flex-1 flex flex-col space-y-1">
        <div className="h-1 bg-gray-600 rounded-full relative overflow-hidden">
          <div 
            className={`absolute inset-y-0 left-0 ${isOwn ? 'bg-[#0a0a0a]' : 'bg-[#C6A75E]'} transition-all duration-100`}
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      <Volume2 className="w-4 h-4 text-gray-500" />
    </div>
  );
}
