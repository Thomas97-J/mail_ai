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

const localAnalyzeFallback = (data: {
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

const localAnalyzeDeterministic = (data: {
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

  const body = data.body.trim();

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
  const hasKey = Boolean(process.env.NEXT_PUBLIC_OPENAI_API_KEY);
  const local = hasKey ? localAnalyzeDeterministic(data) : localAnalyzeFallback(data);
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

type ImprovedDraftResult = AnalysisWithImprovedBody;

const normalizeAnalysisWithImprovedDraft = (
  value: unknown,
  fallback: { subject: string; body: string },
): ImprovedDraftResult => {
  const obj =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const errors = uniqClean(Array.isArray(obj.errors) ? obj.errors : []);
  const improvements = uniqClean(Array.isArray(obj.improvements) ? obj.improvements : []);
  const recommendedCCs = uniqClean(
    Array.isArray(obj.recommendedCCs) ? obj.recommendedCCs : [],
  );
  const severity = normalizeSeverity(obj.severity);

  const improvedBody =
    typeof obj.improvedBody === "string" && obj.improvedBody.trim()
      ? obj.improvedBody
      : fallback.body;

  const titleCandidate =
    (typeof obj.improvedTitle === "string" && obj.improvedTitle.trim()
      ? obj.improvedTitle
      : undefined) ??
    (typeof obj.improvedtitle === "string" && obj.improvedtitle.trim()
      ? obj.improvedtitle
      : undefined) ??
    fallback.subject;

  const improvedTitle = titleCandidate.trim() || fallback.subject;

  return {
    errors,
    improvements,
    recommendedCCs,
    severity,
    improvedBody,
    improvedTitle,
  };
};

const improvedDraftCache = new Map<string, { at: number; result: ImprovedDraftResult }>();
const improvedDraftInflight = new Map<string, Promise<ImprovedDraftResult>>();
const IMPROVED_DRAFT_TTL_MS = 30_000;

export const analyzeMailWithImprovedBody = async (data: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  hasAttachment: boolean;
}): Promise<AnalysisWithImprovedBody> => {
  const fallbackTitle = data.subject;
  const fallbackBody = data.body;
  const fallback: AnalysisWithImprovedBody = {
    ...(process.env.NEXT_PUBLIC_OPENAI_API_KEY
      ? localAnalyzeDeterministic(data)
      : localAnalyzeFallback(data)),
    improvedBody: fallbackBody,
    improvedTitle: fallbackTitle,
  };

  const improvedKey = JSON.stringify({
    to: data.to,
    cc: data.cc ?? '',
    subject: data.subject,
    body: data.body,
    hasAttachment: data.hasAttachment,
  });

  const cached = improvedDraftCache.get(improvedKey);
  if (cached && Date.now() - cached.at < IMPROVED_DRAFT_TTL_MS) return cached.result;

  const existing = improvedDraftInflight.get(improvedKey);
  if (existing) return existing;

  const run = (async (): Promise<ImprovedDraftResult> => {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      const result = fallback;
      improvedDraftCache.set(improvedKey, { at: Date.now(), result });
      return result;
    }

    const model = process.env.NEXT_PUBLIC_OPENAI_MODEL || "gpt-5.4-nano";

    const system = [
      "당신은 이메일 보안/매너 점검 + 자동 개선 초안 생성 에이전트입니다.",
      "목표: (1) 위험 요소/개선 제안/추천 CC/위험도를 산출하고, (2) 제목/본문을 더 정중하고 명확하게 개선한 버전을 제공합니다.",
      "반드시 아래 JSON 형식만 출력합니다. 설명/마크다운/추가 필드는 금지합니다.",
      "recommendedCCs는 이메일 주소만 허용합니다. 본문/수신인/참조에 실제로 등장한 주소만 포함합니다. 추측 금지.",
      "원문에 없는 사실/수치/약속/일정을 만들어내지 않습니다.",
      "improvedTitle은 짧고 구체적으로(가능하면 60자 이내), 원문의 의미를 보존하며 개선합니다.",
      "improvedBody는 원문의 언어(한국어/영어)를 유지하고, 명령조/압박/책임 전가/무례한 표현은 완곡하고 전문적으로 바꿉니다.",
      "severity는 Red|Yellow|Green 중 하나만 사용합니다.",
      "Red: 발송 전 수정/확인 없이는 위험. Yellow: 검토/개선 권장. Green: 큰 이슈 없음.",
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
      '  "severity": "Red" | "Yellow" | "Green",',
      '  "improvedTitle": string,',
      '  "improvedBody": string',
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
      const llm = normalizeAnalysisWithImprovedDraft(parsed, {
        subject: fallbackTitle,
        body: fallbackBody,
      });

      const deterministic = localAnalyzeDeterministic(data);
      const allowedCc = new Set(
        extractEmails(`${data.to} ${data.cc ?? ""} ${data.subject} ${data.body}`),
      );
      const filteredRecommended = llm.recommendedCCs
        .map((v) => v.toLowerCase().trim())
        .filter((v) => allowedCc.has(v));

      const merged: AnalysisWithImprovedBody = {
        errors: uniqClean([...deterministic.errors, ...llm.errors]),
        improvements: uniqClean([...deterministic.improvements, ...llm.improvements]),
        recommendedCCs: uniqClean(filteredRecommended),
        severity: maxSeverity(deterministic.severity, llm.severity),
        improvedTitle: llm.improvedTitle,
        improvedBody: llm.improvedBody,
      };

      improvedDraftCache.set(improvedKey, { at: Date.now(), result: merged });
      return merged;
    } catch (error) {
      console.error("AI improved draft failed:", error);
      const result = fallback;
      improvedDraftCache.set(improvedKey, { at: Date.now(), result });
      return result;
    } finally {
      improvedDraftInflight.delete(improvedKey);
    }
  })();

  improvedDraftInflight.set(improvedKey, run);
  return run;
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

export interface WatchdogTrackedMail {
  threadId: string;
  sentAtMs: number;
  dueAtMs: number;
  subject: string;
  to: string;
  from: string;
  notifiedAtMs?: number;
}

export interface WatchdogReminderCandidate {
  threadId: string;
  dueAtMs: number;
  subject: string;
  to: string;
  from: string;
  reason: string;
}

type DeadlineParse = { dueAtMs: number; matchedText: string; confidence: "high" | "medium" | "low" };

const startOfDayMs = (d: Date): number => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const endOfDayMs = (d: Date): number => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
};

const addDays = (d: Date, days: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const weekdayIndexKo: Record<string, number> = {
  일: 0,
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6,
};

const nextWeekday = (now: Date, targetDow: number, preferThisWeek: boolean): Date => {
  const nowDow = now.getDay();
  let diff = (targetDow - nowDow + 7) % 7;
  if (diff === 0) diff = 7;
  const candidate = addDays(now, diff);
  if (preferThisWeek) {
    const thisWeekCandidate = addDays(now, (targetDow - nowDow + 7) % 7);
    if (thisWeekCandidate.getDay() === targetDow && thisWeekCandidate >= now) {
      return thisWeekCandidate;
    }
  }
  return candidate;
};

const parseAbsoluteDate = (text: string, now: Date): DeadlineParse | null => {
  const t = text;
  const ymd = t.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (ymd) {
    const y = Number.parseInt(ymd[1], 10);
    const m = Number.parseInt(ymd[2], 10);
    const d = Number.parseInt(ymd[3], 10);
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(dt.getTime())) {
      return { dueAtMs: endOfDayMs(dt), matchedText: ymd[0], confidence: "high" };
    }
  }

  const mdSlash = t.match(/(?:^|[^\d])(\d{1,2})[\/.](\d{1,2})(?:$|[^\d])/);
  if (mdSlash) {
    const m = Number.parseInt(mdSlash[1], 10);
    const d = Number.parseInt(mdSlash[2], 10);
    const y = now.getFullYear();
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(dt.getTime())) {
      return { dueAtMs: endOfDayMs(dt), matchedText: mdSlash[0].trim(), confidence: "medium" };
    }
  }

  const mdKo = t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (mdKo) {
    const m = Number.parseInt(mdKo[1], 10);
    const d = Number.parseInt(mdKo[2], 10);
    const y = now.getFullYear();
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(dt.getTime())) {
      return { dueAtMs: endOfDayMs(dt), matchedText: mdKo[0], confidence: "high" };
    }
  }

  return null;
};

const parseRelativeDeadline = (text: string, now: Date): DeadlineParse | null => {
  const t = text;
  if (/(오늘까지|오늘 내로|금일|금일 내)/.test(t)) {
    return { dueAtMs: endOfDayMs(now), matchedText: "오늘", confidence: "high" };
  }
  if (/(내일까지|내일 내로)/.test(t)) {
    const dt = addDays(now, 1);
    return { dueAtMs: endOfDayMs(dt), matchedText: "내일", confidence: "high" };
  }
  if (/(모레까지|모레 내로)/.test(t)) {
    const dt = addDays(now, 2);
    return { dueAtMs: endOfDayMs(dt), matchedText: "모레", confidence: "medium" };
  }

  const weekday = t.match(/(이번주|다음주)?\s*(월|화|수|목|금|토|일)\s*요일?\s*(까지|내로)?/);
  if (weekday) {
    const pref = weekday[1] === "이번주";
    const next = weekday[1] === "다음주";
    const dow = weekdayIndexKo[weekday[2]];
    const base = next ? addDays(now, 7) : now;
    const dt = nextWeekday(base, dow, pref);
    return {
      dueAtMs: endOfDayMs(dt),
      matchedText: weekday[0].trim(),
      confidence: weekday[1] ? "high" : "medium",
    };
  }

  const inNDays = t.match(/(\d+)\s*(일|days?)\s*(이내|내로|안에|후)/i);
  if (inNDays) {
    const n = Number.parseInt(inNDays[1], 10);
    if (Number.isFinite(n) && n > 0 && n <= 365) {
      const dt = addDays(now, n);
      return { dueAtMs: endOfDayMs(dt), matchedText: inNDays[0].trim(), confidence: "medium" };
    }
  }

  return null;
};

export const watchdogExtractDeadline = (
  subject: string,
  body: string,
  now: Date = new Date(),
): DeadlineParse | null => {
  const text = `${subject}\n${body}`;
  const absolute = parseAbsoluteDate(text, now);
  if (absolute) return absolute;
  const relative = parseRelativeDeadline(text, now);
  if (relative) return relative;
  return null;
};

export const watchdogTrackSentMail = (input: {
  threadId: string;
  sentAtMs: number;
  subject: string;
  body: string;
  to: string;
  from: string;
  now?: Date;
}): WatchdogTrackedMail | null => {
  const parsed = watchdogExtractDeadline(input.subject, input.body, input.now ?? new Date());
  if (!parsed) return null;
  return {
    threadId: input.threadId,
    sentAtMs: input.sentAtMs,
    dueAtMs: parsed.dueAtMs,
    subject: input.subject,
    to: input.to,
    from: input.from,
  };
};

export const watchdogNeedsReminderToday = (input: {
  tracked: WatchdogTrackedMail;
  threadMessages: Array<{ internalDateMs: number; from: string }>;
  now?: Date;
}): { shouldRemind: boolean; reason: string } => {
  const now = input.now ?? new Date();
  const tracked = input.tracked;
  const duePassed = (input.now ? input.now.getTime() : Date.now()) > tracked.dueAtMs;
  const dueTodayOrPast = startOfDayMs(now) >= startOfDayMs(new Date(tracked.dueAtMs));

  const sentFrom = tracked.from.trim().toLowerCase();
  const replied = input.threadMessages.some(
    (m) => m.internalDateMs > tracked.sentAtMs && m.from.trim().toLowerCase() !== sentFrom,
  );

  if (!dueTodayOrPast) return { shouldRemind: false, reason: "기한이 아직 남아있습니다." };
  if (replied) return { shouldRemind: false, reason: "이미 답장이 있습니다." };

  if (tracked.notifiedAtMs) {
    const notifiedDay = startOfDayMs(new Date(tracked.notifiedAtMs));
    const today = startOfDayMs(now);
    if (notifiedDay === today) {
      return { shouldRemind: false, reason: "오늘은 이미 알림을 생성했습니다." };
    }
  }

  return {
    shouldRemind: true,
    reason: duePassed
      ? "기한이 지났는데 답장이 없습니다."
      : "기한일인데 답장이 없습니다.",
  };
};

export const watchdogFindReminderCandidates = (input: {
  trackedMails: WatchdogTrackedMail[];
  threadMessagesByThreadId: Record<string, Array<{ internalDateMs: number; from: string }>>;
  now?: Date;
}): WatchdogReminderCandidate[] => {
  const now = input.now ?? new Date();
  const out: WatchdogReminderCandidate[] = [];
  for (const tracked of input.trackedMails) {
    const threadMessages = input.threadMessagesByThreadId[tracked.threadId] ?? [];
    const decision = watchdogNeedsReminderToday({ tracked, threadMessages, now });
    if (!decision.shouldRemind) continue;
    out.push({
      threadId: tracked.threadId,
      dueAtMs: tracked.dueAtMs,
      subject: tracked.subject,
      to: tracked.to,
      from: tracked.from,
      reason: decision.reason,
    });
  }
  return out.sort((a, b) => a.dueAtMs - b.dueAtMs);
};

export const ghostWriteReminderDraft = async (input: {
  to: string;
  originalSubject: string;
  originalBody: string;
  dueAtMs: number;
  myContext?: string;
}): Promise<GhostWriterDraft> => {
  const dueDate = new Date(input.dueAtMs);
  const dueText = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`;

  const key = JSON.stringify({
    to: input.to,
    originalSubject: input.originalSubject,
    originalBody: input.originalBody,
    dueAtMs: input.dueAtMs,
    myContext: input.myContext ?? "",
  });

  const cached = ghostCache.get(key);
  if (cached && Date.now() - cached.at < GHOST_CACHE_TTL_MS) return cached.result;

  const existing = ghostInflight.get(key);
  if (existing) return existing;

  const run = (async (): Promise<GhostWriterDraft> => {
    const fallbackSubject = ensureRePrefix(input.originalSubject);
    const fallbackBody = `안녕하세요,\n\n${dueText}까지 부탁드렸던 건 관련해서 진행 상황 확인 부탁드립니다.\n가능하시면 예상 일정도 함께 공유해주시면 감사하겠습니다.\n\n감사합니다.`;

    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      const result = { draftSubject: fallbackSubject, draftBody: fallbackBody };
      ghostCache.set(key, { at: Date.now(), result });
      return result;
    }

    const model = process.env.NEXT_PUBLIC_OPENAI_MODEL || "gpt-5.4-nano";

    const system = [
      "당신은 비즈니스 이메일 '리마인더(Watchdog) 고스트 라이터'입니다.",
      "목표: 재촉하지 않으면서 부드럽고 명확하게 리마인드하는 답장 초안을 작성합니다.",
      "원문 이메일에 없는 사실/수치/약속/일정을 절대 만들어내지 않습니다.",
      "다음 요소를 포함할 수 있습니다: 확인 요청, 예상 일정 질문, 도움 필요 여부 질문, 감사/마무리.",
      "원문의 언어(한국어/영어)를 유지합니다.",
      "반드시 아래 JSON 형식만 출력합니다. 다른 텍스트는 금지합니다.",
    ].join("\n");

    const user = [
      "[상황]",
      `기한: ${dueText}`,
      `수신인(To): ${input.to}`,
      "",
      "[원문 이메일(내가 보낸 요청)]",
      `Subject: ${input.originalSubject}`,
      "",
      input.originalBody,
      "",
      "[내 컨텍스트(있으면 반영)]",
      input.myContext || "",
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
      const normalized = normalizeGhostDraft(parsed, fallbackSubject, fallbackBody);
      ghostCache.set(key, { at: Date.now(), result: normalized });
      return normalized;
    } catch (error) {
      console.error("Watchdog reminder draft failed:", error);
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

export interface WatchdogLLMOutput {
  shouldTrack: boolean;
  dueDateISO: string | null;
  dueConfidence: "high" | "medium" | "low";
  dueReason: string;
  hasReply: boolean;
  shouldRemindToday: boolean;
  remindReason: string;
  draft: GhostWriterDraft | null;
}

export interface WatchdogLLMResult {
  tracked: WatchdogTrackedMail | null;
  candidate: WatchdogReminderCandidate | null;
  draft: GhostWriterDraft | null;
  modelOutput: WatchdogLLMOutput;
}

const normalizeWatchdogLLMOutput = (value: unknown): WatchdogLLMOutput => {
  const obj =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const shouldTrack = Boolean(obj.shouldTrack);
  const dueDateISO =
    typeof obj.dueDateISO === "string" && obj.dueDateISO.trim()
      ? obj.dueDateISO.trim()
      : null;
  const dueConfidence =
    obj.dueConfidence === "high" || obj.dueConfidence === "medium" || obj.dueConfidence === "low"
      ? obj.dueConfidence
      : "low";
  const dueReason = typeof obj.dueReason === "string" ? obj.dueReason.trim() : "";
  const hasReply = Boolean(obj.hasReply);
  const shouldRemindToday = Boolean(obj.shouldRemindToday);
  const remindReason = typeof obj.remindReason === "string" ? obj.remindReason.trim() : "";

  const draftObj = obj.draft && typeof obj.draft === "object" ? (obj.draft as Record<string, unknown>) : null;
  const draft =
    draftObj && typeof draftObj.draftSubject === "string" && typeof draftObj.draftBody === "string"
      ? {
          draftSubject: draftObj.draftSubject.trim(),
          draftBody: draftObj.draftBody,
        }
      : null;

  return {
    shouldTrack,
    dueDateISO,
    dueConfidence,
    dueReason,
    hasReply,
    shouldRemindToday,
    remindReason,
    draft,
  };
};

const parseISODateToDueAtMs = (iso: string, now: Date): number | null => {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10);
  const d = Number.parseInt(m[3], 10);
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return null;

  const min = addDays(now, -365).getTime();
  const max = addDays(now, 365).getTime();
  if (dt.getTime() < min || dt.getTime() > max) return null;
  return endOfDayMs(dt);
};

const watchdogLLMCache = new Map<string, { at: number; result: WatchdogLLMResult }>();
const watchdogLLMInflight = new Map<string, Promise<WatchdogLLMResult>>();
const WATCHDOG_LLM_CACHE_TTL_MS = 30_000;

export const watchdogEvaluateForReminderWithLLM = async (input: {
  sent: {
    threadId: string;
    sentAtMs: number;
    subject: string;
    body: string;
    to: string;
    from: string;
  };
  threadMessages: Array<{
    internalDateMs: number;
    from: string;
    subject?: string;
    snippet?: string;
    body?: string;
  }>;
  now?: Date;
  myContext?: string;
}): Promise<WatchdogLLMResult> => {
  const now = input.now ?? new Date();
  const key = JSON.stringify({
    sent: input.sent,
    threadMessages: input.threadMessages.map((m) => ({
      internalDateMs: m.internalDateMs,
      from: m.from,
      subject: m.subject ?? "",
      snippet: m.snippet ?? "",
      body: m.body ? m.body.slice(0, 1000) : "",
    })),
    nowISO: now.toISOString().slice(0, 10),
    myContext: input.myContext ?? "",
  });

  const cached = watchdogLLMCache.get(key);
  if (cached && Date.now() - cached.at < WATCHDOG_LLM_CACHE_TTL_MS) return cached.result;

  const existing = watchdogLLMInflight.get(key);
  if (existing) return existing;

  const run = (async (): Promise<WatchdogLLMResult> => {
    const modelOutputFallback: WatchdogLLMOutput = {
      shouldTrack: false,
      dueDateISO: null,
      dueConfidence: "low",
      dueReason: "",
      hasReply: false,
      shouldRemindToday: false,
      remindReason: "",
      draft: null,
    };

    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      const result: WatchdogLLMResult = {
        tracked: null,
        candidate: null,
        draft: null,
        modelOutput: modelOutputFallback,
      };
      watchdogLLMCache.set(key, { at: Date.now(), result });
      return result;
    }

    const model = process.env.NEXT_PUBLIC_OPENAI_MODEL || "gpt-5.4-nano";

    const system = [
      "당신은 이메일 '워치독(Watchdog)' 에이전트입니다.",
      "목표: (1) 발송 메일에서 기한(deadline)을 추출해 트래킹할지 결정하고, (2) 스레드를 보고 오늘 리마인더 알림이 필요한지 판단하고, (3) 필요하면 재촉하지 않는 리마인드 초안을 제공합니다.",
      "반드시 아래 JSON 스키마만 출력합니다. 다른 텍스트는 금지합니다.",
      "중요: 원문/스레드에 없는 사실, 일정, 약속을 만들어내지 않습니다. 불확실하면 shouldTrack=false 또는 dueConfidence를 낮추고 dueReason에 근거를 씁니다.",
      "dueDateISO는 반드시 YYYY-MM-DD 형식이며, 상대적인 표현(예: 금요일까지)은 현재 날짜(nowDateISO)를 기준으로 날짜로 변환합니다.",
      "shouldRemindToday는 다음 원칙으로 판단합니다:",
      "- 기한이 오늘이거나 이미 지났고",
      "- 발송 시점(sentAtMs) 이후에 상대의 답장(hasReply)이 없으면 true",
      "- 기한이 남아있으면 false",
      "draft는 shouldRemindToday가 true일 때만 작성합니다(정중/부드럽게).",
      "draftSubject는 'Re:'를 포함한 제목을 권장합니다.",
    ].join("\n");

    const user = [
      "[현재 날짜]",
      `nowDateISO: ${now.toISOString().slice(0, 10)}`,
      "",
      "[내가 보낸 메일(트래킹 대상 후보)]",
      `threadId: ${input.sent.threadId}`,
      `sentAtMs: ${input.sent.sentAtMs}`,
      `from: ${input.sent.from}`,
      `to: ${input.sent.to}`,
      `subject: ${input.sent.subject}`,
      "body:",
      input.sent.body,
      "",
      "[스레드 메시지 요약(시간순)]",
      JSON.stringify(
        input.threadMessages
          .slice()
          .sort((a, b) => a.internalDateMs - b.internalDateMs)
          .map((m) => ({
            internalDateMs: m.internalDateMs,
            from: m.from,
            subject: m.subject ?? "",
            snippet: (m.snippet ?? "").slice(0, 400),
            body: (m.body ?? "").slice(0, 800),
          })),
      ),
      "",
      "[내 컨텍스트(선택)]",
      input.myContext ?? "",
      "",
      "[출력 JSON 스키마]",
      "{",
      '  "shouldTrack": boolean,',
      '  "dueDateISO": string | null,',
      '  "dueConfidence": "high" | "medium" | "low",',
      '  "dueReason": string,',
      '  "hasReply": boolean,',
      '  "shouldRemindToday": boolean,',
      '  "remindReason": string,',
      '  "draft": { "draftSubject": string, "draftBody": string } | null',
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
      const modelOutput = normalizeWatchdogLLMOutput(parsed);

      const dueAtMs =
        modelOutput.shouldTrack && modelOutput.dueDateISO
          ? parseISODateToDueAtMs(modelOutput.dueDateISO, now)
          : null;

      const deterministicHasReply = input.threadMessages.some(
        (m) =>
          m.internalDateMs > input.sent.sentAtMs &&
          m.from.trim().toLowerCase() !== input.sent.from.trim().toLowerCase(),
      );

      const hasReply = modelOutput.hasReply || deterministicHasReply;

      const shouldRemindToday =
        dueAtMs !== null &&
        !hasReply &&
        modelOutput.shouldRemindToday &&
        startOfDayMs(now) >= startOfDayMs(new Date(dueAtMs));

      const tracked: WatchdogTrackedMail | null =
        dueAtMs && modelOutput.shouldTrack
          ? {
              threadId: input.sent.threadId,
              sentAtMs: input.sent.sentAtMs,
              dueAtMs,
              subject: input.sent.subject,
              to: input.sent.to,
              from: input.sent.from,
            }
          : null;

      const candidate: WatchdogReminderCandidate | null =
        tracked && shouldRemindToday
          ? {
              threadId: tracked.threadId,
              dueAtMs: tracked.dueAtMs,
              subject: tracked.subject,
              to: tracked.to,
              from: tracked.from,
              reason: modelOutput.remindReason || "리마인드가 필요합니다.",
            }
          : null;

      const draft = candidate && modelOutput.draft ? modelOutput.draft : null;

      const result: WatchdogLLMResult = {
        tracked,
        candidate,
        draft,
        modelOutput: { ...modelOutput, hasReply, shouldRemindToday },
      };

      watchdogLLMCache.set(key, { at: Date.now(), result });
      return result;
    } catch (error) {
      console.error("Watchdog LLM evaluation failed:", error);
      const result: WatchdogLLMResult = {
        tracked: null,
        candidate: null,
        draft: null,
        modelOutput: modelOutputFallback,
      };
      watchdogLLMCache.set(key, { at: Date.now(), result });
      return result;
    } finally {
      watchdogLLMInflight.delete(key);
    }
  })();

  watchdogLLMInflight.set(key, run);
  return run;
};
