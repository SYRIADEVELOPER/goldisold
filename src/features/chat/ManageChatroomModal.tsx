import React, { useState } from 'react';
import { db } from '@/src/lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { X, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface ManageChatroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: {
    id: string;
    name: string;
    description: string;
    is_private: boolean;
  };
}

export default function ManageChatroomModal({ isOpen, onClose, room }: ManageChatroomModalProps) {
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description);
  const [isPrivate, setIsPrivate] = useState(room.is_private);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      await updateDoc(doc(db, 'chatrooms', room.id), {
        name: name.trim(),
        description: description.trim(),
        is_private: isPrivate,
      });
      
      onClose();
    } catch (err: any) {
      console.error('Error updating chatroom:', err);
      setError(err.message || 'Failed to update chatroom');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
      try {
        setSubmitting(true);
        await deleteDoc(doc(db, 'chatrooms', room.id));
        navigate('/chats');
      } catch (err: any) {
        console.error('Error deleting chatroom:', err);
        setError(err.message || 'Failed to delete chatroom');
        setSubmitting(false);
      }
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
              <h2 className="text-lg font-semibold text-white">Manage Room</h2>
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
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:border-[#C6A75E] transition-colors text-white"
                  required
                  maxLength={30}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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

              <div className="flex space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 border border-red-500/20 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Room</span>
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="flex-1 flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-[#0a0a0a] bg-[#C6A75E] hover:bg-[#b59855] transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
