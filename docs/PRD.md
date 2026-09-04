# PRD — 한↔영 음성 번역기 (Voice Translator)

| 항목 | 내용 |
|---|---|
| 문서 버전 | 1.0 |
| 작성일 | 2026-09-04 |
| 현재 제품 버전 | v0.5 |
| 배포 URL | https://songglee97.github.io/translater/ |
| API 서버 | https://translater-api.translater-api.workers.dev |
| 관련 문서 | [BRD.md](BRD.md), [../SETUP.md](../SETUP.md), [../README.md](../README.md) |

---

## 1. 제품 개요 (Overview)

브라우저에서 동작하는 한국어↔영어 음성 번역기. 마이크 버튼을 탭해 말하고, 다시 탭하면 정리된 원문과 번역이 표시되고 음성으로 읽어 준다. 설치·로그인 없이 URL로 사용하며, iPhone 홈 화면에 추가하면 앱처럼 열린다.

## 2. 대상 사용자 (Users)

| 페르소나 | 상황 | 니즈 |
|---|---|---|
| 소유자 | 일상·업무에서 영어 사용자와 짧은 대화 | 빠르고 자연스러운 번역, 소리로 바로 전달 |
| 친구 | 링크를 받아 iPhone에서 사용 | 설치 없이 바로 동작, 단순한 화면 |

## 3. 사용자 스토리 (User Stories)

- US-1: 사용자는 마이크를 한 번 탭해 녹음을 시작하고, 원하는 만큼 말한 뒤 다시 탭해 번역을 받을 수 있다.
- US-2: 사용자는 말하는 도중 잠시 멈춰도 문장이 끊기지 않고 자연스럽게 번역되길 원한다.
- US-3: 사용자는 번역 결과를 상대방에게 소리로 들려줄 수 있다.
- US-4: 사용자는 스왑 버튼으로 번역 방향을 바꿀 수 있다.
- US-5: 사용자는 말하기 대신 텍스트를 입력해 번역할 수 있다.
- US-6: 사용자는 번역 결과를 복사할 수 있다.
- US-7: 사용자는 iPhone 홈 화면에 추가해 전용 아이콘으로 앱처럼 열 수 있다.
- US-8: 마이크 거부·네트워크 오류 시 사용자는 원인을 화면에서 알 수 있다.

## 4. 기능 요구사항 (Functional Requirements)

### 4.1 음성 입력
| ID | 요구사항 | 상태 |
|---|---|---|
| FR-1 | 마이크 버튼 1회 탭 → 녹음 시작, 버튼이 붉게 펄스하며 "녹음 중 m:ss" 타이머 표시 | 완료 |
| FR-2 | 녹음 중 재탭 → 녹음 종료 후 음성인식·번역 수행. **녹음은 재탭으로만 종료**되며 브라우저의 자동 종료에 영향받지 않음 | 완료 |
| FR-3 | 녹음 시작 시 이전 원문·번역 초기화, 재생 중인 TTS 중단 | 완료 |
| FR-4 | 0.5초 미만 또는 무음 녹음은 "너무 짧음" 안내 후 무시 | 완료 |
| FR-5 | 서버 미설정(`config.js` 주소 비움) 또는 MediaRecorder 미지원 시 브라우저 내장 Web Speech API로 폴백. 이 모드에서는 실시간 자막 표시, 임시(interim) 텍스트 보존, 자동 재시작으로 연속 녹음 유지 | 완료 |
| FR-6 | Web Speech API 미지원 브라우저(Firefox)에서는 마이크 비활성화 및 안내, 텍스트 입력은 가능 | 완료 |

### 4.2 음성인식·번역 (API 모드)
| ID | 요구사항 | 상태 |
|---|---|---|
| FR-7 | 녹음 전체를 한 번에 Whisper(`whisper-large-v3-turbo`)로 인식 → 멈춤을 문장 종료로 오인하지 않음 | 완료 |
| FR-8 | LLM이 문장부호 복원, 조각 결합, 군말("음, 어, um, uh") 제거 후 번역. 존댓말/반말 등 어투 유지 | 완료 |
| FR-9 | 정리된 원문(`transcript`)과 번역(`translation`)을 함께 반환·표시. 원본 전사(`rawTranscript`)도 응답에 포함 | 완료 |
| FR-10 | LLM 모델 후보를 순서대로 시도(`openai/gpt-oss-120b` → `qwen/qwen3.8-27b` → `openai/gpt-oss-20b`), 모델 종료 시 자동 전환 | 완료 |
| FR-11 | `GET /models`로 현재 키가 쓸 수 있는 모델 목록과 사용 중 모델 확인 | 완료 |
| FR-12 | 텍스트 입력도 동일 서버로 번역(`text` 필드). 서버 실패 시 MyMemory → 비공식 Google 엔드포인트 순 폴백 | 완료 |

### 4.3 출력
| ID | 요구사항 | 상태 |
|---|---|---|
| FR-13 | 번역 완료 시 자동으로 대상 언어 음성으로 읽기(Auto-speak 토글, 기본 ON) | 완료 |
| FR-14 | 🔊 Speak 버튼으로 다시 듣기, 📋 Copy 버튼으로 클립보드 복사 | 완료 |
| FR-15 | 대상 언어에 맞는 TTS 음성 자동 선택(ko-KR / en-US) | 완료 |

### 4.4 언어·텍스트 입력
| ID | 요구사항 | 상태 |
|---|---|---|
| FR-16 | ⇄ 버튼으로 한↔영 방향 전환. 원문·번역 칸 내용도 서로 교환 | 완료 |
| FR-17 | 텍스트 입력 시 0.6초 정지 후 자동 번역, Ctrl/⌘+Enter로 즉시 번역+읽기 | 완료 |
| FR-18 | 브라우저 모드에서는 500자 제한(MyMemory 한도), API 모드에서는 제한 없음(글자 수만 표시) | 완료 |

### 4.5 배포·홈 화면
| ID | 요구사항 | 상태 |
|---|---|---|
| FR-19 | GitHub Pages 공개 URL, main 브랜치 푸시 시 자동 재배포 | 완료 |
| FR-20 | iPhone 홈 화면 추가 시 전용 아이콘(180px) 표시, 전체화면(standalone), 상태바 반투명, 노치/홈바 safe-area 여백 | 완료 |
| FR-21 | 웹 매니페스트(192/512px 아이콘, 테마색), 파비콘 | 완료 |

## 5. 비기능 요구사항 (Non-functional)

| 구분 | 요구사항 |
|---|---|
| 비용 | 월 0원. 유료 API·구독 사용 금지 |
| 보안 | Groq API 키는 Cloudflare Worker 비밀값(`GROQ_API_KEY`)으로만 보관. CORS 허용 출처를 `ALLOWED_ORIGINS`로 제한(github.io, localhost:8000) |
| 성능 | 재탭 후 결과 표시까지 2~4초(10~20초 발화 기준, 실측) |
| 용량 | 오디오 업로드 20MB 제한 |
| 호환성 | iOS Safari(홈 화면 모드 포함), Chrome, Edge. Firefox는 텍스트만 |
| 접근성/UX | 모바일 우선 레이아웃, 다크 모드 자동 대응, 한국어·영어 힌트 문구 |
| 유지보수 | 빌드 도구 없음. 정적 파일 4개 + 워커 1개. 모드 전환은 `config.js` 한 줄 |

## 6. 사용자 흐름 (User Flow)

```
[앱 열기] → [언어 방향 확인/⇄]
   → [🎤 탭] 녹음 시작 (타이머 표시)
   → 말하기 (중간 멈춤 허용)
   → [🎤 재탭] 녹음 종료
   → "음성을 인식하고 번역하는 중…"
   → 원문(정리됨) + 번역 표시 → 자동 음성 출력
   → [🔊 다시 듣기] / [📋 복사] / [⇄ 방향 전환 후 반복]
```

## 7. 시스템 구성 (Architecture)

```
iPhone/PC 브라우저 (GitHub Pages: index.html, style.css, app.js, config.js)
   │  MediaRecorder로 녹음 (webm/opus 또는 mp4)
   ▼  POST multipart {audio|text, from, to}
Cloudflare Worker  (worker/worker.js, 비밀값 GROQ_API_KEY)
   │  1) Groq Whisper  /audio/transcriptions
   │  2) Groq LLM      /chat/completions (JSON 응답: cleaned, translation)
   ▼
브라우저: 원문·번역 표시 → speechSynthesis로 읽기
```

### 7.1 API 계약 (Worker)

**POST /** — `multipart/form-data`

| 필드 | 필수 | 설명 |
|---|---|---|
| `from` | ✓ | `ko` 또는 `en` |
| `to` | ✓ | `ko` 또는 `en` (from과 달라야 함) |
| `audio` | 택1 | 녹음 파일 (≤20MB) |
| `text` | 택1 | 번역할 텍스트 |

응답 200:
```json
{ "transcript": "정리된 원문", "rawTranscript": "Whisper 원본", "translation": "번역" }
```
오류: `400` 언어쌍 오류, `413` 오디오 초과, `422` 음성 없음, `502` 외부 API 실패 (`{ "error": "..." }`)

**GET /models** — 사용 가능 모델 목록 `{ "models": [...], "using": { "whisper", "llm" } }`

### 7.2 기술 스택
| 영역 | 기술 |
|---|---|
| 프론트엔드 | HTML, CSS, Vanilla JavaScript (빌드 없음) |
| 음성 입력 | MediaRecorder API (API 모드) / Web Speech API (폴백) |
| 음성 출력 | speechSynthesis |
| 서버 | Cloudflare Workers (wrangler 4) |
| 음성인식 | Groq `whisper-large-v3-turbo` |
| 번역 | Groq `openai/gpt-oss-120b` (+ 폴백 2종) |
| 폴백 번역 | MyMemory, 비공식 Google translate 엔드포인트 |
| 호스팅 | GitHub Pages |
| 아이콘 제작 | SVG → headless Edge 렌더 → Pillow 리사이즈 |

## 8. 오류 처리 (Error Handling)

| 상황 | 사용자에게 보이는 처리 |
|---|---|
| 마이크 권한 거부 | "Microphone access was blocked…" 상태 줄 표시, 재시도 안내 |
| 녹음 너무 짧음 | "Recording was too short…" |
| 서버/외부 API 실패 | `Failed: <원인>` 표시. 텍스트 번역은 MyMemory로 자동 폴백 |
| 서버에 키 미설정 | "Server is missing GROQ_API_KEY" |
| 브라우저 미지원 | 마이크 비활성화 + 안내 문구, 텍스트 입력 유지 |

## 9. 지표 (Metrics)

- 재탭 후 결과 표시까지 소요 시간 (목표 ≤ 5초)
- 번역 실패율 (상태 줄 오류 발생 빈도)
- Groq 일일 사용량 대비 무료 한도 여유 (Groq 콘솔에서 확인)

## 10. 릴리스 이력 (Release History) — 모두 2026-09-04

| 버전 | 내용 |
|---|---|
| v0.1 | 최초 배포. Web Speech API 인식 + MyMemory 번역, TTS, 스왑, 복사, GitHub Pages 공개 |
| v0.2 | 마이크 토글 방식(탭 시작 / 재탭 종료 후 번역), 연속 인식 |
| v0.3 | 브라우저 자동 종료 시 세션 자동 재시작으로 "재탭으로만 종료" 보장. 재탭 시 임시(interim) 텍스트가 사라지는 버그 수정 |
| v0.4 | iPhone 홈 화면 아이콘(그라데이션·마이크·한/A 배지), 웹 매니페스트, standalone 메타, safe-area 여백 |
| v0.5 | API 모드 도입: MediaRecorder 녹음 → Cloudflare Worker → Groq Whisper + LLM(문장 복원·군말 제거·번역). `config.js` 모드 스위치, `/models` 진단, 모델 폴백 목록. SETUP.md 작성 |

## 11. 알려진 제한·향후 과제 (Open Issues / Future Work)

| 구분 | 내용 |
|---|---|
| 미검증 | iPhone 홈 화면(standalone) 모드에서 MediaRecorder 마이크 접근 실기기 확인 필요 |
| 제한 | API 모드에서는 말하는 동안 실시간 자막이 표시되지 않음(타이머만 표시). 필요 시 브라우저 인식을 자막 전용으로 병행하는 혼합 방식 검토 |
| 제한 | Groq 무료 한도 초과 시 일시 실패. 사용량 모니터링 필요 |
| 향후 | 번역 이력 저장, 대화 모드(양방향 연속), 다른 언어 추가, 실시간 스트리밍 통역 |
| 향후 | Worker 요청 속도 제한(rate limit) 추가로 무료 한도 보호 |
