import React, { useState, useRef, useEffect } from 'react';
import { db, storage } from '@/src/lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../auth/store';
import { X, Loader2, Image as ImageIcon, Type } from 'lucide-react';
import { cn } from '@/src/lib/utils';

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
  const [isTextOnly, setIsTextOnly] = useState(false);
  const [backgroundStyle, setBackgroundStyle] = useState('bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500');
  const [fontStyle, setFontStyle] = useState('font-sans');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const backgroundOptions = [
    'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500',
    'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500',
    'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500',
    'bg-gradient-to-br from-blue-400 via-cyan-500 to-sky-500',
    'bg-gradient-to-br from-gray-900 to-black',
  ];

  const fontOptions = [
    { name: 'Modern', value: 'font-sans' },
    { name: 'Elegant', value: 'font-serif' },
    { name: 'Code', value: 'font-mono' },
    { name: 'Bold', value: 'font-black tracking-tighter' },
  ];

  const colorOptions = [
    '#FFFFFF',
    '#000000',
    '#FF6321',
    '#00FF00',
    '#4a90e2',
    '#f5a623',
    '#bd10e0',
  ];

  if (!isOpen) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... existing logic ...
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
      setIsTextOnly(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePost = async () => {
    if (!user) return;
    if (!image && !isTextOnly) return;
    if (isTextOnly && !textOverlay.trim()) {
      alert('Please enter some text for your story');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = null;

      if (image) {
        const fileExt = image.name.split('.').pop() || 'jpg';
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `stories/${user.uid}/${fileName}`;

        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, image);
        imageUrl = await getDownloadURL(storageRef);
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Check if photo moderation is mandatory
      let status = 'published';
      const configDoc = await getDoc(doc(db, 'system_config', 'moderation'));
      const mandatoryPhotoModeration = configDoc.exists() ? configDoc.data().mandatory_photo_moderation : false;

      if (imageUrl && mandatoryPhotoModeration) {
        status = 'pending_moderation';
      }

      await addDoc(collection(db, 'stories'), {
        user_id: user.uid,
        image_url: imageUrl,
        text_overlay: textOverlay.trim() || null,
        background_style: isTextOnly ? backgroundStyle : null,
        font_style: isTextOnly ? fontStyle : null,
        text_color: isTextOnly ? textColor : null,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        status: status
      });

      if (status === 'pending_moderation') {
        alert('Your story has been submitted for moderation and will be published once approved.');
      }

      setImage(null);
      setPreview(null);
      setTextOverlay('');
      setIsTextOnly(false);
      setBackgroundStyle(backgroundOptions[0]);
      setFontStyle(fontOptions[0].value);
      setTextColor('#FFFFFF');
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
          {!preview && !isTextOnly ? (
            <div className="flex flex-col space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[9/16] border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#C6A75E] hover:bg-white/5 transition-all"
              >
                <ImageIcon className="w-12 h-12 text-gray-500 mb-4" />
                <p className="text-sm font-medium text-gray-400">Tap to select a photo</p>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-gray-500 text-sm">OR</span>
              </div>
              <button
                onClick={() => setIsTextOnly(true)}
                className="w-full py-4 border-2 border-white/10 rounded-xl flex flex-col items-center justify-center hover:border-[#C6A75E] hover:bg-white/5 transition-all text-gray-400 hover:text-white"
              >
                <Type className="w-8 h-8 mb-2" />
                <span className="text-sm font-medium">Create Text Story</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col space-y-4">
              <div className={cn(
                "relative w-full aspect-[9/16] rounded-xl overflow-hidden shadow-2xl",
                isTextOnly ? backgroundStyle : "bg-black"
              )}>
                {preview && (
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                )}
                
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <textarea
                    value={textOverlay}
                    onChange={(e) => setTextOverlay(e.target.value)}
                    placeholder={isTextOnly ? "TYPE YOUR STORY..." : "WHAT'S ON YOUR MIND?"}
                    style={{ color: isTextOnly ? textColor : '#FFFFFF' }}
                    className={cn(
                      "w-full bg-transparent text-center text-4xl uppercase placeholder-white/50 focus:outline-none resize-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] leading-none",
                      isTextOnly ? fontStyle : "font-black tracking-tighter text-white"
                    )}
                    rows={6}
                    maxLength={200}
                    autoFocus={isTextOnly}
                  />
                </div>

                <button
                  onClick={() => {
                    setImage(null);
                    setPreview(null);
                    setTextOverlay('');
                    setIsTextOnly(false);
                  }}
                  className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isTextOnly && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-2 block">Background</label>
                    <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                      {backgroundOptions.map((bg, idx) => (
                        <button
                          key={idx}
                          onClick={() => setBackgroundStyle(bg)}
                          className={cn(
                            "w-10 h-10 rounded-full flex-shrink-0 border-2 transition-all",
                            bg,
                            backgroundStyle === bg ? "border-white scale-110" : "border-transparent opacity-70 hover:opacity-100"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-2 block">Font Style</label>
                    <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                      {fontOptions.map((font, idx) => (
                        <button
                          key={idx}
                          onClick={() => setFontStyle(font.value)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium border transition-all whitespace-nowrap",
                            font.value,
                            fontStyle === font.value 
                              ? "bg-white text-black border-white" 
                              : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                          )}
                        >
                          {font.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-2 block">Text Color</label>
                    <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                      {colorOptions.map((color, idx) => (
                        <button
                          key={idx}
                          onClick={() => setTextColor(color)}
                          style={{ backgroundColor: color }}
                          className={cn(
                            "w-8 h-8 rounded-full flex-shrink-0 border-2 transition-all",
                            textColor === color ? "border-white scale-110" : "border-white/10 opacity-70 hover:opacity-100"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
            disabled={loading || (!image && !isTextOnly) || (isTextOnly && !textOverlay.trim())}
            className={cn(
              "w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2",
              loading || (!image && !isTextOnly) || (isTextOnly && !textOverlay.trim())
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
