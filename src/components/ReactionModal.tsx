import React from 'react';

interface ReactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

const EMOJIS = ['👍', '😄', '😮', '😢', '💩'];

export default function ReactionModal({ isOpen, onClose, onSelect }: ReactionModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-[#1a1a1a] p-4 rounded-2xl flex space-x-4"
        onClick={(e) => e.stopPropagation()}
      >
        {EMOJIS.map(emoji => (
          <button 
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="text-3xl p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
