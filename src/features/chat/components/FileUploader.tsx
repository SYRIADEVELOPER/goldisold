import React, { useState } from 'react';
import { storage } from '@/src/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Paperclip } from 'lucide-react';

interface FileUploaderProps {
  onUpload: (url: string) => void;
}

export default function FileUploader({ onUpload }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const storageRef = ref(storage, `uploads/${file.name}`);
    try {
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      onUpload(downloadURL);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label htmlFor="file-upload" className="cursor-pointer">
        <Paperclip className="w-6 h-6 text-gray-500" />
      </label>
      <input 
        id="file-upload"
        type="file" 
        className="hidden" 
        onChange={handleFileUpload} 
        disabled={uploading} 
      />
    </div>
  );
}
