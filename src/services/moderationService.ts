import { db } from '@/src/lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';

export interface Report {
  reporter_id: string;
  reported_content_id: string;
  reported_content_type: 'post' | 'comment' | 'user';
  reason: string;
  created_at: any;
  status: 'pending' | 'reviewed' | 'resolved';
}

export const ModerationService = {
  // Blocking
  async blockUser(blockerId: string, blockedId: string) {
    const blockRef = doc(db, 'blocks', `${blockerId}_${blockedId}`);
    await setDoc(blockRef, {
      blocker_id: blockerId,
      blocked_id: blockedId,
      created_at: serverTimestamp()
    });

    // Also remove follow relationships if they exist
    const followRef1 = doc(db, 'followers', `${blockerId}_${blockedId}`);
    const followRef2 = doc(db, 'followers', `${blockedId}_${blockerId}`);
    await Promise.all([
      deleteDoc(followRef1),
      deleteDoc(followRef2)
    ]);
  },

  async unblockUser(blockerId: string, blockedId: string) {
    const blockRef = doc(db, 'blocks', `${blockerId}_${blockedId}`);
    await deleteDoc(blockRef);
  },

  async isBlocked(blockerId: string, blockedId: string) {
    const blockRef = doc(db, 'blocks', `${blockerId}_${blockedId}`);
    const blockDoc = await getDoc(blockRef);
    return blockDoc.exists();
  },

  async getBlockedUsers(userId: string) {
    const q = query(collection(db, 'blocks'), where('blocker_id', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().blocked_id);
  },

  // Reporting
  async reportContent(
    reporterId: string, 
    contentId: string, 
    contentType: 'post' | 'comment' | 'user', 
    reason: string
  ) {
    await addDoc(collection(db, 'reports'), {
      reporter_id: reporterId,
      reported_content_id: contentId,
      reported_content_type: contentType,
      reason,
      created_at: serverTimestamp(),
      status: 'pending'
    });
  }
};
