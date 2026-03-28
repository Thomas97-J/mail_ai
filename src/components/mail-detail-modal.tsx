'use client';

import { useAuthStore } from '@/lib/store';
import { X, User, Calendar, Mail, ExternalLink } from 'lucide-react';

export function MailDetailModal() {
  const { selectedMail, setSelectedMail } = useAuthStore();

  if (!selectedMail) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300 border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <Mail size={20} />
            </div>
            <h3 className="text-xl font-black tracking-tight text-slate-900 line-clamp-1">
              {selectedMail.subject || '(제목 없음)'}
            </h3>
          </div>
          <button
            onClick={() => setSelectedMail(null)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Meta Info */}
        <div className="px-8 py-6 bg-slate-50/50 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <User size={16} className="text-slate-400" />
            <span className="font-bold text-slate-900">보낸 사람:</span>
            <span className="font-medium">{selectedMail.from}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Calendar size={16} className="text-slate-400" />
            <span className="font-bold text-slate-900">날짜:</span>
            <span className="font-medium">{selectedMail.date}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="prose prose-slate max-w-none">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 font-medium">
              {selectedMail.body || selectedMail.snippet || '본문 내용이 없습니다.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-3xl">
          <button
            onClick={() => setSelectedMail(null)}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-black active:scale-95 transition-all shadow-lg shadow-slate-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
