"use client";

import { useAuthStore } from "@/lib/store";
import { Shield, LogOut } from "lucide-react";

export function Header() {
  const { accessToken, logout } = useAuthStore();

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-2.5 group cursor-pointer">
        <div className="p-1.5 bg-blue-600 rounded-xl group-hover:rotate-12 transition-transform duration-300">
          <Shield size={24} className="text-white fill-white/20" />
        </div>
        <h1 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center">
          MAIL<span className="text-blue-600">GUARDIAN</span>
          <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded border border-slate-200 uppercase tracking-tighter">
            Alpha
          </span>
        </h1>
      </div>

      {accessToken && (
        <div className="flex items-center gap-4">
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      )}
    </header>
  );
}
