'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { fetchMessages, fetchMessageDetail, parseMessage, ParsedMail } from '@/utils/gmail';
import { Loader2, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';

export function MailList() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [parsedMails, setParsedMails] = useState<ParsedMail[]>([]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['messages', accessToken],
    queryFn: ({ pageParam }) => fetchMessages(accessToken!, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (data?.pages) {
      const allMessages = data.pages.flatMap((page) => page.messages || []);
      const loadDetails = async () => {
        const details = await Promise.all(
          allMessages.map((msg: { id: string }) => fetchMessageDetail(accessToken!, msg.id))
        );
        const parsed = details.map(parseMessage);
        setParsedMails(parsed);
      };
      loadDetails();
    }
  }, [data, accessToken]);

  if (status === 'pending') {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (status === 'error') {
    return <div className="p-8 text-red-500 text-center">메일을 불러오는 중 오류가 발생했습니다.</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-white overflow-y-auto max-h-[600px]">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Mail /> 수신함
      </h2>
      <div className="divide-y">
        {parsedMails.map((mail) => (
          <div key={mail.id} className="py-3 hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="flex justify-between items-start mb-1">
              <span className="font-semibold text-sm truncate max-w-[200px]">{mail.from}</span>
              <span className="text-xs text-gray-500">{mail.date}</span>
            </div>
            <div className="font-medium text-sm mb-1">{mail.subject}</div>
            <div className="text-xs text-gray-600 line-clamp-2">{mail.snippet}</div>
          </div>
        ))}
      </div>
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="text-sm text-blue-600 py-2 hover:underline disabled:text-gray-400"
        >
          {isFetchingNextPage ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </div>
  );
}
