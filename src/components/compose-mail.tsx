'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { debounce } from 'lodash';
import { analyzeMail, AnalysisResult } from '@/utils/ai';
import { generateRawMime } from '@/utils/mime';
import { sendMail } from '@/utils/gmail';
import { useAuthStore } from '@/lib/store';
import { Send, AlertTriangle, CheckCircle, Info, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MailForm {
  to: string;
  cc: string;
  subject: string;
  body: string;
}

export function ComposeMail() {
  const { register, watch, handleSubmit, formState: { errors } } = useForm<MailForm>();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);

  const formData = watch();

  const debouncedAnalyze = useMemo(
    () =>
      debounce(async (data: MailForm) => {
        if (!data.to || !data.subject || !data.body) return;
        setIsAnalyzing(true);
        try {
          const result = await analyzeMail({
            to: data.to,
            cc: data.cc,
            subject: data.subject,
            body: data.body,
            hasAttachment: false, // For now, simplified
          });
          setAnalysis(result);
        } catch (err) {
          console.error(err);
        } finally {
          setIsAnalyzing(false);
        }
      }, 1000),
    []
  );

  useEffect(() => {
    debouncedAnalyze(formData);
    return () => debouncedAnalyze.cancel();
  }, [formData, debouncedAnalyze]);

  const handleSendClick = () => {
    setShowReview(true);
  };

  const onConfirmSend = async () => {
    if (!accessToken) return;
    setIsSending(true);
    try {
      const rawMime = generateRawMime({
        to: formData.to,
        cc: formData.cc,
        subject: formData.subject,
        body: formData.body,
      });
      await sendMail(accessToken, rawMime);
      alert('메일이 성공적으로 전송되었습니다!');
      setShowReview(false);
    } catch (err) {
      console.error(err);
      alert('메일 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Red': return 'text-red-600 bg-red-50 border-red-200';
      case 'Yellow': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Green': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 border rounded-lg bg-white shadow-sm">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Send size={20} className="text-blue-600" /> 메일 작성 (에이전트 가디언 활성화됨)
      </h2>

      <form className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">수신인</label>
          <input
            {...register('to', { required: true })}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="example@mail.com"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">참조</label>
          <input
            {...register('cc')}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="cc@mail.com"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">제목</label>
          <input
            {...register('subject', { required: true })}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="메일 제목을 입력하세요"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">본문</label>
          <textarea
            {...register('body', { required: true })}
            rows={8}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            placeholder="이메일 내용을 작성하세요..."
          />
        </div>

        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-2 text-sm">
            {isAnalyzing ? (
              <span className="flex items-center gap-1 text-gray-500">
                <Loader2 size={16} className="animate-spin" /> 에이전트 분석 중...
              </span>
            ) : analysis ? (
              <span className={cn("flex items-center gap-1 font-medium", getSeverityColor(analysis.severity).split(' ')[0])}>
                {analysis.severity === 'Red' && <AlertTriangle size={16} />}
                {analysis.severity === 'Yellow' && <Info size={16} />}
                {analysis.severity === 'Green' && <CheckCircle size={16} />}
                가디언 상태: {analysis.severity === 'Red' ? '위험 감지' : analysis.severity === 'Yellow' ? '검토 권장' : '전송 가능'}
              </span>
            ) : (
              <span className="text-gray-400 italic">내용을 입력하면 AI 가디언이 분석을 시작합니다.</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSendClick}
            disabled={!formData.to || !formData.subject || !formData.body || isAnalyzing}
            className="px-6 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
          >
            검토 및 전송
          </button>
        </div>
      </form>

      {/* Review Modal */}
      {showReview && analysis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
              🛡️ 메일 가디언 최종 검토
            </h3>
            
            <div className={cn("p-4 rounded-lg border mb-6", getSeverityColor(analysis.severity))}>
              <div className="flex items-center gap-2 font-bold mb-2">
                {analysis.severity === 'Red' && <AlertTriangle />}
                {analysis.severity === 'Yellow' && <Info />}
                {analysis.severity === 'Green' && <CheckCircle />}
                위험 수준: {analysis.severity}
              </div>
              
              {analysis.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-bold text-sm mb-2 underline">⚠️ 발견된 위험 요소</h4>
                  <ul className="list-disc list-inside text-sm flex flex-col gap-1">
                    {analysis.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              {analysis.improvements.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-bold text-sm mb-2 underline">✨ 문장 개선 제안</h4>
                  <ul className="list-disc list-inside text-sm flex flex-col gap-1">
                    {analysis.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
                  </ul>
                </div>
              )}

              {analysis.recommendedCCs.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-bold text-sm mb-2 underline">👥 추천 참조인</h4>
                  <ul className="list-disc list-inside text-sm flex flex-col gap-1">
                    {analysis.recommendedCCs.map((cc, i) => <li key={i}>{cc}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowReview(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                취소 후 수정
              </button>
              <button
                onClick={onConfirmSend}
                disabled={isSending}
                className="px-6 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 transition-colors shadow-lg"
              >
                {isSending && <Loader2 size={18} className="animate-spin" />}
                확인했습니다, 전송합니다
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
