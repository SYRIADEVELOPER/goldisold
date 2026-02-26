import React, { useState } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { X, Loader2, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface NewChatroomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewChatroomModal({ isOpen, onClose }: NewChatroomModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const roomData = {
        name: name.trim(),
        description: description.trim(),
        created_by: user.uid,
        created_at: new Date().toISOString(),
        is_private: isPrivate,
        participants: [user.uid],
        admins: [user.uid],
      };

      const docRef = await addDoc(collection(db, 'chatrooms'), roomData);
      
      onClose();
      navigate(`/rooms/${docRef.id}`);
    } catch (err: any) {
      console.error('Error creating chatroom:', err);
      setError(err.message || 'Failed to create chatroom');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md bg-[#141414] rounded-3xl overflow-hidden border border-white/10"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Create Room</h2>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-xl border border-red-500/20">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Room Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Hash className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. general, announcements"
                    className="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:border-[#C6A75E] transition-colors text-white"
                    required
                    maxLength={30}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this room about?"
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:border-[#C6A75E] transition-colors text-white resize-none"
                  rows={3}
                  maxLength={150}
                />
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-5 h-5 rounded border-white/10 bg-[#0a0a0a] text-[#C6A75E] focus:ring-[#C6A75E] focus:ring-offset-[#0a0a0a]"
                />
                <label htmlFor="isPrivate" className="text-sm font-medium text-gray-300">
                  Private Room (Invite only)
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-[#0a0a0a] bg-[#C6A75E] hover:bg-[#b59855] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#C6A75E] focus:ring-offset-[#0a0a0a] transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Room'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
