'use client';

import { useAuthStore } from '@/lib/store';
import { LoginButton } from '@/components/login-button';
import { MailList } from '@/components/mail-list';
import { ComposeMail } from '@/components/compose-mail';
import { Header } from '@/components/header';
import { ShieldAlert, CheckCircle2, ShieldCheck, Mail } from 'lucide-react';

export default function Home() {
  const accessToken = useAuthStore((state) => state.accessToken);

  if (!accessToken) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full flex flex-col items-center gap-8 bg-white p-12 rounded-3xl shadow-xl border border-gray-100 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="p-4 bg-blue-100 rounded-2xl">
            <ShieldCheck size={48} className="text-blue-600" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-black tracking-tighter text-gray-900">
              MAIL<span className="text-blue-600">GUARDIAN</span>
            </h1>
            <p className="text-gray-500 font-medium">실수 없는 이메일, AI 가디언이 함께합니다.</p>
          </div>
          
          <div className="flex flex-col gap-4 w-full">
            <LoginButton />
            <p className="text-xs text-gray-400">
              Google 계정으로 로그인하여 수신함 조회 및 전송 권한을 부여하세요.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full mt-4">
            <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl">
              <ShieldAlert size={20} className="text-red-500" />
              <span className="text-[10px] font-bold text-gray-600 uppercase">오발송 방지</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl">
              <CheckCircle2 size={20} className="text-green-500" />
              <span className="text-[10px] font-bold text-gray-600 uppercase">AI 문맥 분석</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Compose Area */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <ComposeMail />
        </section>

        {/* Right: Inbox Area */}
        <aside className="lg:col-span-5 flex flex-col gap-6">
          <MailList />
          <div className="p-4 bg-blue-600 rounded-xl text-white flex items-center gap-3 shadow-lg">
            <div className="p-2 bg-white/20 rounded-lg">
              <Mail size={20} />
            </div>
            <div>
              <p className="text-xs font-medium opacity-80">보안 이메일 가이드</p>
              <p className="text-sm font-bold">민감한 정보를 보낼 때는 가디언의 조언을 따르세요.</p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
