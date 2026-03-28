import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ParsedMail } from "@/utils/gmail";
import { WatchdogTrackedMail } from "@/utils/ai";

export interface WatchdogReminder {
  threadId: string;
  dueAtMs: number;
  subject: string;
  to: string;
  from: string;
  reason: string;
  draftSubject: string;
  draftBody: string;
  createdAtMs: number;
}

export interface WatchdogComposeDraft {
  threadId: string;
  to: string;
  subject: string;
  body: string;
}

interface AuthState {
  accessToken: string | null;
  selectedMail: ParsedMail | null;
  replyingToMail: ParsedMail | null;
  currentFolder: "INBOX" | "SENT";
  watchdogTrackedMails: WatchdogTrackedMail[];
  watchdogReminders: WatchdogReminder[];
  watchdogComposeDraft: WatchdogComposeDraft | null;
  lastWatchdogRunAtMs: number | null;
  setAccessToken: (token: string | null) => void;
  setSelectedMail: (mail: ParsedMail | null) => void;
  setReplyingToMail: (mail: ParsedMail | null) => void;
  setCurrentFolder: (folder: "INBOX" | "SENT") => void;
  upsertWatchdogTrackedMail: (mail: WatchdogTrackedMail) => void;
  removeWatchdogTrackedMail: (threadId: string) => void;
  markWatchdogNotified: (threadId: string, notifiedAtMs: number) => void;
  upsertWatchdogReminder: (reminder: WatchdogReminder) => void;
  removeWatchdogReminder: (threadId: string) => void;
  clearWatchdogReminders: () => void;
  setWatchdogComposeDraft: (draft: WatchdogComposeDraft | null) => void;
  setLastWatchdogRunAtMs: (ms: number | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      selectedMail: null,
      replyingToMail: null,
      currentFolder: "INBOX",
      watchdogTrackedMails: [],
      watchdogReminders: [],
      watchdogComposeDraft: null,
      lastWatchdogRunAtMs: null,
      setAccessToken: (token) => set({ accessToken: token }),
      setSelectedMail: (mail) => set({ selectedMail: mail }),
      setReplyingToMail: (mail) => set({ replyingToMail: mail }),
      setCurrentFolder: (folder) => set({ currentFolder: folder }),
      upsertWatchdogTrackedMail: (mail) =>
        set((state) => {
          const next = state.watchdogTrackedMails.filter(
            (m) => m.threadId !== mail.threadId,
          );
          next.push(mail);
          return { watchdogTrackedMails: next };
        }),
      removeWatchdogTrackedMail: (threadId) =>
        set((state) => ({
          watchdogTrackedMails: state.watchdogTrackedMails.filter(
            (m) => m.threadId !== threadId,
          ),
        })),
      markWatchdogNotified: (threadId, notifiedAtMs) =>
        set((state) => ({
          watchdogTrackedMails: state.watchdogTrackedMails.map((m) =>
            m.threadId === threadId ? { ...m, notifiedAtMs } : m,
          ),
        })),
      upsertWatchdogReminder: (reminder) =>
        set((state) => {
          const next = state.watchdogReminders.filter(
            (r) => r.threadId !== reminder.threadId,
          );
          next.push(reminder);
          return { watchdogReminders: next };
        }),
      removeWatchdogReminder: (threadId) =>
        set((state) => ({
          watchdogReminders: state.watchdogReminders.filter(
            (r) => r.threadId !== threadId,
          ),
        })),
      clearWatchdogReminders: () => set({ watchdogReminders: [] }),
      setWatchdogComposeDraft: (draft) => set({ watchdogComposeDraft: draft }),
      setLastWatchdogRunAtMs: (ms) => set({ lastWatchdogRunAtMs: ms }),
      logout: () =>
        set({
          accessToken: null,
          selectedMail: null,
          replyingToMail: null,
          currentFolder: "INBOX",
          watchdogTrackedMails: [],
          watchdogReminders: [],
          watchdogComposeDraft: null,
          lastWatchdogRunAtMs: null,
        }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        currentFolder: state.currentFolder,
        watchdogTrackedMails: state.watchdogTrackedMails,
        lastWatchdogRunAtMs: state.lastWatchdogRunAtMs,
      }), // selectedMail, replyingToMail은 저장하지 않음
    },
  ),
);
