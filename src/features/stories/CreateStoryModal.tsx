import React, { useState, useRef } from 'react';
import { db, storage } from '@/src/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../auth/store';
import { X, Loader2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import imageCompression from 'browser-image-compression';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryAdded: () => void;
}

export default function CreateStoryModal({ isOpen, onClose, onStoryAdded }: CreateStoryModalProps) {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [textOverlay, setTextOverlay] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  if (!isOpen) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePost = async () => {
    if (!image || !user) return;

    setLoading(true);
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(image, options);

      const fileExt = image.name.split('.').pop() || 'jpg';
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `stories/${user.uid}/${fileName}`;

      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, compressedFile);
      const imageUrl = await getDownloadURL(storageRef);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await addDoc(collection(db, 'stories'), {
        user_id: user.uid,
        image_url: imageUrl,
        text_overlay: textOverlay.trim() || null,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      });

      setImage(null);
      setPreview(null);
      setTextOverlay('');
      onStoryAdded();
      onClose();
    } catch (error: any) {
      console.error('Error creating story:', error);
      alert(error.message || 'Failed to create story');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#141414] w-full max-w-md rounded-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Create Story</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!preview ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[9/16] border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#C6A75E] hover:bg-white/5 transition-all"
            >
              <ImageIcon className="w-12 h-12 text-gray-500 mb-4" />
              <p className="text-sm font-medium text-gray-400">Tap to select a photo</p>
            </div>
          ) : (
            <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-black">
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <textarea
                  value={textOverlay}
                  onChange={(e) => setTextOverlay(e.target.value)}
                  placeholder="Add text..."
                  className="w-full bg-transparent text-white text-center text-2xl font-bold placeholder-white/50 focus:outline-none resize-none drop-shadow-md"
                  rows={3}
                  maxLength={100}
                />
              </div>

              <button
                onClick={() => {
                  setImage(null);
                  setPreview(null);
                  setTextOverlay('');
                }}
                className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />
        </div>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={handlePost}
            disabled={loading || !image}
            className={cn(
              "w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2",
              loading || !image
                ? "bg-white/10 text-gray-500 cursor-not-allowed"
                : "bg-[#C6A75E] text-[#0a0a0a] hover:bg-[#b59855]"
            )}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Share Story</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
