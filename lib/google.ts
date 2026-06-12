import { google } from 'googleapis'
import { JWT } from 'google-auth-library'

function getAuth(): JWT {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON 환경변수가 없습니다.')
  const creds = JSON.parse(raw)
  return new JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

export async function loadCurricula(): Promise<Record<string, { subject: string; hours: number; order: number }[]>> {
  const url = process.env.SHEETS_SPREADSHEET_URL
  if (!url) return {}
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = extractSheetId(url)

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '커리큘럼',
  })
  const rows = res.data.values || []
  const result: Record<string, { subject: string; hours: number; order: number }[]> = {}
  for (let i = 1; i < rows.length; i++) {
    const [track, order, subject, hours] = rows[i]
    if (!track || !subject) continue
    if (!result[track]) result[track] = []
    result[track].push({ subject: String(subject), hours: Number(hours) || 0, order: Number(order) || 9999 })
  }
  for (const track of Object.keys(result)) {
    result[track].sort((a, b) => a.order - b.order)
  }
  return result
}

export async function saveCurricula(data: Record<string, { subject: string; hours: number; order: number }[]>) {
  const url = process.env.SHEETS_SPREADSHEET_URL
  if (!url) throw new Error('SHEETS_SPREADSHEET_URL 환경변수가 없습니다.')
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = extractSheetId(url)

  // 시트 존재 확인 또는 생성
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const sheetExists = meta.data.sheets?.some((s) => s.properties?.title === '커리큘럼')
  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: '커리큘럼' } } }] },
    })
  }

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: '커리큘럼' })

  const rows: string[][] = [['트랙명', '순서', '과목명', '시수']]
  for (const [track, items] of Object.entries(data)) {
    items.forEach((c, i) => rows.push([track, String(i + 1), c.subject, String(c.hours)]))
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: '커리큘럼!A1',
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  })
}

export async function getSheetTitles(sheetUrl: string): Promise<string[]> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = extractSheetId(sheetUrl)
  const metaRes = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false })
  return (metaRes.data.sheets ?? []).map((s) => s.properties?.title ?? '')
}

export async function parseTimetableSheet(sheetUrl: string, sheetName?: string): Promise<{ subject: string; hours: number }[]> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = extractSheetId(sheetUrl)

  // 메타데이터 먼저 가져와서 실제 시트 이름 확인
  const metaRes = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false })
  const targetSheet = sheetName
    ? (metaRes.data.sheets ?? []).find((s) => s.properties?.title === sheetName) ?? metaRes.data.sheets?.[0]
    : metaRes.data.sheets?.[0]
  const sheetTitle = (targetSheet?.properties?.title ?? 'Sheet1').replace(/'/g, "\\'")
  const merges = targetSheet?.merges ?? []

  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A:I`,
  })

  const rawRows = valuesRes.data.values ?? []

  // 병합 셀 값 전파: 교과목 열(E-I, index 4-8)에서 병합된 셀의 빈 하위 행에 상단 값을 채워 넣음
  // Google Sheets API는 병합 셀의 맨 위 행만 값을 반환하고 나머지는 '' 반환 → 시간 누락 방지
  const rows: string[][] = rawRows.map((r) => [...r])
  for (const merge of merges) {
    const rowStart = merge.startRowIndex ?? 0
    const rowEnd = merge.endRowIndex ?? 0
    const colStart = merge.startColumnIndex ?? 0
    const colEnd = merge.endColumnIndex ?? 0
    // 교과목 열(단일 열 병합)만 처리
    if (colStart >= 4 && colEnd <= 9 && colEnd - colStart === 1) {
      const topVal = (rows[rowStart]?.[colStart] ?? '').trim()
      if (topVal) {
        for (let r = rowStart + 1; r < rowEnd; r++) {
          while (rows[r].length <= colStart) rows[r].push('')
          if (!(rows[r][colStart] ?? '').trim()) {
            rows[r][colStart] = topVal
          }
        }
      }
    }
  }

  // 10행 이상 병합된 셀(요일 열 E-I) = 휴일
  const holidayValues = new Set<string>()
  for (const merge of merges) {
    const rowSpan = (merge.endRowIndex ?? 0) - (merge.startRowIndex ?? 0)
    const colStart = merge.startColumnIndex ?? 0
    const colEnd = merge.endColumnIndex ?? 0
    if (rowSpan >= 10 && colStart >= 4 && colEnd <= 9) {
      const val = (rows[merge.startRowIndex ?? 0]?.[colStart] ?? '').trim()
      if (val) holidayValues.add(val)
    }
  }

  const timePattern = /^\d{2}:\d{2}$/

  // 주차별·요일별(Mon→Fri) 순서로 전체 시퀀스 구성
  const weekCols: string[][][] = []
  let curWeek: string[][] | null = null

  for (const row of rows) {
    const isWeekHeader = /^\d+주차$/.test((row[1] ?? '').trim())
    if (isWeekHeader) {
      curWeek = [[], [], [], [], []]
      weekCols.push(curWeek)
    } else if (curWeek && timePattern.test(row[1] ?? '') && row[2] === '~') {
      for (let i = 0; i < 5; i++) curWeek[i].push((row[4 + i] ?? '').trim())
    }
  }

  const sequence: string[] = []
  for (const week of weekCols) {
    for (let c = 0; c < 5; c++) {
      for (const val of week[c]) sequence.push(val)
    }
  }

  // 연속 블록 추출 (휴일·빈 셀·휴게시간은 투명 처리)
  const blocks: { subject: string; hours: number }[] = []
  let curSubject: string | null = null
  let curHours = 0

  for (const val of sequence) {
    if (!val || val.replace(/\s+/g, '') === '휴게시간' || holidayValues.has(val)) continue
    if (val === curSubject) {
      curHours++
    } else {
      if (curSubject !== null) blocks.push({ subject: curSubject, hours: curHours })
      curSubject = val
      curHours = 1
    }
  }
  if (curSubject !== null) blocks.push({ subject: curSubject, hours: curHours })

  // 같은 과목이 여러 블록으로 쪼개진 경우 집계 (첫 등장 순서 유지)
  const subjectOrder: string[] = []
  const subjectHours = new Map<string, number>()
  for (const block of blocks) {
    if (!subjectHours.has(block.subject)) {
      subjectOrder.push(block.subject)
      subjectHours.set(block.subject, 0)
    }
    subjectHours.set(block.subject, (subjectHours.get(block.subject) || 0) + block.hours)
  }

  return subjectOrder.map((subject) => ({ subject, hours: subjectHours.get(subject)! }))
}

export async function createTimetableSheet(
  rows: string[][],
  folderId: string,
  title: string,
  headerColor: { red: number; green: number; blue: number },
  breakColor: { red: number; green: number; blue: number }
): Promise<string> {
  const auth = getAuth()
  await auth.authorize()
  const token = (await auth.getAccessToken()).token

  // Drive API로 폴더에 직접 생성
  const driveRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId],
    }),
  })
  if (!driveRes.ok) {
    const err = await driveRes.json()
    throw new Error(`Drive API ${driveRes.status}: ${err?.error?.message || driveRes.statusText}`)
  }
  const fileData = await driveRes.json()
  const fileId = fileData.id
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${fileId}`

  const sheets = google.sheets({ version: 'v4', auth })

  // 데이터 업로드 (B2 시작: 빈 첫 행 + 각 행 앞 빈 A열)
  const upload: string[][] = [Array(9).fill('')]
  for (const row of rows) upload.push(['', ...row])
  await sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values: upload },
  })

  // 서식 적용
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: fileId })
  const gid = sheetMeta.data.sheets?.[0].properties?.sheetId ?? 0
  await applyFormat(sheets, fileId, gid, rows, headerColor, breakColor)

  return sheetUrl
}

function extractSheetId(url: string): string {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : url
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return { red: parseInt(h.slice(0, 2), 16) / 255, green: parseInt(h.slice(2, 4), 16) / 255, blue: parseInt(h.slice(4, 6), 16) / 255 }
}

async function applyFormat(
  sheets: ReturnType<typeof google.sheets>,
  fileId: string,
  gid: number,
  rows: string[][],
  headerColor: { red: number; green: number; blue: number },
  breakColor: { red: number; green: number; blue: number }
) {
  const RO = 1, CO = 1
  const BLACK = { red: 0, green: 0, blue: 0 }
  const RED = { red: 1, green: 0, blue: 0 }
  const BORDER = { style: 'SOLID', width: 1, color: BLACK }

  function rng(r1: number, r2: number, c1: number, c2: number) {
    return { sheetId: gid, startRowIndex: r1 + RO, endRowIndex: r2 + RO, startColumnIndex: c1 + CO, endColumnIndex: c2 + CO }
  }

  const reqs: object[] = []

  // 열 너비: A=17, B=58, C=14, D=58, E-I=300
  const colWidths = [17, 58, 14, 58, 300, 300, 300, 300, 300]
  colWidths.forEach((px, i) => {
    reqs.push({
      updateDimensionProperties: {
        range: { sheetId: gid, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: 'pixelSize',
      },
    })
  })

  // 행별 서식
  let rowIdx = 0
  while (rowIdx < rows.length) {
    const row = rows[rowIdx]

    // N주차 행
    if (row[0].endsWith('주차') && row[3].endsWith('주차')) {
      const weekRows = countWeekRows(rows, rowIdx)
      // 병합: 주차 텍스트 (col 0-2), 나머지 (col 3-7)
      reqs.push({ mergeCells: { range: rng(rowIdx, rowIdx + 1, 0, 3), mergeType: 'MERGE_ALL' } })
      reqs.push({ mergeCells: { range: rng(rowIdx, rowIdx + 1, 3, 8), mergeType: 'MERGE_ALL' } })
      reqs.push({
        repeatCell: {
          range: rng(rowIdx, rowIdx + 1, 0, 8),
          cell: { userEnteredFormat: { backgroundColor: headerColor, textFormat: { bold: true }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
        },
      })

      // 날짜 행 (rowIdx+1): 헤더색 + 가운데 정렬
      reqs.push({
        repeatCell: {
          range: rng(rowIdx + 1, rowIdx + 2, 0, 8),
          cell: { userEnteredFormat: { backgroundColor: headerColor, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } },
          fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment)',
        },
      })

      // 헤더 행 (rowIdx+2): 헤더색 + 가운데 정렬 + 굵게
      reqs.push({
        repeatCell: {
          range: rng(rowIdx + 2, rowIdx + 3, 0, 8),
          cell: { userEnteredFormat: { backgroundColor: headerColor, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', textFormat: { bold: true } } },
          fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
        },
      })

      // 슬롯 행들
      const slotStart = rowIdx + 3
      const slotEnd = rowIdx + weekRows - 5
      for (let si = slotStart; si < slotEnd; si++) {
        const sRow = rows[si]
        // 시작시간, ~, 종료시간 가운데 정렬
        reqs.push({
          repeatCell: {
            range: rng(si, si + 1, 0, 3),
            cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } },
            fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
          },
        })
        // 교과 셀 wrap + 가운데 정렬
        reqs.push({
          repeatCell: {
            range: rng(si, si + 1, 3, 8),
            cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE', horizontalAlignment: 'CENTER' } },
            fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,horizontalAlignment)',
          },
        })
        // 휴게시간 회색 배경
        for (let ci = 3; ci < 8; ci++) {
          if (sRow[ci] === '휴게시간') {
            reqs.push({
              repeatCell: {
                range: rng(si, si + 1, ci, ci + 1),
                cell: { userEnteredFormat: { backgroundColor: breakColor, horizontalAlignment: 'CENTER' } },
                fields: 'userEnteredFormat(backgroundColor,horizontalAlignment)',
              },
            })
          }
        }
        // 공휴일: 첫 슬롯만 텍스트 있음 → 해당 열 전체 슬롯 병합 + 빨간 글자
        for (let ci = 3; ci < 8; ci++) {
          if (si === slotStart && sRow[ci] !== '' && sRow[ci] !== '휴게시간') {
            // 이 열이 공휴일인지 확인 (슬롯 첫 행에 텍스트 있고 나머지 비어있으면 공휴일)
            const isHolCol = Array.from({ length: slotEnd - slotStart - 1 }, (_, k) =>
              rows[slotStart + 1 + k][ci]
            ).every((v) => v === '')
            if (isHolCol) {
              reqs.push({ mergeCells: { range: rng(slotStart, slotEnd, ci, ci + 1), mergeType: 'MERGE_ALL' } })
              reqs.push({
                repeatCell: {
                  range: rng(slotStart, slotEnd, ci, ci + 1),
                  cell: { userEnteredFormat: { textFormat: { foregroundColor: RED, bold: true }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } },
                  fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)',
                },
              })
            }
          }
        }
      }

      // 푸터 5행: col 0-2 병합, 가운데 정렬
      for (let fi = slotEnd; fi < rowIdx + weekRows; fi++) {
        reqs.push({ mergeCells: { range: rng(fi, fi + 1, 0, 3), mergeType: 'MERGE_ALL' } })
        reqs.push({
          repeatCell: {
            range: rng(fi, fi + 1, 0, 3),
            cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } },
            fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
          },
        })
      }

      // 5개 영역 외곽 테두리만 (내부 선 없음)
      const box = (r1: number, r2: number, c1: number, c2: number) => ({
        updateBorders: { range: rng(r1, r2, c1, c2), top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
      })
      reqs.push(box(rowIdx, rowIdx + 1, 0, 8))              // 주차 행
      reqs.push(box(rowIdx + 1, rowIdx + 3, 0, 3))          // 날짜+헤더 (시간 열 B-D)
      reqs.push(box(slotStart, slotEnd, 0, 3))              // 슬롯 (시간 열 B-D)
      reqs.push(box(rowIdx + 1, slotEnd, 3, 8))             // 날짜+헤더+슬롯 (요일 열 E-I)
      reqs.push(box(slotEnd, rowIdx + weekRows, 0, 8))      // 푸터

      rowIdx += weekRows
    } else {
      rowIdx++
    }
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: fileId,
    requestBody: { requests: reqs },
  })
}

function countWeekRows(rows: string[][], startIdx: number): number {
  // 주차 블록 = 1(주차) + 1(날짜) + 1(헤더) + 슬롯 수 + 5(푸터)
  // 다음 주차 행 또는 끝까지
  for (let i = startIdx + 1; i < rows.length; i++) {
    if (rows[i][0].endsWith('주차') && rows[i][3]?.endsWith('주차')) return i - startIdx
  }
  return rows.length - startIdx
}
