import { NextRequest, NextResponse } from 'next/server'
import { parseTimetableSheet } from '@/lib/google'

export async function POST(req: NextRequest) {
  try {
    const { sheetUrl } = await req.json()
    if (!sheetUrl) return NextResponse.json({ error: 'sheetUrl 필요' }, { status: 400 })
    const items = await parseTimetableSheet(sheetUrl)
    return NextResponse.json({ items })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
