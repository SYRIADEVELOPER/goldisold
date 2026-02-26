import React, { useEffect, useState } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { Heart, MessageCircle, UserPlus, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow';
  created_at: string;
  is_read: boolean;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

export default function ActivityScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      // Query without orderBy to avoid index issues/permission errors
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('user_id', '==', user.uid),
        limit(50)
      );
      const querySnapshot = await getDocs(notificationsQuery);
      
      const fetchedNotifications: Notification[] = [];
      const batch = writeBatch(db);
      let hasUnread = false;

      for (const notifDoc of querySnapshot.docs) {
        const notifData = notifDoc.data();
        let profileData = { username: 'Unknown', avatar_url: null };
        
        if (notifData.actor_id) {
          try {
            const profileDoc = await getDoc(doc(db, 'profiles', notifData.actor_id));
            if (profileDoc.exists()) {
              profileData = {
                username: profileDoc.data().username,
                avatar_url: profileDoc.data().avatar_url || null
              };
            }
          } catch (e) {
            console.error('Error fetching profile for notification:', e);
          }
        }

        if (!notifData.is_read) {
          batch.update(notifDoc.ref, { is_read: true });
          hasUnread = true;
        }

        fetchedNotifications.push({
          id: notifDoc.id,
          type: notifData.type as 'like' | 'comment' | 'follow',
          created_at: notifData.created_at,
          is_read: notifData.is_read || false,
          profiles: profileData
        });
      }
      
      // Sort in memory since we removed orderBy from query
      fetchedNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (hasUnread) {
        try {
          await batch.commit();
        } catch (e) {
          console.error('Error marking notifications as read:', e);
        }
      }

      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-5 h-5 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-blue-500 fill-blue-500" />;
      case 'follow':
        return <UserPlus className="w-5 h-5 text-[#C6A75E]" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getMessage = (type: string, username: string) => {
    switch (type) {
      case 'like':
        return <><span className="font-semibold text-white">{username}</span> liked your post.</>;
      case 'comment':
        return <><span className="font-semibold text-white">{username}</span> commented on your post.</>;
      case 'follow':
        return <><span className="font-semibold text-white">{username}</span> started following you.</>;
      default:
        return <><span className="font-semibold text-white">{username}</span> interacted with you.</>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col space-y-4 p-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/10 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-[#f5f5f5]">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Activity</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {notifications.length > 0 ? (
          <div className="divide-y divide-white/5">
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-4 flex items-start space-x-4 hover:bg-white/5 transition-colors ${
                  !notification.is_read ? 'bg-white/[0.02]' : ''
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden border border-white/5">
                    {notification.profiles?.avatar_url ? (
                      <img src={notification.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
                        {notification.profiles?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-[#0a0a0a] rounded-full p-1 border border-[#0a0a0a]">
                    {getIcon(notification.type)}
                  </div>
                </div>
                
                <div className="flex-1 pt-1">
                  <p className="text-sm text-gray-300 leading-snug">
                    {getMessage(notification.type, notification.profiles?.username || 'Someone')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {notification.created_at ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true }) : 'Recently'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-sm">No recent activity.</p>
            <p className="text-xs mt-2">When someone likes or comments on your posts, it will show up here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
