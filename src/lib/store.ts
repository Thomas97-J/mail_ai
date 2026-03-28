import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ParsedMail } from "@/utils/gmail";

interface AuthState {
  accessToken: string | null;
  selectedMail: ParsedMail | null;
  currentFolder: "INBOX" | "SENT";
  setAccessToken: (token: string | null) => void;
  setSelectedMail: (mail: ParsedMail | null) => void;
  setCurrentFolder: (folder: "INBOX" | "SENT") => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      selectedMail: null,
      currentFolder: "INBOX",
      setAccessToken: (token) => set({ accessToken: token }),
      setSelectedMail: (mail) => set({ selectedMail: mail }),
      setCurrentFolder: (folder) => set({ currentFolder: folder }),
      logout: () =>
        set({ accessToken: null, selectedMail: null, currentFolder: "INBOX" }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        currentFolder: state.currentFolder,
      }), // selectedMail은 저장하지 않음
    },
  ),
);
