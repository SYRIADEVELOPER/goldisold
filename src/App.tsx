/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './features/auth/store';
import { isFirebaseConfigured } from './lib/firebase';
import AuthScreen from './features/auth/screens/AuthScreen';
import MainLayout from './app/navigation/MainLayout';
import FeedScreen from './features/feed/FeedScreen';
import SearchScreen from './features/search/SearchScreen';
import CreateScreen from './features/posts/CreateScreen';
import ActivityScreen from './features/activity/ActivityScreen';
import ProfileScreen from './features/profile/ProfileScreen';
import ChatListScreen from './features/chat/ChatListScreen';
import ChatScreen from './features/chat/ChatScreen';
import AdminReportsScreen from './features/admin/AdminReportsScreen';
import { AlertTriangle } from 'lucide-react';

export default function App() {
  const { user, isLoading, checkSession } = useAuthStore();

  useEffect(() => {
    if (isFirebaseConfigured) {
      checkSession();
    } else {
      useAuthStore.setState({ isLoading: false });
    }
  }, [checkSession]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C6A75E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      {!isFirebaseConfigured && (
        <div className="bg-red-500/10 border-b border-red-500/20 p-4 text-center text-red-500 text-sm flex items-center justify-center space-x-2 z-50 relative">
          <AlertTriangle className="w-4 h-4" />
          <span>
            Firebase is not configured.
          </span>
        </div>
      )}
      <Routes>
        {!user ? (
          <Route path="*" element={<AuthScreen />} />
        ) : (
          <Route element={<MainLayout />}>
            <Route path="/" element={<FeedScreen />} />
            <Route path="/search" element={<SearchScreen />} />
            <Route path="/create" element={<CreateScreen />} />
            <Route path="/activity" element={<ActivityScreen />} />
            <Route path="/chats" element={<ChatListScreen />} />
            <Route path="/chats/:id" element={<ChatScreen />} />
            <Route path="/admin/reports" element={<AdminReportsScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/profile/:id" element={<ProfileScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}
