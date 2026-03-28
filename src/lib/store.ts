import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ParsedMail } from "@/utils/gmail";

interface AuthState {
  accessToken: string | null;
  selectedMail: ParsedMail | null;
  setAccessToken: (token: string | null) => void;
  setSelectedMail: (mail: ParsedMail | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      selectedMail: null,
      setAccessToken: (token) => set({ accessToken: token }),
      setSelectedMail: (mail) => set({ selectedMail: mail }),
      logout: () => set({ accessToken: null, selectedMail: null }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ accessToken: state.accessToken }), // selectedMail은 저장하지 않음
    },
  ),
);
