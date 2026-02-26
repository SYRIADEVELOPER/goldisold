import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '@/src/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, arrayUnion, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../auth/store';
import { ArrowLeft, Send, Hash, Users, Settings, Trash2, Image as ImageIcon, Loader2, CheckCheck, Smile, Pin, PinOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/src/lib/utils';
import ManageChatroomModal from './ManageChatroomModal';
import ReactionModal from '@/src/components/ReactionModal';
import VoiceRecorder from './components/VoiceRecorder';
import VoicePlayer from './components/VoicePlayer';
import { useTypingIndicator } from './hooks/useTypingIndicator';
import { useReadReceipts } from './hooks/useReadReceipts';

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  type: 'text' | 'image' | 'voice' | 'system';
  image_url?: string;
  voice_url?: string;
  reactions?: { [key: string]: string[] }; // emoji -> userIds[]
  sender?: {
    username: string;
    avatar_url: string | null;
    active_color: string | null;
    is_online?: boolean;
  } | null;
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
  pinned_messages?: string[];
  banned_users?: string[];
}

export default function ChatroomScreen() {
  const { id } = useParams<{ id: string }>();
  const [room, setRoom] = useState<Chatroom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isMemberListOpen, setIsMemberListOpen] = useState(false);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilesRef = useRef<Record<string, any>>({});
  const prevParticipantsRef = useRef<string[]>([]);
  const { typingUsers, setTyping } = useTypingIndicator(id || '');
  useReadReceipts(id || '', messages);

  useEffect(() => {
    if (!id || !user) return;

    const unsubscribe = onSnapshot(doc(db, 'chatrooms', id), async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as Chatroom;
        
        // Check if user is banned
        if (data.banned_users?.includes(user.uid)) {
          navigate('/chats');
          return;
        }

        setRoom({ ...data, id: docSnapshot.id });
        
        // Bot Welcome Logic
        if (prevParticipantsRef.current.length > 0) {
          const newParticipants = data.participants.filter(p => !prevParticipantsRef.current.includes(p));
          for (const newId of newParticipants) {
            if (newId !== user.uid) { // Don't welcome yourself via bot if you just joined
              try {
                const profileDoc = await getDoc(doc(db, 'profiles', newId));
                const username = profileDoc.exists() ? profileDoc.data().username : 'Someone';
                await addDoc(collection(db, 'chatroom_messages'), {
                  room_id: id,
                  sender_id: 'system-bot',
                  content: `Welcome @${username} to the room! 👋`,
                  created_at: new Date().toISOString(),
                  type: 'system'
                });
              } catch (e) {
                console.error('Error sending welcome message:', e);
              }
            }
          }
        }
        prevParticipantsRef.current = data.participants;

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
      where('room_id', '==', id)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedMessages: Message[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      
      // Sort in memory to avoid composite index requirement
      fetchedMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      const senderIds = [...new Set(fetchedMessages.map(m => m.sender_id))].filter(sid => sid !== 'system-bot');
      const missingSenderIds = senderIds.filter(id => !profilesRef.current[id]);

      if (missingSenderIds.length > 0) {
        const newProfiles: Record<string, any> = {};
        await Promise.all(missingSenderIds.map(async (senderId) => {
          try {
            const userDoc = await getDoc(doc(db, 'profiles', senderId));
            if (userDoc.exists()) {
              newProfiles[senderId] = userDoc.data();
            } else {
              newProfiles[senderId] = { username: 'Unknown', avatar_url: null, active_color: null, is_online: false };
            }
          } catch (e) {
            console.error('Error fetching user profile:', e);
            newProfiles[senderId] = { username: 'Unknown', avatar_url: null, active_color: null, is_online: false };
          }
        }));
        profilesRef.current = { ...profilesRef.current, ...newProfiles };
        setUserProfiles({ ...profilesRef.current });
      }

      const messagesWithSenders = fetchedMessages.map(message => ({
        ...message,
        sender: message.sender_id === 'system-bot' 
          ? { username: 'System', avatar_url: null, active_color: '#C6A75E', is_online: true }
          : profilesRef.current[message.sender_id] || { username: 'Unknown', avatar_url: null, active_color: null, is_online: false }
      }));

      setMessages(messagesWithSenders);
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

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    const messageRef = doc(db, 'chatroom_messages', messageId);
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = message.reactions || {};
    const userIds = currentReactions[emoji] || [];

    let newUserIds;
    if (userIds.includes(user.uid)) {
      newUserIds = userIds.filter(id => id !== user.uid);
    } else {
      newUserIds = [...userIds, user.uid];
    }

    const updatedReactions = { ...currentReactions };
    if (newUserIds.length > 0) {
      updatedReactions[emoji] = newUserIds;
    } else {
      delete updatedReactions[emoji];
    }

    try {
      await updateDoc(messageRef, { reactions: updatedReactions });
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!isAdmin || !id) return;
    
    const isPinned = room?.pinned_messages?.includes(messageId);
    const newPinned = isPinned 
      ? room?.pinned_messages?.filter(mid => mid !== messageId)
      : [...(room?.pinned_messages || []), messageId];

    try {
      await updateDoc(doc(db, 'chatrooms', id), {
        pinned_messages: newPinned
      });
    } catch (error) {
      console.error('Error pinning message:', error);
    }
  };

  const isAdmin = user && room?.admins?.includes(user.uid);

  const resolveUserByUsername = async (username: string) => {
    const cleanUsername = username.replace('@', '');
    // Check cache first
    const cached = Object.values(profilesRef.current).find((p: any) => p.username.toLowerCase() === cleanUsername.toLowerCase());
    if (cached) {
      // Find the ID for this cached profile
      const id = Object.keys(profilesRef.current).find(key => profilesRef.current[key] === cached);
      if (id) return id;
    }
    
    // Query Firestore
    try {
      const q = query(collection(db, 'profiles'), where('username', '==', cleanUsername));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].id;
      }
    } catch (e) {
      console.error('Error resolving username:', e);
    }
    return null;
  };

  const handleCommand = async (commandStr: string) => {
    if (!user || !id || !room) return;
    
    const parts = commandStr.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    const sendSystemFeedback = async (content: string) => {
      await addDoc(collection(db, 'chatroom_messages'), {
        room_id: id,
        sender_id: 'system-bot',
        content,
        created_at: new Date().toISOString(),
        type: 'system'
      });
    };

    if (command === '/help') {
      const helpText = `Available commands:
/help - Show this message
/topic <new topic> - Change room topic (Admin only)
/kick @username - Remove user from room (Admin only)
/promote @username - Make user an admin (Admin only)
/ban @username - Ban user from room (Admin only)`;
      await sendSystemFeedback(helpText);
      return;
    }

    if (!isAdmin) {
      await sendSystemFeedback('Error: You do not have permission to use administrative commands.');
      return;
    }

    switch (command) {
      case '/topic':
        if (args.length === 0) {
          await sendSystemFeedback('Usage: /topic <new topic>');
          return;
        }
        const newTopic = args.join(' ');
        await updateDoc(doc(db, 'chatrooms', id), { description: newTopic });
        await sendSystemFeedback(`Topic changed to: ${newTopic}`);
        break;

      case '/kick':
        if (args.length === 0) {
          await sendSystemFeedback('Usage: /kick @username');
          return;
        }
        const kickTargetId = await resolveUserByUsername(args[0]);
        if (!kickTargetId) {
          await sendSystemFeedback(`Error: Could not find user ${args[0]}`);
          return;
        }
        if (room.admins.includes(kickTargetId)) {
          await sendSystemFeedback('Error: Cannot kick an administrator.');
          return;
        }
        await updateDoc(doc(db, 'chatrooms', id), {
          participants: room.participants.filter(p => p !== kickTargetId)
        });
        await sendSystemFeedback(`User ${args[0]} has been kicked from the room.`);
        break;

      case '/promote':
        if (args.length === 0) {
          await sendSystemFeedback('Usage: /promote @username');
          return;
        }
        const promoteTargetId = await resolveUserByUsername(args[0]);
        if (!promoteTargetId) {
          await sendSystemFeedback(`Error: Could not find user ${args[0]}`);
          return;
        }
        await updateDoc(doc(db, 'chatrooms', id), {
          admins: arrayUnion(promoteTargetId)
        });
        await sendSystemFeedback(`User ${args[0]} has been promoted to administrator.`);
        break;

      case '/ban':
        if (args.length === 0) {
          await sendSystemFeedback('Usage: /ban @username');
          return;
        }
        const banTargetId = await resolveUserByUsername(args[0]);
        if (!banTargetId) {
          await sendSystemFeedback(`Error: Could not find user ${args[0]}`);
          return;
        }
        if (room.admins.includes(banTargetId)) {
          await sendSystemFeedback('Error: Cannot ban an administrator.');
          return;
        }
        // Add to banned_users list (need to ensure this field exists in schema or just use it)
        await updateDoc(doc(db, 'chatrooms', id), {
          participants: room.participants.filter(p => p !== banTargetId),
          banned_users: arrayUnion(banTargetId)
        });
        await sendSystemFeedback(`User ${args[0]} has been banned from the room.`);
        break;

      default:
        await sendSystemFeedback(`Unknown command: ${command}. Type /help for a list of commands.`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent, voiceUrl?: string) => {
    if (e) e.preventDefault();
    if (!user || !id) return;

    const messageContent = voiceUrl ? '' : newMessage.trim();
    if (!voiceUrl && !messageContent) return;

    if (!voiceUrl) setNewMessage('');

    if (messageContent.startsWith('/')) {
      await handleCommand(messageContent);
      return;
    }

    try {
      await addDoc(collection(db, 'chatroom_messages'), {
        room_id: id,
        sender_id: user.uid,
        content: messageContent,
        created_at: new Date().toISOString(),
        type: voiceUrl ? 'voice' : 'text',
        voice_url: voiceUrl || null
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

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
        <button 
          onClick={() => setIsMemberListOpen(!isMemberListOpen)}
          className={`p-2 transition-colors rounded-full hover:bg-white/5 ${isMemberListOpen ? 'text-[#C6A75E]' : 'text-gray-400 hover:text-white'}`}
        >
          <Users className="w-5 h-5" />
        </button>
      </header>

      {room.pinned_messages && room.pinned_messages.length > 0 && (
        <div className="bg-[#1a1a1a] border-b border-white/5 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2 overflow-hidden">
            <Pin className="w-3 h-3 text-[#C6A75E] flex-shrink-0" />
            <span className="text-xs text-gray-400 truncate">
              {messages.find(m => m.id === room.pinned_messages![room.pinned_messages!.length - 1])?.content || 'Pinned message'}
            </span>
          </div>
          <button className="text-[10px] text-[#C6A75E] font-medium hover:underline flex-shrink-0 ml-2">
            View All ({room.pinned_messages.length})
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
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
          const isSystem = message.type === 'system';
          const showHeader = !isSystem && (index === 0 || messages[index - 1].sender_id !== message.sender_id);

          if (isSystem) {
            return (
              <div key={message.id} className="flex justify-center py-2">
                <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
                  <p className="text-[11px] text-[#C6A75E] font-medium text-center">
                    {message.content}
                  </p>
                </div>
              </div>
            );
          }

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
                          {message.sender?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    {message.sender?.is_online && (
                      <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-[#0a0a0a] rounded-full" />
                    )}
                  </div>
                  <span className="text-xs font-medium text-gray-400" style={{ color: message.sender?.active_color || 'inherit' }}>{message.sender?.username}</span>
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
                  ) : message.type === 'voice' && message.voice_url ? (
                    <VoicePlayer url={message.voice_url} isOwn={isOwn} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                  
                  {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(message.reactions).map(([emoji, userIds]) => {
                        const ids = userIds as string[];
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(message.id, emoji)}
                            className={cn(
                              "flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] transition-colors",
                              ids.includes(user?.uid || '')
                                ? "bg-white/20 text-white"
                                : "bg-white/5 text-gray-400 hover:bg-white/10"
                            )}
                          >
                            <span>{emoji}</span>
                            <span>{ids.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setActiveReactionMessageId(message.id)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
                    title="React"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handlePinMessage(message.id)}
                      className={`p-1.5 hover:bg-white/5 rounded-full transition-all ${room.pinned_messages?.includes(message.id) ? 'text-[#C6A75E]' : 'text-gray-500 hover:text-white'}`}
                      title={room.pinned_messages?.includes(message.id) ? "Unpin" : "Pin"}
                    >
                      {room.pinned_messages?.includes(message.id) ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                  )}
                  {(isAdmin || isOwn) && (
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {isOwn && message.read_by && message.read_by.length > 1 && (
                <div className="text-xs text-gray-500 mt-1 pr-2 flex items-center self-end">
                  <CheckCheck className="w-3 h-3 mr-1 text-blue-400" />
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        {typingUsers.length > 0 && (
          <div className="text-sm text-gray-500">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
      </div>

      <div className="p-4 bg-[#0a0a0a] border-t border-white/5">
        <form onSubmit={(e) => handleSendMessage(e)} className="flex items-end space-x-2">
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
          
          <VoiceRecorder 
            roomId={id || ''} 
            onUpload={(url) => handleSendMessage(null as any, url)} 
          />

          <div className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden focus-within:border-[#C6A75E] transition-colors">
            <textarea
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                setTyping(e.target.value.length > 0);
              }}
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
    </div>

    {isMemberListOpen && (
      <div className="w-64 border-l border-white/5 bg-[#0a0a0a] overflow-y-auto hidden md:block">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Members — {room.participants?.length || 0}</h3>
        </div>
        <div className="p-2 space-y-1">
          {room.participants?.map(userId => {
            const profile = userProfiles[userId];
            return (
              <div key={userId} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 transition-colors group">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-medium">
                        {profile?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  {profile?.is_online && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#0a0a0a] rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-300 truncate" style={{ color: profile?.active_color || 'inherit' }}>
                    {profile?.username || 'Loading...'}
                  </p>
                  {room.admins?.includes(userId) && (
                    <span className="text-[10px] text-[#C6A75E] font-semibold uppercase tracking-tighter">Admin</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>

      {isManageModalOpen && room && (
        <ManageChatroomModal
          isOpen={isManageModalOpen}
          onClose={() => setIsManageModalOpen(false)}
          room={room}
        />
      )}

      <ReactionModal
        isOpen={!!activeReactionMessageId}
        onClose={() => setActiveReactionMessageId(null)}
        onSelect={(emoji) => {
          if (activeReactionMessageId) {
            handleReaction(activeReactionMessageId, emoji);
          }
          setActiveReactionMessageId(null);
        }}
      />
    </div>
  );
}
