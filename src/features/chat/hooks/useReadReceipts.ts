import { useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { doc, writeBatch, arrayUnion } from 'firebase/firestore';
import { useAuthStore } from '@/src/features/auth/store';

export function useReadReceipts(roomId: string, messages: any[]) {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user || !roomId || messages.length === 0) return;

    const unreadMessages = messages.filter(m => !m.read_by?.includes(user.uid));
    if (unreadMessages.length === 0) return;

    const batch = writeBatch(db);
    unreadMessages.forEach((message) => {
      const messageRef = doc(db, 'chatroom_messages', message.id);
      batch.update(messageRef, {
        read_by: arrayUnion(user.uid)
      });
    });

    batch.commit().catch(err => console.error('Error committing read receipts batch:', err));

  }, [roomId, user, messages]);
}
