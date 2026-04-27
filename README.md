# Timetable Maker (React/Next.js)

정부 제출용 교육 시간표 자동 생성 웹앱 — Vercel 배포용 Next.js 버전.

## 기술 스택

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes (서버리스)
- **공휴일**: date-holidays (한국 법정공휴일 자동 계산)
- **Google 연동**: googleapis (Sheets v4, Drive v3)

## 로컬 실행

### 1. 패키지 설치
```bash
npm install
```

### 2. 환경변수 설정
`.env.local.example`을 `.env.local`로 복사 후 실제 값 입력:
```bash
cp .env.local.example .env.local
```

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account", ...전체 JSON...}
SHEETS_SPREADSHEET_URL=https://docs.google.com/spreadsheets/d/YOUR_ID/edit
```

### 3. 실행
```bash
npm run dev
```
→ http://localhost:3000

## Vercel 배포

1. GitHub에 push
2. Vercel 대시보드에서 레포 연결
3. **Environment Variables** 탭에서 `.env.local` 값 동일하게 입력
4. Deploy

> `GOOGLE_SERVICE_ACCOUNT_JSON`은 JSON 전체를 한 줄로 붙여넣습니다.

## 주요 기능

- 시간표 생성 (개강일·수업시간·휴게시간·커리큘럼 설정)
- 법정공휴일 자동 반영 + 체크박스로 개별 수업일 전환
- 직접 추가 휴일 지정
- CSV 다운로드 / Google Drive 폴더에 서식 적용된 시트 저장
- 헤더·휴게시간 배경색 커스터마이징
- 커리큘럼 Google Sheets 연동 저장·관리
