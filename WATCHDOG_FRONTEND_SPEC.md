# Watchdog(Watchdog) 프론트엔드 구현 명세

이 문서는 Watchdog 기능을 “프론트엔드(클라이언트)”에서 구현하기 위한 명세입니다.  
현재 코드베이스에 이미 존재하는 유틸 함수([ai.ts](file:///Users/youngjunlee/Project/mail_ai/src/utils/ai.ts), [gmail.ts](file:///Users/youngjunlee/Project/mail_ai/src/utils/gmail.ts))를 기반으로, 화면/스토어/동작 연결을 정의합니다.

## 1) 목표 / UX

- 사용자는 기한이 포함된 메일을 보낸 뒤, Watchdog가 해당 메일을 “추적(tracking)” 대상으로 등록한다.
- 사용자가 앱을 열거나 메일함을 갱신할 때, Watchdog가 해당 스레드(thread)를 모니터링하여:
  - 기한이 오늘이거나 지났고
  - 발송 이후 답장이 없으면
  - “오늘 알림(팝업)”을 생성하고, “부드러운 리마인드 초안”을 제공한다.
- 사용자는 알림 팝업에서 아래 액션을 수행한다.
  - 초안으로 답장 작성하기(Compose 이동 + 자동 채움)
  - 초안 복사
  - 오늘은 무시(오늘 재노출 방지)
  - 추적 중단

## 2) 핵심 원칙

- 자동 발송은 하지 않는다. 항상 “제안 + 초안 제공”까지만 수행한다.
- 비용/레이트리밋을 위해 “필요한 경우에만” LLM 호출을 수행한다.
- 프론트 MVP는 로컬 저장소 기반으로 구현하되, 추후 서버 저장소로 확장 가능하게 데이터 구조를 정의한다.

## 3) 데이터 모델(프론트 저장/상태)

### 3.1 Tracked(추적 대상)

- 타입: `WatchdogTrackedMail` (이미 utils에 존재)
  - 위치: [ai.ts](file:///Users/youngjunlee/Project/mail_ai/src/utils/ai.ts)
- 저장 위치(MVP): zustand persist(localStorage)
- 필드:
  - `threadId: string`
  - `sentAtMs: number`
  - `dueAtMs: number`
  - `subject: string`
  - `to: string`
  - `from: string`
  - `notifiedAtMs?: number` (당일 중복 팝업 방지)

### 3.2 Notification(오늘 알림 항목)

- UI용 모델(권장):
  - `threadId: string`
  - `reason: string`
  - `dueAtMs: number`
  - `draftSubject: string`
  - `draftBody: string`
  - `createdAtMs: number`

## 4) 트리거(언제 Watchdog가 실행되는가)

### 4.1 발송 직후(트래킹 등록)

발송 성공 직후에 “이 메일을 트래킹할 가치가 있는지”를 결정하고 저장한다.

- 입력:
  - sendMail 응답에서 획득 가능한 `threadId`
  - 내가 보낸 메일의 `sentAtMs`, `subject`, `body`, `to`, `from`
- 처리(권장: 통합 LLM 호출):
  - `threadMessages=[]`로 두고, 기한 추출 + 트래킹 여부를 LLM이 판단하도록 호출
- 함수:
  - [watchdogEvaluateForReminderWithLLM](file:///Users/youngjunlee/Project/mail_ai/src/utils/ai.ts) (통합 판단)
- 출력:
  - `tracked`가 있으면 `watchdogTrackedMails`에 append
  - `tracked`가 null이면 저장하지 않음

### 4.2 앱 진입 / 메일함 갱신(모니터링 + 알림 생성)

앱이 스레드 내용을 조회할 수 있는 순간(예: 메일 리스트 로드/새로고침)에 Watchdog를 실행한다.

- 조건:
  - `watchdogTrackedMails.length > 0`일 때만 실행
- 실행 빈도 제한(권장):
  - `lastWatchdogRunAtMs`를 저장하고 하루 1회 또는 6시간 1회만 실행
- 대상 필터(권장):
  - `dueAtMs`가 오늘이거나 과거인 트래킹만 검사(비용 최적화)

## 5) 실행 파이프라인(프론트 로직)

### 5.1 입력 수집 단계

- `accessToken` 확보(기존 auth store 사용)
- `trackedMails` 로드(로컬 저장소)
- 각 tracked의 `threadId`로 Gmail thread 조회
  - thread fetch: [fetchThreadDetail](file:///Users/youngjunlee/Project/mail_ai/src/utils/gmail.ts#L78-L95)
  - thread parse: [parseThreadMessages](file:///Users/youngjunlee/Project/mail_ai/src/utils/gmail.ts#L139-L144)

### 5.2 판단(LLM 통합 함수 1회)

각 tracked에 대해 아래 입력으로 1회 호출:

- 함수: [watchdogEvaluateForReminderWithLLM](file:///Users/youngjunlee/Project/mail_ai/src/utils/ai.ts)
- 입력:
  - `sent`: tracked 기반(내 발송 메일 메타)
  - `threadMessages`: 위에서 파싱한 스레드 메시지 리스트
  - `now`: 현재 시간
  - `myContext?`: (선택) 사용자/프로젝트 컨텍스트
- 출력:
  - `candidate` + `draft`가 존재하면 “오늘 알림” 생성
  - 알림 생성 시 해당 tracked에 `notifiedAtMs=now` 저장

### 5.3 동시성/레이트리밋(권장)

스레드 fetch + LLM 호출이 연속으로 발생하므로 다음을 권장:

- 한 번 실행에서 처리할 tracked 개수를 제한(예: 5개)
- 다음 실행에서 이어서 처리(스케줄링)

### 5.4 실패/예외 처리

- thread fetch 실패:
  - 해당 tracked는 스킵(다음 런에서 재시도)
- LLM 실패:
  - 알림을 생성하지 않거나
  - 최소 템플릿(“진행 상황 확인 부탁드립니다.”)으로 degrade
- API 키 없음:
  - 통합 함수는 “아무것도 하지 않음” 결과로 degrade

## 6) UI 명세(팝업/알림)

### 6.1 오늘 알림 팝업

- 표시 조건:
  - `notificationsToday.length > 0`
- 표시 내용:
  - 타이틀: “답장 리마인드가 필요해요”
  - reason: `candidate.reason`
  - 원본: subject/to/due
  - 초안 미리보기(접기/펼치기)
- 버튼:
  - “초안으로 답장 작성”
    - Compose를 reply 모드로 전환하고 `draftSubject/draftBody`를 채움
  - “복사”
  - “오늘은 무시”
    - 해당 tracked에 `notifiedAtMs`를 오늘로 저장(재노출 방지)
  - “추적 중단”
    - tracked에서 제거

### 6.2 “초안으로 답장 작성” 동작

- 답장 화면에 채우는 값:
  - `subject = draftSubject`
  - `body = draftBody`
- 원문 인용(quote)은 옵션:
  - 필요하면 Compose가 기존에 쓰는 “Original Message” 포맷을 뒤에 append

## 7) 구현 체크리스트(프론트 작업 항목)

- 상태/저장소
  - `watchdogTrackedMails: WatchdogTrackedMail[]`
  - `watchdogNotifications: Notification[]`
  - `lastWatchdogRunAtMs: number`
- 발송 직후 트래킹 등록
  - sendMail 응답에서 `threadId` 확보 → `watchdogEvaluateForReminderWithLLM({ threadMessages: [] })` 호출 → tracked 저장
- 앱 진입/갱신 시 모니터링 실행
  - due 조건 필터링 → thread fetch/parse → LLM 판단 → 알림 생성
- UI
  - 알림 팝업/토스트/드로어 구성
  - 액션 버튼(답장 작성/복사/무시/추적중단)

## 8) 보안/운영 고려

- 현재 프로젝트는 브라우저에서 OpenAI 키를 사용한다(`NEXT_PUBLIC_OPENAI_API_KEY`). Watchdog는 호출 빈도가 증가할 수 있어 비용/키 노출 리스크가 커질 수 있다.
- 운영 단계에서는:
  - 서버 사이드로 LLM 호출을 이동하거나
  - 최소한 Watchdog 실행 빈도/대상을 강하게 제한하는 방식이 필요하다.

