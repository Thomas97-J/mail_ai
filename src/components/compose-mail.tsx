"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { debounce } from "lodash";
import {
  analyzeMailWithImprovedBody,
  AnalysisWithImprovedBody,
} from "@/utils/ai";
import { generateRawMime, MailAttachment } from "@/utils/mime";
import { sendMail } from "@/utils/gmail";
import { useAuthStore } from "@/lib/store";
import {
  Send,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  ShieldCheck,
  Shield,
  Paperclip,
  File,
  X as XIcon,
  Reply,
  Wand2,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
  const { register, watch, reset, setValue } = useForm<MailForm>();
  const [analysis, setAnalysis] = useState<AnalysisWithImprovedBody | null>(
    null,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const { accessToken, replyingToMail, setReplyingToMail } = useAuthStore();
  const lastAnalyzedRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formData = watch();

  // 답장 모드 처리
  useEffect(() => {
    if (replyingToMail) {
      const subject = replyingToMail.subject.startsWith("Re:")
        ? replyingToMail.subject
        : `Re: ${replyingToMail.subject}`;

      // 이메일 주소만 추출 (이름 제외)
      const toEmail =
        replyingToMail.from.match(/<(.+)>/)?.[1] || replyingToMail.from;

      const formattedOriginalBody = `\n\n--- Original Message ---\nFrom: ${replyingToMail.from}\nDate: ${replyingToMail.date}\nSubject: ${replyingToMail.subject}\n\n${replyingToMail.body || replyingToMail.snippet}`;

      setValue("to", toEmail);
      setValue("subject", subject);
      setValue("body", formattedOriginalBody);

      // 포커스를 본문 처음에 두기 위해 (브라우저 기본 동작 지원 시)
      // 실제로는 수동으로 커서 위치 조정이 필요할 수 있지만 일단 데이터만 세팅
    }
  }, [replyingToMail, setValue]);

  const handleCancelReply = () => {
    setReplyingToMail(null);
    reset({
      to: "",
      cc: "",
      subject: "",
      body: "",
    });
    setAnalysis(null);
    lastAnalyzedRef.current = "";
  };

  const debouncedAnalyze = useMemo(
    () =>
      debounce(async (data: MailForm, hasAttachment: boolean) => {
        const contentKey = JSON.stringify({ ...data, hasAttachment });
        if (!data.to || !data.subject || !data.body) {
          setAnalysis(null);
          lastAnalyzedRef.current = "";
          return;
        }

        // 이전 분석 내용과 동일하면 스킵
        if (contentKey === lastAnalyzedRef.current) return;

        setIsAnalyzing(true);
        try {
          const result = await analyzeMailWithImprovedBody({
            to: data.to,
            cc: data.cc,
            subject: data.subject,
            body: data.body,
            hasAttachment,
          });
          setAnalysis(result);
          lastAnalyzedRef.current = contentKey;
        } catch (err) {
          console.error(err);
        } finally {
          setIsAnalyzing(false);
        }
      }, 1000),
    [],
  );

  useEffect(() => {
    debouncedAnalyze(formData, attachments.length > 0);
    return () => debouncedAnalyze.cancel();
  }, [formData, attachments.length, debouncedAnalyze]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSendClick = () => {
    setShowReview(true);
  };

  const handleAutoFix = () => {
    if (analysis?.improvedBody) {
      setValue("body", analysis.improvedBody);
      setShowReview(false);
      alert("AI의 제안에 따라 본문이 수정되었습니다.");
    }
  };

  const onConfirmSend = async () => {
    if (!accessToken) return;
    setIsSending(true);
    try {
      const processedAttachments: MailAttachment[] = await Promise.all(
        attachments.map(async (file) => ({
          filename: file.name,
          contentType: file.type,
          data: await fileToBase64(file),
        })),
      );

      const rawMime = generateRawMime({
        to: formData.to,
        cc: formData.cc,
        subject: formData.subject,
        body: formData.body,
        attachments: processedAttachments,
      });
      await sendMail(
        accessToken,
        rawMime,
        replyingToMail ? replyingToMail.threadId : undefined,
      );
      alert("메일이 성공적으로 전송되었습니다!");
      setShowReview(false);
      reset(); // 폼 초기화
      setAnalysis(null); // 분석 결과 초기화
      setAttachments([]); // 첨부파일 초기화
      setReplyingToMail(null); // 답장 모드 초기화
      lastAnalyzedRef.current = ""; // 참조 초기화
    } catch (err) {
      console.error(err);
      alert("메일 전송 중 오류가 발생했습니다.");
    } finally {
      setIsSending(false);
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "Red":
        return "text-red-700 bg-red-50 border-red-200 ring-red-100";
      case "Yellow":
        return "text-amber-700 bg-amber-50 border-amber-200 ring-amber-100";
      case "Green":
        return "text-emerald-700 bg-emerald-50 border-emerald-200 ring-emerald-100";
      default:
        return "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8 border border-slate-200 rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            {replyingToMail ? (
              <Reply size={22} className="text-blue-600" />
            ) : (
              <Send size={22} className="text-blue-600" />
            )}
          </div>
          {replyingToMail ? "메일 답장" : "메일 작성"}
        </h2>
        <div className="flex items-center gap-3">
          {replyingToMail && (
            <button
              onClick={handleCancelReply}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-full transition-all"
            >
              답장 취소
            </button>
          )}
          <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100 flex items-center gap-1.5">
            <ShieldCheck size={14} />
            AI 가디언 활성화됨
          </div>
        </div>
      </div>

      <form className="flex flex-col gap-5">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700 ml-1">
            수신인
          </label>
          <input
            {...register("to", { required: true })}
            type="email"
            autoComplete="email"
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 text-slate-900"
            placeholder="example@mail.com"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700 ml-1">
            참조
          </label>
          <input
            {...register("cc")}
            type="email"
            autoComplete="email"
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 text-slate-900"
            placeholder="cc@mail.com"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700 ml-1">
            제목
          </label>
          <input
            {...register("subject", { required: true })}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 text-slate-900 font-medium"
            placeholder="메일 제목을 입력하세요"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700 ml-1">
            본문
          </label>
          <textarea
            {...register("body", { required: true })}
            rows={10}
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 text-slate-900 resize-none leading-relaxed"
            placeholder="이메일 내용을 자유롭게 작성하세요..."
          />
        </div>

        {/* Attachment Section */}
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">
              <Paperclip size={16} className="text-slate-400" /> 첨부파일
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100 transition-all flex items-center gap-1.5"
            >
              파일 추가
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
            />
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm group hover:border-red-200 transition-all"
                >
                  <File size={14} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-600 max-w-[150px] truncate">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="p-0.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-all"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3 text-sm min-h-[40px]">
            {isAnalyzing ? (
              <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 font-medium">
                <Loader2 size={16} className="animate-spin" />
                가디언이 내용을 분석하고 있습니다...
              </div>
            ) : analysis ? (
              <div
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full border font-bold shadow-sm transition-all",
                  getSeverityStyles(analysis.severity),
                )}
              >
                {analysis.severity === "Red" && <AlertTriangle size={18} />}
                {analysis.severity === "Yellow" && <Info size={18} />}
                {analysis.severity === "Green" && <CheckCircle size={18} />}
                상태:{" "}
                {analysis.severity === "Red"
                  ? "위험 요소 발견"
                  : analysis.severity === "Yellow"
                    ? "검토가 필요함"
                    : "전송에 문제없음"}
              </div>
            ) : (
              <span className="text-slate-400 font-medium italic">
                작성을 시작하면 AI 분석 결과가 여기에 표시됩니다.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSendClick}
            disabled={
              !formData.to || !formData.subject || !formData.body || isAnalyzing
            }
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-md shadow-blue-500/20"
          >
            검토 및 전송하기
          </button>
        </div>
      </form>

      {/* Review Modal */}
      {showReview && analysis && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-10 shadow-2xl animate-in fade-in zoom-in duration-300 border border-slate-200">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Shield size={28} className="text-blue-600" />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-slate-900">
                메일 가디언 최종 검토
              </h3>
            </div>

            <div
              className={cn(
                "p-6 rounded-xl border-2 mb-8 shadow-sm",
                getSeverityStyles(analysis.severity),
              )}
            >
              <div className="flex items-center gap-2.5 text-lg font-black mb-6">
                {analysis.severity === "Red" && <AlertTriangle size={24} />}
                {analysis.severity === "Yellow" && <Info size={24} />}
                {analysis.severity === "Green" && <CheckCircle size={24} />}
                AI 분석 리포트:{" "}
                {analysis.severity === "Red"
                  ? "위험"
                  : analysis.severity === "Yellow"
                    ? "주의"
                    : "안전"}
              </div>

              <div className="space-y-6">
                {analysis.errors.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      보안 및 오발송 위험
                    </h4>
                    <ul className="space-y-2 ml-3.5">
                      {analysis.errors.map((err, i) => (
                        <li
                          key={i}
                          className="text-slate-700 text-[15px] leading-relaxed flex gap-2"
                        >
                          <span className="text-red-400 font-bold">•</span>{" "}
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.improvements.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      문맥 및 비즈니스 매너 개선
                    </h4>
                    <ul className="space-y-2 ml-3.5">
                      {analysis.improvements.map((imp, i) => (
                        <li
                          key={i}
                          className="text-slate-700 text-[15px] leading-relaxed flex gap-2"
                        >
                          <span className="text-emerald-400 font-bold">•</span>{" "}
                          {imp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.recommendedCCs.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      추천 참조인
                    </h4>
                    <ul className="space-y-2 ml-3.5">
                      {analysis.recommendedCCs.map((cc, i) => (
                        <li
                          key={i}
                          className="text-slate-700 text-[15px] leading-relaxed flex gap-2"
                        >
                          <span className="text-blue-400 font-bold">•</span>{" "}
                          {cc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <button
                onClick={() => setShowReview(false)}
                className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all"
              >
                닫고 직접 수정
              </button>
              {analysis.improvedBody && (
                <button
                  onClick={handleAutoFix}
                  className="px-6 py-3 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl font-bold hover:bg-blue-100 flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Wand2 size={18} />
                  자동 수정 적용
                </button>
              )}
              <button
                onClick={onConfirmSend}
                disabled={isSending}
                className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black active:scale-95 disabled:bg-slate-300 flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-200"
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
