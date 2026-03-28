"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { useAuthStore } from "@/lib/store";
import { LogIn } from "lucide-react";
import { useCallback, useEffect } from "react";

export function LoginButton() {
  const setAccessToken = useAuthStore((state) => state.setAccessToken);

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
      console.log("Login Success:", tokenResponse);
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
    <button
      onClick={() => login()}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
    >
      <LogIn size={18} />
      Google로 로그인
    </button>
  );
}
