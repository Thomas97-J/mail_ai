'use client';

import { useAuthStore } from '@/lib/store';
import { Shield, LogOut } from 'lucide-react';

export function Header() {
  const { accessToken, logout } = useAuthStore();

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <Shield size={28} className="text-blue-600 fill-blue-50" />
        <h1 className="text-2xl font-black tracking-tighter text-gray-900">
          MAIL<span className="text-blue-600">GUARDIAN</span>
        </h1>
      </div>
      
      {accessToken && (
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-md transition-all border border-transparent hover:border-red-100"
        >
          <LogOut size={16} />
          로그아웃
        </button>
      )}
    </header>
  );
}
