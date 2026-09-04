# 무료 고품질 모드 설정 (Groq + Cloudflare Workers)

브라우저 내장 음성인식 대신, 녹음한 음성을 통째로 Whisper에 보내고 LLM이 문장을 다듬어 번역하는 모드입니다.
말하는 중간에 멈춰도 문장이 끊기지 않습니다. 비용은 0원입니다.

## 1. 계정 두 개 만들기

### Groq (음성인식 + 번역)
1. https://console.groq.com 가입 (구글 계정 가능, 카드 불필요)
2. 왼쪽 메뉴 **API Keys** → **Create API Key** → 이름 입력 → 생성
3. `gsk_...` 로 시작하는 키를 복사해 안전한 곳에 저장 (한 번만 보여줌)

### Cloudflare (키를 숨기는 무료 서버)
1. https://dash.cloudflare.com/sign-up 가입 (이메일, 카드 불필요)
2. 도메인 추가 같은 안내는 건너뛰어도 됩니다

## 2. Worker 배포 (이 폴더의 `worker/`)

터미널에서:

```
cd worker
npx wrangler login              # 브라우저가 열리면 "Allow" 클릭
npx wrangler secret put GROQ_API_KEY   # 붙여넣기: gsk_... 키
npx wrangler deploy
```

마지막 명령이 끝나면 `https://translater-api.<계정이름>.workers.dev` 형태의 주소가 출력됩니다.

## 3. 앱에 주소 연결

`config.js` 를 열어 주소를 넣습니다:

```js
window.TRANSLATER_API_URL = 'https://translater-api.<계정이름>.workers.dev';
```

저장 후 GitHub에 푸시하면 1~2분 뒤 https://songglee97.github.io/translater/ 에 반영됩니다.

## 동작 확인
- 마이크를 누르면 "녹음 중 0:03" 처럼 시간이 올라갑니다 (실시간 자막은 이 모드에서 표시되지 않습니다).
- 다시 누르면 2~4초 뒤 정리된 원문과 번역이 함께 나타나고 음성으로 읽어 줍니다.
- 문제가 생기면 화면 아래 상태 줄에 원인이 표시됩니다.

## 되돌리기
`config.js` 의 주소를 `''` 로 비우면 예전 브라우저 내장 모드로 돌아갑니다.
