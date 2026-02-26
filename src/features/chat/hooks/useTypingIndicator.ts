import { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuthStore } from '@/src/features/auth/store';

export function useTypingIndicator(roomId: string) {
  const { user } = useAuthStore();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!roomId) return;

    const typingRef = collection(db, 'typing_users', roomId, 'users');
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.id);
      setTypingUsers(users.filter(id => id !== user?.uid));
    });

    return () => unsubscribe();
  }, [roomId, user?.uid]);

  const setTyping = async (isTyping: boolean) => {
    if (!user || !roomId) return;

    const userTypingRef = doc(db, 'typing_users', roomId, 'users', user.uid);

    if (isTyping) {
      await setDoc(userTypingRef, { timestamp: serverTimestamp() });
    } else {
      await deleteDoc(userTypingRef);
    }
  };

  return { typingUsers, setTyping };
}
