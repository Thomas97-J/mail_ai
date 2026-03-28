"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { useAuthStore } from "@/lib/store";
import { LogIn } from "lucide-react";

export function LoginButton() {
  const setAccessToken = useAuthStore((state) => state.setAccessToken);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      console.log("Login Success:", tokenResponse);
      setAccessToken(tokenResponse.access_token);
    },
    onError: (error) => {
      console.error("Login Failed:", error);
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
