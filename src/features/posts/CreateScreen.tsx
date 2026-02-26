import React, { useState, useRef } from 'react';
import { db, storage } from '@/src/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../auth/store';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
// import imageCompression from 'browser-image-compression';

export default function CreateScreen() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();

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
    if (!text.trim() && !image) return;
    if (!user) return;

    setLoading(true);
    try {
      let imageUrl = null;

      if (image) {
        /*
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(image, options);
        */
        const compressedFile = image; // Temporary bypass

        const fileExt = image.name.split('.').pop() || 'jpg';
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `posts/${user.uid}/${fileName}`;

        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, compressedFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'posts'), {
        user_id: user.uid,
        text_content: text.trim() || null,
        image_url: imageUrl,
        created_at: new Date().toISOString()
      });

      navigate('/');
    } catch (error: any) {
      console.error('Error creating post:', error);
      alert(error.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-[#f5f5f5]">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
        >
          Cancel
        </button>
        <h1 className="text-lg font-semibold tracking-tight">New Post</h1>
        <button 
          onClick={handlePost}
          disabled={loading || (!text.trim() && !image)}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
            loading || (!text.trim() && !image)
              ? "bg-white/10 text-gray-500 cursor-not-allowed"
              : "bg-[#C6A75E] text-[#0a0a0a] hover:bg-[#b59855]"
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="flex space-x-4">
          <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening?"
            className="w-full bg-transparent border-none focus:ring-0 text-lg resize-none min-h-[120px] placeholder-gray-600"
            autoFocus
          />
        </div>

        {preview && (
          <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#141414]">
            <img src={preview} alt="Preview" className="w-full h-auto max-h-[400px] object-cover" />
            <button
              onClick={() => {
                setImage(null);
                setPreview(null);
              }}
              className="absolute top-3 right-3 p-1.5 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="border-t border-white/5 pt-4 flex items-center space-x-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 text-[#C6A75E] hover:text-[#b59855] transition-colors p-2 rounded-xl hover:bg-[#C6A75E]/10"
          >
            <ImageIcon className="w-6 h-6" />
            <span className="text-sm font-medium">Photo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
