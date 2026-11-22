# YouTube Mixer

유튜브 링크로 2채널 DJ 믹싱을 해볼 수 있는 웹앱입니다. (React + Vite + Web Audio API)

- 배포: Vercel(`youtube-mixer-five.vercel.app`) · GitHub Pages(`kitene0204.github.io/Youtube_Mixer`) 둘 다 `main` 브랜치 push 시 자동 배포됩니다.
- 로컬 실행: `npm ci` → `npm run dev`

## 대체 영상 검색 기능 (선택 사항)

유튜브 영상 중 일부는 저작권자가 "다른 사이트에서 재생 금지"로 설정해 둬서 임베드 플레이어로는
절대 재생할 수 없습니다 (재생 중 **오류 101 / 150**으로 표시됨, 공식 뮤직비디오·`-Topic` 채널 업로드에 흔함).

이 경우 데크 화면에 **🔍 비슷한 영상 찾기** 버튼이 나타납니다. 누르면 유튜브 Data API로 같은
제목의 **임베드 가능한** 다른 업로드를 검색해서 목록으로 보여주고, 클릭하면 바로 그 영상을 불러옵니다.

이 기능은 유튜브 API 키가 설정되어 있을 때만 동작하고, 키가 없으면 버튼 자체가 보이지 않을 뿐 앱의
나머지 기능에는 전혀 영향이 없습니다.

### 키 만들기

1. [Google Cloud Console](https://console.cloud.google.com)에서 프로젝트를 만들고 **YouTube Data API v3**를 사용 설정합니다.
2. "API 및 서비스 → 사용자 인증 정보 → API 키 만들기"로 키를 발급받습니다.
3. 만든 키를 열어 **애플리케이션 제한사항을 "HTTP 리퍼러(웹사이트)"**로 설정하고, 아래 도메인을 등록합니다.
   - `https://youtube-mixer-five.vercel.app/*`
   - `https://kitene0204.github.io/*`
   - (로컬 개발용으로) `http://localhost:3000/*`

   > 이 앱은 서버가 없는 정적 사이트라 API 호출을 브라우저에서 직접 하고, 그 과정에서 키가 번들 코드에
   > 그대로 노출됩니다. 그래서 리퍼러 제한을 꼭 걸어야 다른 사이트가 내 키/쿼터를 가져다 쓰는 걸 막을 수 있습니다.

### 키 등록하기

| 환경 | 방법 |
|---|---|
| 로컬 개발 | `.env.example`을 복사해 `.env`를 만들고 `VITE_YT_API_KEY=발급받은키` 입력 |
| Vercel | 프로젝트 → Settings → Environment Variables → `VITE_YT_API_KEY` 추가 후 재배포 |
| GitHub Pages | 저장소 → Settings → Secrets and variables → Actions → New repository secret 이름 `VITE_YT_API_KEY` (워크플로에 이미 연결되어 있음) |

쿼터 참고: 검색 1회에 100 unit이 소모되며, 기본 일일 한도는 10,000 unit(하루 약 100회 검색)입니다.
