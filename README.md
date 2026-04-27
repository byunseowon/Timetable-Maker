# Timetable Maker

## 기술 스택

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes (서버리스)
- **공휴일**: date-holidays (한국 법정공휴일 자동 계산)
- **Google 연동**: googleapis (Sheets v4, Drive v3)

## 주요 기능

- 시간표 생성 (개강일·수업시간·휴게시간·커리큘럼 설정)
- 법정공휴일 자동 반영 + 체크박스로 개별 수업일 전환
- 직접 추가 휴일 지정
- CSV 다운로드 / Google Drive 폴더에 서식 적용된 시트 저장
- 헤더·휴게시간 배경색 커스터마이징
- 커리큘럼 Supabase 연동 저장·관리
