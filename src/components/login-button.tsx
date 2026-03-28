"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { useAuthStore } from "@/lib/store";
import { LogIn } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function LoginButton() {
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const testAccountEmail = (process.env.NEXT_PUBLIC_TEST_ACCOUNT_EMAIL || "")
    .trim()
    .replace(/^["']|["']$/g, "");

  const sanitizeGoogleClientId = (value: string): string => {
    const v = value.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      return v.slice(1, -1).trim();
    }
    return v;
  };

  const startRedirectLogin = useCallback(() => {
    const clientId = sanitizeGoogleClientId(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    );
    if (!clientId) {
      alert("NEXT_PUBLIC_GOOGLE_CLIENT_ID가 설정되지 않았습니다.");
      return;
    }

    const redirectUri = `${window.location.origin}/`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "token");
    url.searchParams.set(
      "scope",
      "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
    );
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
    window.location.assign(url.toString());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.hash) return;

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const error = params.get("error");

    if (accessToken) {
      setAccessToken(accessToken);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    if (error) {
      const errorDescription = params.get("error_description") || "";
      window.history.replaceState(null, "", window.location.pathname);
      alert(
        `Google 로그인에 실패했습니다.\n\nerror: ${error}${errorDescription ? `\nerror_description: ${errorDescription}` : ""}`,
      );
    }
  }, [setAccessToken]);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
    },
    onError: (errorResponse) => {
      console.error("Login Failed:", errorResponse);
      const code = errorResponse?.error || "unknown_error";
      const desc = errorResponse?.error_description || "";
      alert(
        `Google 로그인에 실패했습니다.\n\nerror: ${code}${desc ? `\nerror_description: ${desc}` : ""}\n\n이 값이 'unregistered_origin' 또는 'origin_mismatch'이면 Google Cloud Console의 OAuth Client 설정에 현재 도메인을 Authorized JavaScript origins로 추가해야 합니다.`,
      );
    },
    onNonOAuthError: (nonOAuthError) => {
      console.error("Login Non-OAuth Error:", nonOAuthError);
      if (nonOAuthError.type === "popup_closed") {
        startRedirectLogin();
        return;
      }

      alert(
        `Google 로그인에 실패했습니다.\n\n${nonOAuthError.type}\n\n팝업이 차단되었거나, 브라우저 정책으로 팝업 통신이 막혔을 수 있습니다.`,
      );
    },
    scope:
      "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
  });

  return (
    <>
      <button
        onClick={() => setIsNoticeOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        <LogIn size={18} />
        Google로 로그인
      </button>

      {isNoticeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                테스트 계정 안내
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-600 leading-relaxed">
                데모 환경에서는 사전에 허가된 계정만 사용 가능합니다.
              </p>
            </div>

            <div className="p-6 grid gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="mt-2 text-sm text-slate-700 font-medium leading-relaxed">
                  {testAccountEmail ? (
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-slate-200">
                        <div className="min-w-0">
                          <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                            테스트 계정 (이메일)
                          </div>
                          <div className="mt-1 text-sm font-bold text-slate-900 truncate">
                            {testAccountEmail}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                testAccountEmail,
                              );
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="px-3 py-2 text-xs font-black text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all whitespace-nowrap"
                        >
                          복사
                        </button>
                      </div>
                      <div className="text-xs text-slate-600 font-medium leading-relaxed">
                        계정 : thomas.test.0328@gmail.com
                        <br />
                        비밀번호 : 1q2w3e4r0328
                      </div>
                    </div>
                  ) : (
                    <div>
                      계정 : thomas.test.0328@gmail.com
                      <br />
                      비밀번호 : 1q2w3e4r0328
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 pt-0 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setIsNoticeOpen(false)}
                className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all border border-slate-200 bg-white"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNoticeOpen(false);
                  login();
                }}
                className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black active:scale-95 transition-all shadow-xl shadow-slate-200"
              >
                확인했어요, 로그인 진행
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
