import { NextRequest, NextResponse } from 'next/server'
import { createTimetableSheet } from '@/lib/google'

function extractFolderId(urlOrId: string): string {
  const m = urlOrId.match(/folders\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : urlOrId.trim()
}

export async function POST(req: NextRequest) {
  try {
    const { rows, folderUrl, title, headerColor, breakColor } = await req.json()
    const folderId = extractFolderId(folderUrl)
    const url = await createTimetableSheet(rows, folderId, title, headerColor, breakColor)
    return NextResponse.json({ url })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
