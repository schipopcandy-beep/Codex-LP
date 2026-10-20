'use client'

import { useState } from 'react'
import type { CartItem } from '@/lib/types'
import { optionLabel } from '@/lib/types'

/** カートの行ごとに、1個ずつの注文者番号（1始まり）。配列の長さ = その行の個数 */
export type DinerAssignment = Map<CartItem, number[]>

interface Props {
  /** 分ける対象（店内で食べるおにぎりの行） */
  items: CartItem[]
  partySize: number
  isSubmitting: boolean
  onConfirm: (assignment: DinerAssignment) => void
  onCancel: () => void
}

/**
 * 注文を確定する直前に、おにぎりを注文者ごとに分けてもらう画面
 * 同じ人のおにぎりを1皿にまとめて出すために使う
 */
export default function DinerSplitPopup({ items, partySize, isSubmitting, onConfirm, onCancel }: Props) {
  /** おにぎり1個ずつに分解したもの */
  const units = items.flatMap((item) =>
    Array.from({ length: item.quantity }, (_, i) => ({ item, index: i })),
  )
  /** units と同じ順の注文者番号（0 = まだ選んでいない） */
  const [diners, setDiners] = useState<number[]>(() => units.map(() => 0))
  const people = Array.from({ length: partySize }, (_, i) => i + 1)
  const allAssigned = diners.every((d) => d > 0)

  const toAssignment = (values: number[]): DinerAssignment => {
    const result: DinerAssignment = new Map()
    units.forEach((u, i) => result.set(u.item, [...(result.get(u.item) ?? []), values[i]]))
    return result
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-cream-50 rounded-2xl shadow-2xl p-5 w-full max-w-md space-y-4 max-h-[90dvh] overflow-y-auto">
        <div className="text-center space-y-1">
          <h3 className="text-xl font-bold text-brown-800">どなたのおにぎりですか？</h3>
          <p className="text-sm text-brown-500">
            お一人ずつ1皿にまとめてお出しします。
            <br />
            おにぎりごとに、召し上がる方の番号を選んでください。
          </p>
        </div>

        <div className="space-y-3">
          {units.map((u, i) => {
            const options = optionLabel(u.item)
            return (
              <div key={i} className="space-y-1.5">
                <p className="text-sm font-bold text-brown-800">
                  {u.item.product.name}
                  {options && <span className="text-brown-500 font-normal ml-1">（{options}）</span>}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {people.map((n) => {
                    const selected = diners[i] === n
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setDiners((prev) => prev.map((d, k) => (k === i ? n : d)))}
                        aria-pressed={selected}
                        className={`min-w-14 px-3 py-2 rounded-full text-sm font-bold border-2 ${
                          selected
                            ? 'bg-brown-600 border-brown-600 text-white'
                            : 'bg-white border-cream-300 text-brown-600 active:bg-cream-200'
                        }`}
                      >
                        {n}人目
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => onConfirm(toAssignment(diners))}
            disabled={!allAssigned || isSubmitting}
            className="btn-primary w-full text-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '送信中...' : allAssigned ? '注文を確定する' : 'すべて選ぶと確定できます'}
          </button>
          <button type="button" onClick={onCancel} className="w-full py-2 text-sm text-brown-400">
            注文内容に戻る
          </button>
        </div>
      </div>
    </div>
  )
}
