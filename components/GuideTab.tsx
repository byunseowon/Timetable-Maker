'use client'

const sections = [
  {
    title: '새 시간표 생성',
    steps: [
      {
        step: '1. 기본 설정',
        desc: '개강일, 수업 시작/종료 시각, 휴게시간 수와 시작 시각을 입력합니다. 주말 제외 및 법정공휴일 제외 여부를 체크박스로 선택할 수 있습니다.',
      },
      {
        step: '2. 추가 휴일',
        desc: '법정공휴일 외 별도로 쉬는 날(행사, 방학 등)을 날짜와 사유를 입력해 추가합니다. 등록한 날은 시간표에서 자동으로 제외됩니다.',
      },
      {
        step: '3. 커리큘럼 선택',
        desc: '드롭다운에서 저장된 커리큘럼을 선택하면 과목과 시수가 자동으로 채워집니다. 직접 입력도 가능합니다.',
      },
      {
        step: '4. 공휴일 미리 확인',
        desc: '적용 예정 법정공휴일 목록을 미리 확인합니다. 체크를 해제하면 해당 날을 수업일로 전환할 수 있습니다.',
      },
      {
        step: '5. 시간표 생성',
        desc: '공휴일 확인 후 시간표 생성 버튼을 누르면 주차별 시간표가 완성됩니다.',
      },
      {
        step: '6. 저장',
        desc: 'CSV 다운로드 또는 구글 드라이브 폴더 URL을 입력해 구글 시트로 저장할 수 있습니다. 구글 시트 저장 시 서식(색상, 병합, 테두리)이 자동 적용됩니다.',
      },
    ],
  },
  {
    title: '커리큘럼 관리',
    steps: [
      {
        step: '새 커리큘럼 추가',
        desc: '트랙명을 입력하고 과목명·시수 표를 작성합니다. 엑셀/구글 시트에서 복사한 표를 그대로 붙여넣기(Ctrl+V)할 수 있습니다. 순서는 숫자로 직접 입력하거나 드래그로 변경합니다.',
      },
      {
        step: '저장된 커리큘럼 편집',
        desc: '드롭다운에서 트랙을 선택해 내용을 수정하거나 삭제합니다. 변경 후 저장 버튼을 누르면 반영됩니다.',
      },
    ],
  },
  {
    title: '구글 시트 저장 사용 조건',
    steps: [
      {
        step: '폴더 권한 설정',
        desc: '저장할 구글 드라이브 폴더에 서비스 계정 이메일을 편집자로 공유해야 합니다. 공유하지 않으면 저장 시 권한 오류가 발생합니다.',
      },
      {
        step: '폴더 URL 입력',
        desc: '구글 드라이브 폴더를 열고 주소창의 URL 전체를 붙여넣습니다.',
      },
    ],
  },
]

export default function GuideTab() {
  return (
    <div className="space-y-4">
      {sections.map((sec) => (
        <div key={sec.title} className="card space-y-4">
          <h2 className="section-title">{sec.title}</h2>
          <div className="space-y-3">
            {sec.steps.map((s) => (
              <div key={s.step} className="flex gap-3">
                <span className="text-sm font-semibold text-blue-500 whitespace-nowrap pt-0.5">{s.step}</span>
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
