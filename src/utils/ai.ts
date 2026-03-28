import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export interface AnalysisResult {
  errors: string[];
  improvements: string[];
  recommendedCCs: string[];
  severity: 'Red' | 'Yellow' | 'Green';
}

export const analyzeMail = async (data: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  hasAttachment: boolean;
}): Promise<AnalysisResult> => {
  if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
    return {
      errors: ['API 키가 설정되지 않았습니다.'],
      improvements: [],
      recommendedCCs: [],
      severity: 'Yellow',
    };
  }

  const prompt = `
당신은 이메일 보안 및 비즈니스 매너 전문가인 '메일 가디언'입니다. 
다음 이메일 내용을 분석하여 위험 요소, 개선 사항, 누락된 참조인을 제안해주세요.

[이메일 정보]
수신인: ${data.to}
참조: ${data.cc || '없음'}
제목: ${data.subject}
본문: ${data.body}
첨부파일 유무: ${data.hasAttachment ? '있음' : '없음'}

분석 결과는 반드시 다음 JSON 형식을 따라야 합니다:
{
  "errors": ["위험 요소 리스트 (예: 수신인 도메인 불일치, 민감 정보 포함 등)"],
  "improvements": ["문장 개선 제안 리스트"],
  "recommendedCCs": ["추가하면 좋을 참조인 이메일 리스트"],
  "severity": "Red(위험) | Yellow(주의) | Green(통과)"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5o-nano',
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      errors: result.errors || [],
      improvements: result.improvements || [],
      recommendedCCs: result.recommendedCCs || [],
      severity: result.severity || 'Green',
    };
  } catch (error) {
    console.error('AI Analysis failed:', error);
    return {
      errors: ['AI 분석 중 오류가 발생했습니다.'],
      improvements: [],
      recommendedCCs: [],
      severity: 'Yellow',
    };
  }
};
