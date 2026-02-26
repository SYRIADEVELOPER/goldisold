import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '@/src/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../auth/store';
import { ArrowLeft, Send, Hash, Users, Settings, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ManageChatroomModal from './ManageChatroomModal';

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  type: 'text' | 'image';
  image_url?: string;
  sender?: {
    username: string;
    avatar_url: string | null;
    is_online?: boolean;
  };
}

interface Chatroom {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  is_private: boolean;
  participants: string[];
  admins: string[];
}

export default function ChatroomScreen() {
  const { id } = useParams<{ id: string }>();
  const [room, setRoom] = useState<Chatroom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id || !user) return;

    const unsubscribe = onSnapshot(doc(db, 'chatrooms', id), async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as Chatroom;
        setRoom({ ...data, id: docSnapshot.id });
        
        // Auto-join if public and not a participant
        if (!data.is_private && !data.participants.includes(user.uid)) {
          await updateDoc(doc(db, 'chatrooms', id), {
            participants: arrayUnion(user.uid)
          });
        }
      } else {
        navigate('/chats');
      }
    });

    return () => unsubscribe();
  }, [id, user, navigate]);

  useEffect(() => {
    if (!id || !user) return;

    const q = query(
      collection(db, 'chatroom_messages'),
      where('room_id', '==', id),
      orderBy('created_at', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedMessages: Message[] = [];
      const userCache: Record<string, { username: string; avatar_url: string | null; is_online?: boolean }> = {};

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const senderId = data.sender_id;

        if (!userCache[senderId]) {
          try {
            const userDoc = await getDoc(doc(db, 'profiles', senderId));
            if (userDoc.exists()) {
              userCache[senderId] = {
                username: userDoc.data().username,
                avatar_url: userDoc.data().avatar_url || null,
                is_online: userDoc.data().is_online || false,
              };
            } else {
              userCache[senderId] = { username: 'Unknown', avatar_url: null, is_online: false };
            }
          } catch (e: any) {
            if (e.code !== 'unavailable') {
              console.error('Error fetching user profile:', e);
            }
            userCache[senderId] = { username: 'Unknown', avatar_url: null, is_online: false };
          }
        }

        fetchedMessages.push({
          id: docSnapshot.id,
          room_id: data.room_id,
          sender_id: data.sender_id,
          content: data.content,
          created_at: data.created_at,
          type: data.type || 'text',
          image_url: data.image_url,
          sender: userCache[senderId],
        });
      }

      setMessages(fetchedMessages);
      setLoading(false);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [id, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'chatroom_messages'), {
        room_id: id,
        sender_id: user.uid,
        content: messageContent,
        created_at: new Date().toISOString(),
        type: 'text'
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !id) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    try {
      setUploadingImage(true);
      const storageRef = ref(storage, `chatrooms/${id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'chatroom_messages'), {
        room_id: id,
        sender_id: user.uid,
        content: '',
        image_url: downloadUrl,
        created_at: new Date().toISOString(),
        type: 'image'
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await deleteDoc(doc(db, 'chatroom_messages', messageId));
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }
  };

  const isAdmin = user && room?.admins?.includes(user.uid);

  if (loading || !room) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a]">
        <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center">
          <button onClick={() => navigate('/chats')} className="p-2 mr-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <div className="h-6 bg-white/10 rounded w-1/3 animate-pulse" />
          </div>
        </header>
        <div className="flex-1 p-4 flex flex-col justify-end space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <div className={`w-2/3 h-12 rounded-2xl animate-pulse ${i % 2 === 0 ? 'bg-[#C6A75E]/20' : 'bg-white/10'}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/chats')}
            className="p-2 mr-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <Hash className="w-5 h-5 text-[#C6A75E]" />
            </div>
            <div>
              <h1 className="font-semibold text-white">{room.name}</h1>
              <p className="text-xs text-gray-500 flex items-center">
                <Users className="w-3 h-3 mr-1" />
                {room.participants?.length || 0} members
              </p>
            </div>
          </div>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsManageModalOpen(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="text-center py-8">
          <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
            <Hash className="w-10 h-10 text-[#C6A75E]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Welcome to #{room.name}!</h2>
          <p className="text-sm text-gray-400 max-w-sm mx-auto">
            {room.description || 'This is the start of the chatroom.'}
          </p>
        </div>

        {messages.map((message, index) => {
          const isOwn = message.sender_id === user?.uid;
          const showHeader = index === 0 || messages[index - 1].sender_id !== message.sender_id;

          return (
            <div key={message.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} group`}>
              {showHeader && !isOwn && (
                <div className="flex items-center space-x-2 mb-1 ml-1">
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-white/10 overflow-hidden">
                      {message.sender?.avatar_url ? (
                        <img src={message.sender.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-[10px] font-medium">
                          {message.sender?.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    {message.sender?.is_online && (
                      <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-[#0a0a0a] rounded-full" />
                    )}
                  </div>
                  <span className="text-xs font-medium text-gray-400">{message.sender?.username}</span>
                  <span className="text-[10px] text-gray-600">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </span>
                </div>
              )}
              {showHeader && isOwn && (
                <div className="flex items-center space-x-2 mb-1 mr-1">
                  <span className="text-[10px] text-gray-600">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </span>
                </div>
              )}
              
              <div className={`flex items-center space-x-2 ${isOwn ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                <div 
                  className={`max-w-[75%] ${message.type === 'image' ? 'p-1' : 'px-4 py-2.5'} rounded-2xl text-sm ${
                    isOwn 
                      ? 'bg-[#C6A75E] text-[#0a0a0a] rounded-tr-sm' 
                      : 'bg-[#1a1a1a] text-gray-200 rounded-tl-sm border border-white/5'
                  }`}
                >
                  {message.type === 'image' && message.image_url ? (
                    <img src={message.image_url} alt="Shared image" className="rounded-xl max-w-full h-auto max-h-64 object-cover" />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                </div>
                
                {(isAdmin || isOwn) && (
                  <button
                    onClick={() => handleDeleteMessage(message.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                    title="Delete message"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-[#0a0a0a] border-t border-white/5">
        <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
          </button>
          <div className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden focus-within:border-[#C6A75E] transition-colors">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message #${room.name}`}
              className="w-full max-h-32 px-4 py-3 bg-transparent text-white focus:outline-none resize-none"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-3 bg-[#C6A75E] text-[#0a0a0a] rounded-full hover:bg-[#b59855] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {isManageModalOpen && room && (
        <ManageChatroomModal
          isOpen={isManageModalOpen}
          onClose={() => setIsManageModalOpen(false)}
          room={room}
        />
      )}
    </div>
  );
}
