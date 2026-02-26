import React, { useState } from 'react';
import { auth, db, isFirebaseConfigured } from '@/src/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuthStore } from '../store';
import { Loader2 } from 'lucide-react';
import { GeoService } from '@/src/services/geoService';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { checkSession } = useAuthStore();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Detect country
        const countryCode = await GeoService.getCountryCode();
        
        // Insert profile
        await setDoc(doc(db, 'profiles', user.uid), {
          username: username.toLowerCase(),
          created_at: new Date().toISOString(),
          country_code: countryCode,
          balance: 100, // Starting balance for all new users
        });
      }
      await checkSession();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[#C6A75E]">old Gold</h1>
          <p className="mt-2 text-sm text-gray-400">Minimal Text & Image Social Network</p>
        </div>

        <form onSubmit={handleAuth} className="mt-8 space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-xl border border-red-500/20">
              {error}
            </div>
          )}
          <div className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  required
                  disabled={!isFirebaseConfigured}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-[#141414] border border-white/10 rounded-xl focus:outline-none focus:border-[#C6A75E] transition-colors disabled:opacity-50"
                  placeholder="Choose a unique username"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                required
                disabled={!isFirebaseConfigured}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#141414] border border-white/10 rounded-xl focus:outline-none focus:border-[#C6A75E] transition-colors disabled:opacity-50"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
              <input
                type="password"
                required
                disabled={!isFirebaseConfigured}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#141414] border border-white/10 rounded-xl focus:outline-none focus:border-[#C6A75E] transition-colors disabled:opacity-50"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isFirebaseConfigured}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-[#0a0a0a] bg-[#C6A75E] hover:bg-[#b59855] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#C6A75E] focus:ring-offset-[#0a0a0a] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-gray-400 hover:text-[#C6A75E] transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
