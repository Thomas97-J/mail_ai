"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";
import {
  fetchMessages,
  fetchMessageDetail,
  parseMessage,
  ParsedMail,
} from "@/utils/gmail";
import { Loader2, Mail, Send } from "lucide-react";
import { useEffect, useState } from "react";

export function MailList() {
  const { accessToken, setSelectedMail, currentFolder, setCurrentFolder } =
    useAuthStore();
  const [parsedMails, setParsedMails] = useState<ParsedMail[]>([]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["messages", accessToken, currentFolder],
      queryFn: ({ pageParam }) =>
        fetchMessages(accessToken!, pageParam, currentFolder),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextPageToken,
      enabled: !!accessToken,
    });

  useEffect(() => {
    if (data?.pages) {
      const allMessages = data.pages.flatMap((page) => page.messages || []);
      const loadDetails = async () => {
        const details = await Promise.all(
          allMessages.map((msg: { id: string }) =>
            fetchMessageDetail(accessToken!, msg.id),
          ),
        );
        const parsed = details.map(parseMessage);
        setParsedMails(parsed);
      };
      loadDetails();
    }
  }, [data, accessToken]);

  if (status === "pending") {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-8 text-red-500 text-center">
        메일을 불러오는 중 오류가 발생했습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 border border-slate-200 rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600">
              {currentFolder === "INBOX" ? (
                <Mail size={18} />
              ) : (
                <Send size={18} />
              )}
            </div>
            {currentFolder === "INBOX" ? "최근 수신함" : "보낸 메일함"}
          </h2>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
            Live Sync
          </span>
        </div>

        <div className="flex gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
          <button
            onClick={() => setCurrentFolder("INBOX")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
              currentFolder === "INBOX"
                ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Mail size={14} />
            수신함
          </button>
          <button
            onClick={() => setCurrentFolder("SENT")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
              currentFolder === "SENT"
                ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Send size={14} />
            보낸 메일함
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
        {parsedMails.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-3">
            <div className="p-4 bg-slate-50 rounded-full text-slate-300">
              {currentFolder === "INBOX" ? (
                <Mail size={40} strokeWidth={1} />
              ) : (
                <Send size={40} strokeWidth={1} />
              )}
            </div>
            <p className="text-slate-400 text-sm font-medium">
              {currentFolder === "INBOX"
                ? "수신된 메일이 없습니다."
                : "보낸 메일이 없습니다."}
            </p>
          </div>
        ) : (
          parsedMails.map((mail) => (
            <div
              key={mail.id}
              onClick={() => setSelectedMail(mail)}
              className="py-4 group cursor-pointer transition-all hover:bg-slate-50/80 rounded-lg px-2 -mx-2"
            >
              <div className="flex justify-between items-start mb-1.5">
                <span className="font-bold text-sm text-slate-900 truncate max-w-[180px] group-hover:text-blue-600 transition-colors">
                  {currentFolder === "INBOX"
                    ? mail.from.split("<")[0].trim() || mail.from
                    : `받는 사람: ${mail.to.split("<")[0].trim() || mail.to}`}
                </span>
                <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-sm">
                  {mail.date.split(",")[0]}
                </span>
              </div>
              <div className="font-bold text-[14px] text-slate-800 mb-1 line-clamp-1 leading-snug">
                {mail.subject || "(제목 없음)"}
              </div>
              <div className="text-[13px] text-slate-500 line-clamp-2 leading-relaxed font-medium">
                {mail.snippet}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pt-4 border-t border-slate-100">
        {hasNextPage ? (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full text-sm font-bold text-slate-600 py-2.5 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                불러오는 중...
              </>
            ) : (
              "이전 메일 더 보기"
            )}
          </button>
        ) : (
          <p className="text-center text-[11px] font-bold text-slate-300 uppercase tracking-widest py-2">
            End of list
          </p>
        )}
      </div>
    </div>
  );
}
