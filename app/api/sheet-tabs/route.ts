import { NextRequest, NextResponse } from 'next/server'
import { getSheetTitles } from '@/lib/google'

export async function POST(req: NextRequest) {
  try {
    const { sheetUrl } = await req.json()
    if (!sheetUrl) return NextResponse.json({ error: 'sheetUrl 필요' }, { status: 400 })
    const titles = await getSheetTitles(sheetUrl)
    return NextResponse.json({ titles })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
