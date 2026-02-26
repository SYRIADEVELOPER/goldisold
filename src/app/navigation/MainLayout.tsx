import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Search, PlusSquare, Activity, User, MessageCircle, Shield } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuthStore } from '@/src/features/auth/store';

export default function MainLayout() {
  const { user } = useAuthStore();
  const isAdmin = user?.email === 'kiatrbe3a@gmail.com';

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: PlusSquare, label: 'Create', path: '/create' },
    { icon: Activity, label: 'Activity', path: '/activity' },
    { icon: MessageCircle, label: 'Messages', path: '/chats' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  if (isAdmin) {
    navItems.splice(5, 0, { icon: Shield, label: 'Admin', path: '/admin/reports' });
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-[#f5f5f5] font-sans">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-16 sm:pb-0 sm:ml-64">
        <div className="max-w-2xl mx-auto w-full h-full">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/10 flex items-center justify-around sm:hidden z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-[#C6A75E]" : "text-gray-500 hover:text-gray-300"
              )
            }
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Navigation (Desktop) */}
      <nav className="hidden sm:flex flex-col fixed top-0 left-0 bottom-0 w-64 bg-[#0a0a0a] border-r border-white/10 p-6 z-50">
        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight text-[#C6A75E]">old Gold</h1>
        </div>
        <div className="flex flex-col space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center space-x-4 px-4 py-3 rounded-xl transition-all",
                  isActive 
                    ? "bg-white/5 text-[#C6A75E] font-semibold" 
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                )
              }
            >
              <item.icon className="w-6 h-6" />
              <span className="text-lg">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
