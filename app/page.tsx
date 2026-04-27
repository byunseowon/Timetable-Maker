'use client'
import { useState } from 'react'
import TimetableTab from '@/components/TimetableTab'
import CurriculumTab from '@/components/CurriculumTab'

const TABS = ['새 시간표 생성', '커리큘럼 관리']

export default function Home() {
  const [tab, setTab] = useState(0)
  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">시간표 생성기</h1>
        <p className="text-gray-400 mt-1 text-sm">정부 제출용 교육 시간표 자동 생성</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-black/[0.05] rounded-xl p-1 mb-6 w-fit">
        {TABS.map((name, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={`px-5 py-2 rounded-[10px] text-sm font-medium transition-all ${
              tab === i
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 0 && <TimetableTab />}
      {tab === 1 && <CurriculumTab />}
    </div>
  )
}
