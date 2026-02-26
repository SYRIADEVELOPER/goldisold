import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface VoiceRecorderProps {
  onUpload: (url: string) => void;
  roomId: string;
}

export default function VoiceRecorder({ onUpload, roomId }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadVoice(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadVoice = async (blob: Blob) => {
    try {
      setIsUploading(true);
      const { storage } = await import('@/src/lib/firebase');
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      
      const storageRef = ref(storage, `voice_messages/${roomId}/${Date.now()}.webm`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      onUpload(url);
    } catch (err) {
      console.error('Error uploading voice message:', err);
      alert('Failed to upload voice message');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center">
      {isUploading ? (
        <div className="p-3 text-[#C6A75E]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isRecording ? (
        <button
          type="button"
          onClick={stopRecording}
          className="p-3 bg-red-500 text-white rounded-full animate-pulse"
        >
          <Square className="w-5 h-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
        >
          <Mic className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
