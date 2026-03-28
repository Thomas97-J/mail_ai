"use client";

import { useAuthStore } from "@/lib/store";
import { LoginButton } from "@/components/login-button";
import { MailList } from "@/components/mail-list";
import { ComposeMail } from "@/components/compose-mail";
import { Header } from "@/components/header";
import { MailDetailModal } from "@/components/mail-detail-modal";
import { ShieldAlert, CheckCircle2, ShieldCheck, Mail } from "lucide-react";

export default function Home() {
  const accessToken = useAuthStore((state) => state.accessToken);

  if (!accessToken) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full flex flex-col items-center gap-10 bg-white p-14 rounded-[2.5rem] shadow-2xl shadow-blue-900/10 border border-slate-100 animate-in fade-in slide-in-from-bottom-12 duration-700">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-400 blur-3xl opacity-20 -z-10 animate-pulse" />
            <div className="p-6 bg-blue-600 rounded-3xl shadow-xl shadow-blue-200 rotate-3 group-hover:rotate-0 transition-transform duration-500">
              <ShieldCheck size={56} className="text-white fill-white/10" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-5xl font-black tracking-tighter text-slate-900">
              MAIL<span className="text-blue-600">GUARDIAN</span>
            </h1>
            <p className="text-slate-500 font-bold text-lg leading-tight">
              실수 없는 비즈니스 메일,
              <br />
              <span className="text-slate-900">
                AI 에이전트가 완벽하게 보호합니다.
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-4 w-full pt-4">
            <LoginButton />
            <div className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                Gmail API Secured & Encryption
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full border-t border-slate-50 pt-8">
            <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 transition-all hover:border-red-100 hover:bg-red-50/30 group">
              <ShieldAlert
                size={24}
                className="text-red-400 group-hover:text-red-500 transition-colors"
              />
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">
                오발송 사고 방지
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 transition-all hover:border-emerald-100 hover:bg-emerald-50/30 group">
              <CheckCircle2
                size={24}
                className="text-emerald-400 group-hover:text-emerald-500 transition-colors"
              />
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">
                실시간 문맥 분석
              </span>
            </div>
          </div>
        </div>
        <p className="mt-8 text-slate-400 text-sm font-bold">
          Powered by <span className="text-slate-600">Next.js 16</span> &{" "}
          <span className="text-slate-600">GPT-4o</span>
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Compose Area */}
        <section className="lg:col-span-7 flex flex-col gap-8 animate-in fade-in slide-in-from-left-8 duration-500">
          <ComposeMail />
        </section>

        {/* Right: Inbox Area */}
        <aside className="lg:col-span-5 flex flex-col gap-8 animate-in fade-in slide-in-from-right-8 duration-500">
          <MailList />
          <div className="relative group overflow-hidden p-6 bg-slate-900 rounded-3xl text-white shadow-2xl shadow-slate-200">
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-600 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <Mail size={24} className="text-blue-400" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-black text-blue-400 uppercase tracking-widest">
                  Security Tip
                </p>
                <p className="text-[15px] font-bold leading-snug">
                  민감한 정보를 보낼 때는
                  <br />
                  가디언의 분석 리포트를 꼭 확인하세요.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </main>
      <MailDetailModal />
    </div>
  );
}
