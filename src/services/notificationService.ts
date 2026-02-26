import { db } from '@/src/lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';

export type NotificationType = 'like' | 'comment' | 'follow';

export const NotificationService = {
  async sendNotification(userId: string, actorId: string, type: NotificationType, postId?: string) {
    if (userId === actorId) return; // Don't notify yourself

    try {
      await addDoc(collection(db, 'notifications'), {
        user_id: userId,
        actor_id: actorId,
        type,
        post_id: postId || null,
        is_read: false,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  },

  async removeNotification(userId: string, actorId: string, type: NotificationType, postId?: string) {
    try {
      let q = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
        where('actor_id', '==', actorId),
        where('type', '==', type)
      );

      if (postId) {
        q = query(q, where('post_id', '==', postId));
      }

      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error removing notification:', error);
    }
  }
};
