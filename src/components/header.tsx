"use client";

import { useAuthStore } from "@/lib/store";
import { useState } from "react";
import { Shield, LogOut, HelpCircle, X } from "lucide-react";

export function Header() {
  const { accessToken, logout } = useAuthStore();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2.5 group cursor-pointer min-w-0">
          <div className="p-1.5 bg-blue-600 rounded-xl group-hover:rotate-12 transition-transform duration-300 shrink-0">
            <Shield size={24} className="text-white fill-white/20" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center min-w-0">
            <span className="truncate">
              MAIL<span className="text-blue-600">GUARDIAN</span>
            </span>
            <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded border border-slate-200 uppercase tracking-tighter shrink-0">
              Alpha
            </span>
          </h1>
        </div>

        {accessToken && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all border border-slate-200 bg-white"
            >
              <HelpCircle size={16} />
              가이드
            </button>
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

      {isGuideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-100">
              <div className="flex flex-col gap-1 min-w-0">
                <h2 className="text-xl font-black tracking-tight text-slate-900">
                  프로젝트 가이드
                </h2>
                <p className="text-sm font-bold text-slate-500">
                  메일 작성부터 리마인드까지, 주요 기능 사용법을 정리했습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 grid gap-6">
              <section className="p-5 rounded-2xl border border-slate-200 bg-white">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  1) Gmail 로그인
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-slate-700 font-medium leading-relaxed">
                  <li>
                    Google로 로그인하면 Gmail 읽기/발송 권한을 통해 받은편지함
                    조회와 메일 발송이 가능합니다.
                  </li>
                  <li>
                    브라우저 팝업 차단이 켜져 있으면 인증이 실패할 수 있으니,
                    차단을 해제해 주세요.
                  </li>
                </ul>
              </section>

              <section className="p-5 rounded-2xl border border-slate-200 bg-white">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  2) 메일 가디언(발송 전 검토)
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-slate-700 font-medium leading-relaxed">
                  <li>
                    수신인/제목/본문을 작성하면 실시간으로 오발송 위험, 보안
                    리스크, 매너/톤, 첨부 누락 등을 점검합니다.
                  </li>
                  <li>
                    상태는 Green/Yellow/Red로 표시되며, 최종 전송 전에 검토
                    모달에서 상세 항목을 확인할 수 있습니다.
                  </li>
                </ul>
              </section>

              <section className="p-5 rounded-2xl border border-slate-200 bg-white">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  3) 자동 수정(본문 개선)
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-slate-700 font-medium leading-relaxed">
                  <li>
                    검토 모달에서 자동 수정 적용을 누르면, 매너/명확성 관점으로
                    본문을 개선한 버전을 반영합니다.
                  </li>
                  <li>
                    답장 작성 시 원본 인용 영역은 유지하고, 새로 작성한 본문만
                    수정합니다.
                  </li>
                </ul>
              </section>

              <section className="p-5 rounded-2xl border border-slate-200 bg-white">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  4) 답장 초안(고스트 라이터)
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-slate-700 font-medium leading-relaxed">
                  <li>
                    받은 메일에서 답장을 시작하면, 원문 내용을 기반으로 보낼 수
                    있는 답장 초안을 생성합니다.
                  </li>
                  <li>
                    “긍정/수락”, “거절/부정”, “직접 입력” 중 의도를 선택하면
                    목적에 맞는 답장 톤으로 초안이 만들어집니다.
                  </li>
                </ul>
              </section>

              <section className="p-5 rounded-2xl border border-slate-200 bg-white">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  5) Watchdog(답장 리마인드)
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-slate-700 font-medium leading-relaxed">
                  <li>
                    메일 발송 후, 워치독이 “후속 답장이 필요할 가능성”과
                    “기한”을 판단해 추적 목록에 등록할 수 있습니다.
                  </li>
                  <li>
                    앱 진입 시 추적 항목을 확인해 오늘 필요한 리마인드가 있으면
                    팝업으로 알려주고, 초안도 함께 제공합니다.
                  </li>
                  <li>
                    팝업에서 “추적 중단”, “오늘은 무시”, “복사”, “초안으로 답장
                    작성” 같은 액션을 바로 수행할 수 있습니다.
                  </li>
                </ul>
              </section>

              <section className="p-5 rounded-2xl border border-slate-200 bg-white">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  6) 알림(브라우저)
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-slate-700 font-medium leading-relaxed">
                  <li>
                    워치독이 리마인드를 생성할 때, 알림 권한이 허용된 경우
                    브라우저 알림으로도 알려줍니다.
                  </li>
                  <li>
                    권한이 꺼져 있으면 워치독 팝업 내 “알림 허용” 버튼을 눌러
                    설정할 수 있습니다.
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
