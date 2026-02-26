import { create } from 'zustand';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';

interface AuthState {
  user: User | null;
  profile: any | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: any | null) => void;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  signOut: async () => {
    const { user } = get();
    if (user) {
      try {
        await updateDoc(doc(db, 'profiles', user.uid), {
          is_online: false,
          last_seen: new Date().toISOString()
        });
      } catch (e) {
        console.error('Error updating presence on signout:', e);
      }
    }
    await firebaseSignOut(auth);
    set({ user: null, profile: null });
  },
  checkSession: async () => {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          set({ user });
          try {
            const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
            if (profileDoc.exists()) {
              set({ profile: { id: profileDoc.id, ...profileDoc.data() } });
              
              // Update presence
              await updateDoc(doc(db, 'profiles', user.uid), {
                is_online: true,
                last_seen: new Date().toISOString()
              });
            } else {
              set({ profile: null });
            }
          } catch (error: any) {
            if (error.code !== 'unavailable') {
              console.error('Error fetching profile:', error);
            }
          }
        } else {
          set({ user: null, profile: null });
        }
        set({ isLoading: false });
        resolve();
      });
    });
  },
}));
