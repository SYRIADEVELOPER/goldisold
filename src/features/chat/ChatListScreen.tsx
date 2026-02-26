import React, { useEffect, useState } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus, Search, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import NewChatModal from './NewChatModal';
import { ModerationService } from '@/src/services/moderationService';
import { cn } from '@/src/lib/utils';
import ChatroomsList from './ChatroomsList';

interface Chat {
  id: string;
  participants: string[];
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
    read: boolean;
  };
  updated_at: string;
  otherUser?: {
    username: string;
    avatar_url: string | null;
  };
}

export default function ChatListScreen() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'messages' | 'rooms'>('messages');
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      if (user) {
        const blocked = await ModerationService.getBlockedUsers(user.uid);
        setBlockedUserIds(blocked);
      }
    };
    init();
  }, [user]);

  useEffect(() => {
    if (!user || activeTab !== 'messages') return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
      // Removed orderBy to avoid index issues. We'll sort in memory.
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedChats: Chat[] = [];
      
      for (const chatDoc of snapshot.docs) {
        const chatData = chatDoc.data();
        const otherUserId = chatData.participants.find((id: string) => id !== user.uid);
        
        // Skip if other user is blocked
        if (otherUserId && blockedUserIds.includes(otherUserId)) continue;

        let otherUser = { username: 'Unknown', avatar_url: null };
        if (otherUserId) {
          try {
            const userDoc = await getDoc(doc(db, 'profiles', otherUserId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              otherUser = {
                username: userData.username,
                avatar_url: userData.avatar_url || null
              };
            }
          } catch (e) {
            console.error('Error fetching other user profile:', e);
          }
        }

        fetchedChats.push({
          id: chatDoc.id,
          participants: chatData.participants,
          last_message: chatData.last_message,
          updated_at: chatData.updated_at,
          otherUser
        });
      }
      
      // Sort by updated_at desc
      fetchedChats.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      
      setChats(fetchedChats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, blockedUserIds, activeTab]);

  return (
    <div className="flex flex-col h-full pb-20 sm:pb-0">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-white">Chats</h1>
          {activeTab === 'messages' && (
            <button 
              onClick={() => setIsNewChatModalOpen(true)}
              className="p-2 bg-[#C6A75E] text-[#0a0a0a] rounded-full hover:bg-[#b59855] transition-colors"
            >
              <MessageSquarePlus className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('messages')}
            className={cn(
              "text-sm font-medium transition-colors pb-1 border-b-2",
              activeTab === 'messages' ? "text-white border-[#C6A75E]" : "text-gray-500 border-transparent hover:text-gray-300"
            )}
          >
            Direct Messages
          </button>
          <button
            onClick={() => setActiveTab('rooms')}
            className={cn(
              "text-sm font-medium transition-colors pb-1 border-b-2",
              activeTab === 'rooms' ? "text-white border-[#C6A75E]" : "text-gray-500 border-transparent hover:text-gray-300"
            )}
          >
            Rooms
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'messages' ? (
          loading ? (
            <div className="flex flex-col space-y-4 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4 animate-pulse">
                  <div className="w-12 h-12 bg-white/10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-1/3" />
                    <div className="h-3 bg-white/10 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <MessageSquarePlus className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-lg font-medium text-gray-400">No messages yet</p>
              <p className="text-sm mt-2">Start a conversation with someone!</p>
              <button 
                onClick={() => setIsNewChatModalOpen(true)}
                className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-medium"
              >
                Start Chat
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => navigate(`/chats/${chat.id}`)}
                  className="w-full p-4 flex items-center space-x-4 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden border border-white/5">
                      {chat.otherUser?.avatar_url ? (
                        <img src={chat.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium text-lg">
                          {chat.otherUser?.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-white truncate">{chat.otherUser?.username}</h3>
                      {chat.last_message && (
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {formatDistanceToNow(new Date(chat.last_message.created_at), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    {chat.last_message ? (
                      <p className={`text-sm truncate ${
                        !chat.last_message.read && chat.last_message.sender_id !== user?.uid 
                          ? 'text-white font-medium' 
                          : 'text-gray-500'
                      }`}>
                        {chat.last_message.sender_id === user?.uid ? 'You: ' : ''}
                        {chat.last_message.content}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No messages yet</p>
                    )}
                  </div>
                  
                  {!chat.last_message?.read && chat.last_message?.sender_id !== user?.uid && (
                    <div className="w-2.5 h-2.5 bg-[#C6A75E] rounded-full flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )
        ) : (
          <ChatroomsList />
        )}
      </div>

      <NewChatModal 
        isOpen={isNewChatModalOpen} 
        onClose={() => setIsNewChatModalOpen(false)} 
      />
    </div>
  );
}
