import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export interface AnalysisResult {
  errors: string[];
  improvements: string[];
  recommendedCCs: string[];
  severity: "Red" | "Yellow" | "Green";
}

type Severity = AnalysisResult["severity"];

const severityRank: Record<Severity, number> = {
  Red: 3,
  Yellow: 2,
  Green: 1,
};

const maxSeverity = (a: Severity, b: Severity): Severity =>
  severityRank[a] >= severityRank[b] ? a : b;

const uniqClean = (items: unknown[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item !== "string") continue;
    const v = item.trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const emailRegex =
  /(?:^|[\s<("'])((?:[a-z0-9._%+-]+)@(?:[a-z0-9.-]+)\.[a-z]{2,})(?:$|[\s>)"'.;,])/gi;

const extractEmails = (text: string): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const lower = text.toLowerCase();
  while ((m = emailRegex.exec(lower)) !== null) {
    const v = m[1];
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
};

const normalizeSeverity = (value: unknown): Severity => {
  if (value === "Red" || value === "Yellow" || value === "Green") return value;
  if (typeof value !== "string") return "Green";
  const v = value.toLowerCase();
  if (
    v.includes("red") ||
    v.includes("위험") ||
    v.includes("차단") ||
    v.includes("high")
  )
    return "Red";
  if (
    v.includes("yellow") ||
    v.includes("주의") ||
    v.includes("검토") ||
    v.includes("medium")
  )
    return "Yellow";
  return "Green";
};

const normalizeAnalysis = (value: unknown): AnalysisResult => {
  const obj =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const errors = uniqClean(Array.isArray(obj.errors) ? obj.errors : []);
  const improvements = uniqClean(
    Array.isArray(obj.improvements) ? obj.improvements : [],
  );
  const recommendedCCs = uniqClean(
    Array.isArray(obj.recommendedCCs) ? obj.recommendedCCs : [],
  );
  const severity = normalizeSeverity(obj.severity);
  return { errors, improvements, recommendedCCs, severity };
};

const attachmentKeywords = [
  "첨부",
  "첨부파일",
  "동봉",
  "붙임",
  "파일",
  "pdf",
  "zip",
  "png",
  "jpg",
  "jpeg",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "attach",
  "attachment",
  "attached",
  "enclosed",
];

const localAnalyze = (data: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  hasAttachment: boolean;
}): AnalysisResult => {
  const errors: string[] = [];
  const improvements: string[] = [];
  const recommendedCCs: string[] = [];
  let severity: Severity = "Green";

  const toEmails = extractEmails(data.to);
  if (toEmails.length === 0) {
    errors.push("수신인(To) 이메일 형식을 확인해 주세요.");
    severity = maxSeverity(severity, "Red");
  }

  const subject = data.subject.trim();
  if (subject.length < 3) {
    improvements.push(
      "제목을 조금 더 구체적으로 작성해 주세요. (예: [요청] 견적 확인 / [공유] 회의록)",
    );
    severity = maxSeverity(severity, "Yellow");
  }

  const body = data.body.trim();
  if (body.length < 30) {
    improvements.push(
      "본문이 너무 짧습니다. 요청/배경/기한/다음 액션을 한 문장씩 추가해 주세요.",
    );
    severity = maxSeverity(severity, "Yellow");
  }

  const lowerBody = body.toLowerCase();
  const mentionedAttachment = attachmentKeywords.some((k) =>
    lowerBody.includes(k),
  );
  if (mentionedAttachment && !data.hasAttachment) {
    errors.push("본문에 첨부 언급이 있는데 첨부파일이 없습니다.");
    severity = maxSeverity(severity, "Red");
  }

  if (data.hasAttachment && !mentionedAttachment) {
    improvements.push(
      "첨부파일이 있다면 본문에 첨부 설명(무엇/왜/버전)을 한 줄 추가하면 좋습니다.",
    );
    severity = maxSeverity(severity, "Yellow");
  }

  const piiSignals: Array<{ re: RegExp; msg: string; sev: Severity }> = [
    {
      re: /\b\d{6}-?\d{7}\b/,
      msg: "주민등록번호 형태가 감지되었습니다. 발송 전 마스킹을 권장합니다.",
      sev: "Red",
    },
    {
      re: /\b(?:\d[ -]*?){13,16}\b/,
      msg: "카드번호로 보일 수 있는 숫자열이 감지되었습니다. 발송 전 확인/마스킹을 권장합니다.",
      sev: "Yellow",
    },
    {
      re: /(비밀번호|password|otp|인증번호|2fa|one[- ]time)/i,
      msg: "비밀번호/인증정보로 해석될 수 있는 표현이 감지되었습니다. 공유 여부를 재확인해 주세요.",
      sev: "Red",
    },
    {
      re: /(계좌|account|routing|swift|iban)/i,
      msg: "계좌/송금 관련 정보가 포함되어 있을 수 있습니다. 수신인/도메인을 재확인해 주세요.",
      sev: "Yellow",
    },
  ];
  for (const s of piiSignals) {
    if (s.re.test(body)) {
      errors.push(s.msg);
      severity = maxSeverity(severity, s.sev);
    }
  }

  const rudeSignals: Array<{ re: RegExp; suggestion: string }> = [
    {
      re: /(빨리|당장|즉시|ASAP|urgent)/i,
      suggestion: "긴급함을 표현할 때는 “가능한 일정”을 함께 제시해 주세요.",
    },
    {
      re: /(왜 아직|이게 말이|당연히)/i,
      suggestion:
        "상대의 책임을 단정하는 표현은 완곡하게 바꾸는 것을 권장합니다.",
    },
  ];
  for (const s of rudeSignals) {
    if (s.re.test(body)) {
      improvements.push(s.suggestion);
      severity = maxSeverity(severity, "Yellow");
    }
  }

  return {
    errors: uniqClean(errors),
    improvements: uniqClean(improvements),
    recommendedCCs,
    severity,
  };
};

const cache = new Map<string, { at: number; result: AnalysisResult }>();
const inflight = new Map<string, Promise<AnalysisResult>>();
const CACHE_TTL_MS = 30_000;

export const analyzeMail = async (data: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  hasAttachment: boolean;
}): Promise<AnalysisResult> => {
  const local = localAnalyze(data);
  const key = JSON.stringify({
    to: data.to,
    cc: data.cc ?? "",
    subject: data.subject,
    body: data.body,
    hasAttachment: data.hasAttachment,
  });

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

  const existing = inflight.get(key);
  if (existing) return existing;

  const run = (async (): Promise<AnalysisResult> => {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      const result: AnalysisResult = {
        ...local,
        errors: uniqClean([...local.errors, "API 키가 설정되지 않았습니다."]),
        severity: maxSeverity(local.severity, "Yellow"),
      };
      cache.set(key, { at: Date.now(), result });
      return result;
    }

    const model = process.env.NEXT_PUBLIC_OPENAI_MODEL || "gpt-5.4-nano";

    const system = [
      "당신은 이메일 보안 및 비즈니스 매너 전문가인 '메일 가디언'입니다.",
      "목표: 발송 전 실수/보안/업무 품질 리스크를 빠르게 잡아냅니다.",
      "반드시 아래 JSON 형식만 출력합니다. 설명/마크다운/추가 필드는 금지합니다.",
      "recommendedCCs는 이메일 주소만 허용합니다. 본문/수신인/참조에 실제로 등장한 주소만 포함합니다. 추측 금지.",
      "severity는 Red|Yellow|Green 중 하나만 사용합니다.",
      "severity 기준:",
      "- Red: 발송 전 수정/확인 없이는 위험(매너/보안/오해 가능성이 큼).",
      "- Yellow: 검토/개선 권장(큰 문제는 아니지만 인상/협업 품질을 해칠 수 있음).",
      "- Green: 큰 이슈 없음.",
      "매너/톤(비즈니스 이메일 etiquette) 규칙을 최우선으로 평가합니다.",
      "매너 관련 Red 판정 예시(하나라도 해당하면 Red로 올립니다):",
      "- 욕설/비하/모욕/혐오 표현, 인신공격, 협박/압박(“안 하면 불이익”, “책임질 거죠?” 등), 조롱/비꼼이 명확한 표현",
      "- 과도한 공격/분노 표출(연속 느낌표/물음표, 전부 대문자, “말이 됩니까” 류의 강한 단정이 반복)",
      "매너 관련 Yellow 판정 예시(해당하면 Yellow로 올립니다):",
      "- 명령조/독촉(“빨리/당장/즉시/ASAP”), 상대 탓 단정(“왜 아직/당연히/이게 말이”), 과도한 책임 전가",
      "- 요구사항/기한/다음 액션이 불명확해서 오해가 생길 수 있는 문장",
      "- 지나치게 캐주얼/친한 톤이 업무 맥락에 부적절한 경우(상황에 따라)",
      "개선 제안은 “바꿀 문장 → 권장 문장” 형태로 구체적으로 제시합니다(문자열 1개에 포함해도 됨).",
      "검토 항목: 첨부 누락, 민감정보/인증정보, 수신인 부적절/형식 오류, 요청사항 불명확(기한/액션), 매너/톤 리스크, 제목/본문 품질.",
    ].join("\n");

    const user = [
      "[이메일 정보]",
      `수신인(To): ${data.to}`,
      `참조(Cc): ${data.cc || "없음"}`,
      `제목: ${data.subject}`,
      `본문: ${data.body}`,
      `첨부파일 유무: ${data.hasAttachment ? "있음" : "없음"}`,
      "",
      "[출력 JSON 스키마]",
      "{",
      '  "errors": string[],',
      '  "improvements": string[],',
      '  "recommendedCCs": string[],',
      '  "severity": "Red" | "Yellow" | "Green"',
      "}",
    ].join("\n");

    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content ?? "";
      const parsed = safeJsonParse(content);
      const llm = normalizeAnalysis(parsed);

      const allowedCc = new Set(
        extractEmails(
          `${data.to} ${data.cc ?? ""} ${data.subject} ${data.body}`,
        ),
      );
      const filteredRecommended = llm.recommendedCCs
        .map((v) => v.toLowerCase().trim())
        .filter((v) => allowedCc.has(v));

      const merged: AnalysisResult = {
        errors: uniqClean([...local.errors, ...llm.errors]),
        improvements: uniqClean([...local.improvements, ...llm.improvements]),
        recommendedCCs: uniqClean(filteredRecommended),
        severity: maxSeverity(local.severity, llm.severity),
      };

      cache.set(key, { at: Date.now(), result: merged });
      return merged;
    } catch (error) {
      console.error("AI Analysis failed:", error);
      const result: AnalysisResult = {
        ...local,
        errors: uniqClean([...local.errors, "AI 분석 중 오류가 발생했습니다."]),
        severity: maxSeverity(local.severity, "Yellow"),
      };
      cache.set(key, { at: Date.now(), result });
      return result;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, run);
  return run;
};

export interface AnalysisWithImprovedBody extends AnalysisResult {
  improvedBody: string;
  improvedTitle: string;
}

type RewriteResult = { improvedBody: string; improvedTitle: string };

const normalizeRewrite = (
  value: unknown,
  fallbackBody: string,
  fallbackTitle: string,
): RewriteResult => {
  const obj =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const improvedBody =
    typeof obj.improvedBody === "string" && obj.improvedBody.trim()
      ? obj.improvedBody
      : fallbackBody;

  const titleCandidate =
    (typeof obj.improvedTitle === "string" && obj.improvedTitle.trim()
      ? obj.improvedTitle
      : undefined) ??
    (typeof obj.improvedtitle === "string" && obj.improvedtitle.trim()
      ? obj.improvedtitle
      : undefined) ??
    fallbackTitle;

  const improvedTitle = titleCandidate.trim() || fallbackTitle;
  return { improvedBody, improvedTitle };
};

const rewriteCache = new Map<string, { at: number; result: RewriteResult }>();
const rewriteInflight = new Map<string, Promise<RewriteResult>>();
const REWRITE_CACHE_TTL_MS = 30_000;

export const analyzeMailWithImprovedBody = async (data: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  hasAttachment: boolean;
}): Promise<AnalysisWithImprovedBody> => {
  const analysis = await analyzeMail(data);
  const fallbackTitle = data.subject;

  const rewriteKey = JSON.stringify({
    to: data.to,
    cc: data.cc ?? '',
    subject: data.subject,
    body: data.body,
  });

  const cached = rewriteCache.get(rewriteKey);
  if (cached && Date.now() - cached.at < REWRITE_CACHE_TTL_MS) {
    return {
      ...analysis,
      improvedBody: cached.result.improvedBody,
      improvedTitle: cached.result.improvedTitle,
    };
  }

  const existing = rewriteInflight.get(rewriteKey);
  if (existing) {
    const rewrite = await existing;
    return {
      ...analysis,
      improvedBody: rewrite.improvedBody,
      improvedTitle: rewrite.improvedTitle,
    };
  }

  const run = (async (): Promise<RewriteResult> => {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      const result: RewriteResult = {
        improvedBody: data.body,
        improvedTitle: fallbackTitle,
      };
      rewriteCache.set(rewriteKey, { at: Date.now(), result });
      return result;
    }

    const model = process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-5.4-nano';

    const system = [
      "당신은 비즈니스 이메일 에디터입니다. 사용자의 본문을 '매너/명확성/협업 효율' 관점에서 개선합니다.",
      '절대 새로운 사실을 추가하지 말고, 의미/수치/고유명사/일정은 보존합니다.',
      '언어는 원문의 톤/언어(한국어/영어)를 유지합니다.',
      '명령조/압박/책임 전가/무례한 표현은 완곡하고 전문적인 표현으로 바꿉니다.',
      '가능하면 다음을 보강합니다: 목적, 요청사항, 기한/다음 액션, 감사/마무리 문장.',
      '제목(improvedTitle)은 짧고 구체적으로(가능하면 60자 이내), 원문의 의미를 보존하며 개선합니다.',
      '반드시 아래 JSON 형식만 출력합니다. 다른 텍스트는 금지합니다.',
    ].join('\n');

    const user = [
      '[컨텍스트]',
      `수신인(To): ${data.to}`,
      `참조(Cc): ${data.cc || '없음'}`,
      `제목: ${data.subject}`,
      `첨부파일 유무: ${data.hasAttachment ? '있음' : '없음'}`,
      '',
      '[원문 본문]',
      data.body,
      '',
      '[출력 JSON 스키마]',
      '{ "improvedTitle": string, "improvedBody": string }',
    ].join('\n');

    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content ?? '';
      const parsed = safeJsonParse(content);
      const normalized = normalizeRewrite(parsed, data.body, fallbackTitle);
      rewriteCache.set(rewriteKey, { at: Date.now(), result: normalized });
      return normalized;
    } catch (error) {
      console.error('AI Rewrite failed:', error);
      const result: RewriteResult = {
        improvedBody: data.body,
        improvedTitle: fallbackTitle,
      };
      rewriteCache.set(rewriteKey, { at: Date.now(), result });
      return result;
    } finally {
      rewriteInflight.delete(rewriteKey);
    }
  })();

  rewriteInflight.set(rewriteKey, run);
  const rewrite = await run;
  return {
    ...analysis,
    improvedBody: rewrite.improvedBody,
    improvedTitle: rewrite.improvedTitle,
  };
};

export interface GhostWriterDraft {
  draftSubject: string;
  draftBody: string;
}

export interface GhostWriterInput {
  originalFrom: string;
  originalTo?: string;
  originalCc?: string;
  originalSubject: string;
  originalBody: string;
  myContext?: string;
  intent?: string;
}

const normalizeGhostDraft = (
  value: unknown,
  fallbackSubject: string,
  fallbackBody: string,
): GhostWriterDraft => {
  const obj =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const draftSubjectRaw =
    typeof obj.draftSubject === "string" ? obj.draftSubject.trim() : "";
  const draftBodyRaw = typeof obj.draftBody === "string" ? obj.draftBody : "";
  const draftSubject = draftSubjectRaw || fallbackSubject;
  const draftBody = draftBodyRaw.trim() ? draftBodyRaw : fallbackBody;
  return { draftSubject, draftBody };
};

const ensureRePrefix = (subject: string): string => {
  const s = subject.trim();
  if (!s) return "Re:";
  if (/^\s*re\s*:/i.test(s)) return s;
  return `Re: ${s}`;
};

const ghostCache = new Map<string, { at: number; result: GhostWriterDraft }>();
const ghostInflight = new Map<string, Promise<GhostWriterDraft>>();
const GHOST_CACHE_TTL_MS = 30_000;

export const ghostWriteReplyDraft = async (
  input: GhostWriterInput,
): Promise<GhostWriterDraft> => {
  const key = JSON.stringify({
    originalFrom: input.originalFrom,
    originalTo: input.originalTo ?? "",
    originalCc: input.originalCc ?? "",
    originalSubject: input.originalSubject,
    originalBody: input.originalBody,
    myContext: input.myContext ?? "",
    intent: input.intent ?? "",
  });

  const cached = ghostCache.get(key);
  if (cached && Date.now() - cached.at < GHOST_CACHE_TTL_MS) return cached.result;

  const existing = ghostInflight.get(key);
  if (existing) return existing;

  const run = (async (): Promise<GhostWriterDraft> => {
    const fallbackSubject = ensureRePrefix(input.originalSubject);
    const fallbackBody = `안녕하세요,\n\n메일 확인했습니다.\n\n확인 후 회신드리겠습니다.\n\n감사합니다.`;

    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      const result = { draftSubject: fallbackSubject, draftBody: fallbackBody };
      ghostCache.set(key, { at: Date.now(), result });
      return result;
    }

    const model = process.env.NEXT_PUBLIC_OPENAI_MODEL || "gpt-5.4-nano";

    const system = [
      "당신은 비즈니스 이메일 '고스트 라이터(Ghost Writer)'입니다.",
      "사용자가 받은 이메일에 대한 답장 초안을 작성합니다.",
      "원문 이메일에 없는 사실/수치/약속/일정을 절대 만들어내지 않습니다. 불확실하면 질문 형태로 남깁니다.",
      "무례/압박/명령조/책임 전가가 생기지 않도록 전문적이고 정중한 톤을 유지합니다.",
      "원문의 언어(한국어/영어)를 유지합니다.",
      "답장 본문에는 불필요한 장문 인용(quote) 없이, 바로 보낼 수 있는 형태로 작성합니다.",
      "반드시 아래 JSON 형식만 출력합니다. 다른 텍스트는 금지합니다.",
    ].join("\n");

    const user = [
      "[원문 이메일]",
      `From: ${input.originalFrom}`,
      `To: ${input.originalTo || ""}`,
      `Cc: ${input.originalCc || ""}`,
      `Subject: ${input.originalSubject}`,
      "",
      input.originalBody,
      "",
      "[내 컨텍스트(있으면 반영)]",
      input.myContext || "",
      "",
      "[의도/요청(있으면 반영)]",
      input.intent || "",
      "",
      "[출력 JSON 스키마]",
      '{ "draftSubject": string, "draftBody": string }',
    ].join("\n");

    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content ?? "";
      const parsed = safeJsonParse(content);
      const normalized = normalizeGhostDraft(
        parsed,
        fallbackSubject,
        fallbackBody,
      );
      ghostCache.set(key, { at: Date.now(), result: normalized });
      return normalized;
    } catch (error) {
      console.error("Ghost Writer failed:", error);
      const result = { draftSubject: fallbackSubject, draftBody: fallbackBody };
      ghostCache.set(key, { at: Date.now(), result });
      return result;
    } finally {
      ghostInflight.delete(key);
    }
  })();

  ghostInflight.set(key, run);
  return run;
};
