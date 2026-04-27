'use client'
import { useRef, useCallback } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CurriculumItem } from '@/lib/types'

interface Props {
  value: CurriculumItem[]
  onChange: (v: CurriculumItem[]) => void
}

interface RowItem extends CurriculumItem {
  id: string
}

function toItems(value: CurriculumItem[]): RowItem[] {
  return value.map((c, i) => ({ ...c, id: `item-${i}-${c.subject}` }))
}

function fromItems(items: RowItem[]): CurriculumItem[] {
  return items.map((item, i) => ({ subject: item.subject, hours: item.hours, order: i + 1 }))
}

function SortableRow({
  item, index, onChange, onRemove,
}: {
  item: RowItem; index: number
  onChange: (i: number, field: 'subject' | 'hours', val: string | number) => void
  onRemove: (i: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <tr ref={setNodeRef} style={style} className="group">
      {/* 드래그 핸들 */}
      <td className="w-8 px-2 py-2 text-center">
        <button
          {...listeners} {...attributes}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none touch-none"
          tabIndex={-1}
        >
          ⠿
        </button>
      </td>
      {/* 순서 (자동) */}
      <td className="w-10 px-2 py-1.5 text-center text-sm text-gray-400 font-mono">{index + 1}</td>
      {/* 과목명 */}
      <td className="px-2 py-1.5">
        <input
          type="text"
          className="input py-1.5"
          value={item.subject}
          placeholder="과목명"
          onChange={(e) => onChange(index, 'subject', e.target.value)}
        />
      </td>
      {/* 시수 */}
      <td className="w-24 px-2 py-1.5">
        <input
          type="number"
          className="input py-1.5 text-left"
          value={item.hours || ''}
          min={0}
          placeholder="0"
          onChange={(e) => onChange(index, 'hours', Number(e.target.value))}
        />
      </td>
      {/* 삭제 */}
      <td className="w-8 px-1 py-1.5 text-center">
        <button
          onClick={() => onRemove(index)}
          className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

export default function EditableTable({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const items = toItems(value.length > 0 ? value : [])

  const updateItem = useCallback((i: number, field: 'subject' | 'hours', val: string | number) => {
    const next = items.map((r, j) => j === i ? { ...r, [field]: val } : r)
    onChange(fromItems(next))
  }, [items, onChange])

  const removeItem = useCallback((i: number) => {
    onChange(fromItems(items.filter((_, j) => j !== i)))
  }, [items, onChange])

  const addRow = () => onChange(fromItems([...items, { id: `new-${Date.now()}`, subject: '', hours: 0, order: items.length + 1 }]))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex((i) => i.id === active.id)
    const newIdx = items.findIndex((i) => i.id === over.id)
    onChange(fromItems(arrayMove(items, oldIdx, newIdx)))
  }

  // 붙여넣기: Excel/Sheets에서 복사한 탭 구분 데이터 처리
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\t') && !text.includes('\n')) return
    e.preventDefault()

    const rows = text.trim().split(/\r?\n/).filter(Boolean)
    const parsed: CurriculumItem[] = []

    for (const row of rows) {
      const cols = row.split('\t').map((c) => c.trim())
      if (cols.length === 0 || cols.every((c) => !c)) continue

      if (cols.length === 1) {
        // 과목명만
        parsed.push({ subject: cols[0], hours: 0 })
      } else if (cols.length === 2) {
        // 과목명 + 시수
        const hours = Number(cols[1].replace(/[^0-9]/g, '')) || 0
        parsed.push({ subject: cols[0], hours })
      } else {
        // 3열 이상: 숫자가 있는 열 찾기
        const numIdx = cols.findIndex((c) => /^\d+$/.test(c))
        if (numIdx > 0) {
          parsed.push({ subject: cols[numIdx - 1], hours: Number(cols[numIdx]) })
        } else {
          parsed.push({ subject: cols[0], hours: Number(cols[1]) || 0 })
        }
      }
    }

    if (parsed.length > 0) {
      // 기존 비어있는 행 대체, 내용 있으면 추가
      const hasContent = items.some((r) => r.subject.trim())
      const base = hasContent ? items : []
      onChange(fromItems([...base, ...parsed].map((c, i) => ({ ...c, id: `p-${i}`, order: i + 1 }))))
    }
  }

  const totalHours = value.reduce((s, c) => s + (c.hours || 0), 0)

  return (
    <div ref={containerRef} onPaste={handlePaste}>
      <div className="overflow-hidden rounded-xl border border-black/[0.06]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-black/[0.06]">
              <th className="w-8 px-2 py-2.5"></th>
              <th className="w-10 px-2 py-2.5 text-left text-xs font-semibold text-gray-400">#</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400">과목명</th>
              <th className="w-24 px-3 py-2.5 text-left text-xs font-semibold text-gray-400">시수(h)</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <tbody className="divide-y divide-black/[0.04]">
                {items.map((item, i) => (
                  <SortableRow key={item.id} item={item} index={i} onChange={updateItem} onRemove={removeItem} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <button className="btn-ghost text-xs py-1" onClick={addRow}>+ 행 추가</button>
        <span className="text-xs text-gray-400 font-medium">총 <span className="text-gray-700">{totalHours}</span>시간</span>
      </div>

      <p className="mt-1.5 text-xs text-gray-300">
        Excel/Sheets에서 복사 후 표 위에서 Ctrl+V로 붙여넣기 가능 · 행 왼쪽 점선을 드래그해 순서 변경
      </p>
    </div>
  )
}
