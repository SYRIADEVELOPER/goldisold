import React, { useEffect, useState, useRef } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, MoreVertical, Check, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/src/lib/utils';
import FileUploader from './components/FileUploader';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  image_url?: string;
  created_at: any;
  read: boolean;
}

interface Chat {
  id: string;
  participants: string[];
  typing?: { [key: string]: boolean };
  otherUser?: {
    username: string;
    avatar_url: string | null;
    isOnline?: boolean;
  };
}

export default function ChatScreen() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!id || !user) return;

    // Fetch chat details and subscribe to updates (for typing indicator)
    const chatRef = doc(db, 'chats', id);
    const unsubscribeChat = onSnapshot(chatRef, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const chatData = docSnapshot.data();
        const otherUserId = chatData.participants.find((uid: string) => uid !== user.uid);
        
        let otherUser = { username: 'Unknown', avatar_url: null, active_color: null };
        if (otherUserId) {
          try {
            const userDoc = await getDoc(doc(db, 'profiles', otherUserId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              otherUser = {
                username: userData.username,
                avatar_url: userData.avatar_url || null,
                active_color: userData.active_color || null
              };
            }
          } catch (e) {
            console.error('Error fetching other user profile:', e);
          }
        }

        setChat({
          id: docSnapshot.id,
          participants: chatData.participants,
          typing: chatData.typing,
          otherUser
        });
      } else {
        navigate('/chats'); // Chat doesn't exist
      }
      setLoading(false);
    });

    // Subscribe to messages
    const messagesQuery = query(
      collection(db, 'chats', id, 'messages')
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const fetchedMessages: Message[] = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({
          id: doc.id,
          ...doc.data()
        } as Message);
      });
      
      // Sort in memory to avoid composite index requirement
      fetchedMessages.sort((a, b) => {
        const timeA = a.created_at?.seconds || 0;
        const timeB = b.created_at?.seconds || 0;
        return timeA - timeB;
      });

      setMessages(fetchedMessages);
      scrollToBottom();
      
      // Mark messages as read
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.sender_id !== user.uid && !data.read) {
          updateDoc(doc.ref, { read: true });
        }
      });
    });

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [id, user, navigate]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent, content?: string) => {
    e.preventDefault();
    const messageContent = content || newMessage.trim();
    if (!messageContent || !user || !id) return;
    setNewMessage('');
    setIsTyping(false); // Stop typing immediately on send
    
    // Update typing status in DB
    if (chat) {
       await updateDoc(doc(db, 'chats', id), {
        [`typing.${user.uid}`]: false
      });
    }

    try {
      // Add message to subcollection
      await addDoc(collection(db, 'chats', id, 'messages'), {
        sender_id: user.uid,
        content: messageContent,
        image_url: content ? content : null,
        created_at: serverTimestamp(),
        read: false
      });

      // Update last message in chat document
      await updateDoc(doc(db, 'chats', id), {
        last_message: {
          content: messageContent,
          sender_id: user.uid,
          created_at: new Date().toISOString(),
          read: false
        },
        updated_at: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleTyping = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (!user || !id) return;

    if (!isTyping) {
      setIsTyping(true);
      await updateDoc(doc(db, 'chats', id), {
        [`typing.${user.uid}`]: true
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      setIsTyping(false);
      await updateDoc(doc(db, 'chats', id), {
        [`typing.${user.uid}`]: false
      });
    }, 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a]">
        <div className="h-16 border-b border-white/5 animate-pulse" />
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <div className="w-1/2 h-10 bg-white/10 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const otherUserId = chat?.participants.find(uid => uid !== user?.uid);
  const isOtherUserTyping = otherUserId && chat?.typing?.[otherUserId];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] fixed inset-0 sm:relative z-50 sm:z-0">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/chats')}
            className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden border border-white/5">
              {chat?.otherUser?.avatar_url ? (
                <img src={chat.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
                  {chat?.otherUser?.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-white text-sm" style={{ color: chat?.otherUser?.active_color || 'inherit' }}>{chat?.otherUser?.username}</h2>
              {isOtherUserTyping ? (
                <p className="text-xs text-[#C6A75E] animate-pulse font-medium">Typing...</p>
              ) : (
                <p className="text-xs text-gray-500">Online</p>
              )}
            </div>
          </div>
        </div>
        
        <button className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white">
          <MoreVertical className="w-5 h-5" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a0a]">
        {messages.map((message) => {
          const isOwn = message.sender_id === user?.uid;
          return (
            <div 
              key={message.id} 
              className={cn(
                "flex w-full",
                isOwn ? "justify-end" : "justify-start"
              )}
            >
              <div 
                className={cn(
                  "max-w-[75%] px-4 py-2 rounded-2xl text-sm relative group",
                  isOwn 
                    ? "bg-[#C6A75E] text-[#0a0a0a] rounded-tr-none" 
                    : "bg-white/10 text-white rounded-tl-none"
                )}
              >
                <p>{message.content}</p>
                {message.image_url && <img src={message.image_url} alt="" className="w-full h-auto mt-2 rounded-lg" />}
                <div className={cn(
                  "text-[10px] mt-1 flex items-center justify-end space-x-1",
                  isOwn ? "text-[#0a0a0a]/60" : "text-gray-400"
                )}>
                  <span>
                    {message.created_at?.seconds 
                      ? formatDistanceToNow(new Date(message.created_at.seconds * 1000), { addSuffix: true })
                      : 'Just now'}
                  </span>
                  {isOwn && (
                    message.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5 bg-[#0a0a0a]">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <FileUploader onUpload={(url) => handleSendMessage(new Event('submit'), url)} />
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder="Type a message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#C6A75E] transition-colors"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2.5 bg-[#C6A75E] text-[#0a0a0a] rounded-full hover:bg-[#b59855] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
