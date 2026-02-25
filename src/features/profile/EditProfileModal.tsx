import React, { useState } from 'react';
import { db, storage } from '@/src/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../auth/store';
import { X, Loader2, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import imageCompression from 'browser-image-compression';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBio: string | null;
  currentAvatarUrl: string | null;
  onProfileUpdated: () => void;
}

export default function EditProfileModal({ isOpen, onClose, currentBio, currentAvatarUrl, onProfileUpdated }: EditProfileModalProps) {
  const { user } = useAuthStore();
  const [bio, setBio] = useState(currentBio || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentAvatarUrl);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      });
      setAvatarFile(compressedFile);
      setAvatarPreview(URL.createObjectURL(compressedFile));
    } catch (err) {
      console.error('Error compressing image:', err);
      setError('Failed to process image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSubmitting(true);
      setError(null);

      let newAvatarUrl = currentAvatarUrl;

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.uid}-${Math.random()}.${fileExt}`;
        const storageRef = ref(storage, `avatars/${fileName}`);

        await uploadBytes(storageRef, avatarFile);
        newAvatarUrl = await getDownloadURL(storageRef);
      }

      await updateDoc(doc(db, 'profiles', user.uid), {
        bio: bio.trim(),
        avatar_url: newAvatarUrl,
      });

      onProfileUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
            <h2 className="text-lg font-semibold text-white">Edit Profile</h2>
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

            <div className="flex flex-col items-center space-y-4">
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-white/10 overflow-hidden border border-white/5">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <Camera className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <p className="text-xs text-gray-400">Tap to change avatar</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:border-[#C6A75E] transition-colors text-white resize-none"
                rows={4}
                maxLength={150}
              />
              <div className="text-right mt-1">
                <span className="text-xs text-gray-500">{bio.length}/150</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-[#0a0a0a] bg-[#C6A75E] hover:bg-[#b59855] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#C6A75E] focus:ring-offset-[#0a0a0a] transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
