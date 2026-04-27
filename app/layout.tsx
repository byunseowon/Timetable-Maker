import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '시간표 생성기',
  description: '정부 제출용 교육 시간표 자동 생성',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
