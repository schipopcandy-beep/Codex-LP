'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface TagSummary {
  name: string
  description: string
  count: number
}

interface UserRecord {
  user_id: string
  is_friend: boolean
  followed_at: string | null
  updated_at: string
  tags: string[]
}

interface ApiData {
  summary: TagSummary[]
  users: UserRecord[]
}

// タグを接頭辞ごとに色分け
const TAG_COLOR: Record<string, string> = {
  status_new:         'bg-blue-100 text-blue-700 border-blue-200',
  status_active:      'bg-green-100 text-green-700 border-green-200',
  status_dormant_30d: 'bg-amber-100 text-amber-700 border-amber-200',
  status_dormant_60d: 'bg-red-100 text-red-700 border-red-200',
  visit_1:            'bg-matcha-100 text-matcha-700 border-matcha-200',
  visit_2:            'bg-matcha-100 text-matcha-700 border-matcha-200',
  visit_3plus:        'bg-matcha-100 text-matcha-700 border-matcha-200',
  type_eatin:         'bg-purple-100 text-purple-700 border-purple-200',
  type_takeout:       'bg-purple-100 text-purple-700 border-purple-200',
  source_qr_table:    'bg-cream-200 text-brown-700 border-cream-300',
  source_qr_takeout:  'bg-cream-200 text-brown-700 border-cream-300',
  source_instagram:   'bg-pink-100 text-pink-700 border-pink-200',
}

function tagColor(name: string) {
  return TAG_COLOR[name] ?? 'bg-gray-100 text-gray-600 border-gray-200'
}

// 接頭辞グループ
const PREFIX_ORDER = ['status', 'visit', 'type', 'source']
function prefixLabel(prefix: string) {
  return { status: 'ステータス', visit: '来店回数', type: '利用タイプ', source: '流入元' }[prefix] ?? prefix
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return '今日'
  if (d === 1) return '昨日'
  if (d < 30) return `${d}日前`
  if (d < 365) return `${Math.floor(d / 30)}ヶ月前`
  return `${Math.floor(d / 365)}年前`
}

export default function LineTagsPage() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterTag, setFilterTag] = useState<string>('')

  const load = useCallback(async (tag: string) => {
    setLoading(true)
    const url = tag ? `/api/admin/line-tags?tag=${encodeURIComponent(tag)}` : '/api/admin/line-tags'
    const res = await fetch(url)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load(filterTag) }, [filterTag, load])

  const grouped = data
    ? PREFIX_ORDER.map((prefix) => ({
        prefix,
        label: prefixLabel(prefix),
        tags: data.summary.filter((t) => t.name.startsWith(prefix + '_')),
      }))
    : []

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin" className="text-brown-500 hover:text-brown-700 text-base">
          ← 一覧
        </Link>
        <h1 className="section-title text-2xl">LINEタグ管理</h1>
      </div>

      {loading && !data && (
        <div className="text-center py-20 text-brown-400 text-lg">読み込み中...</div>
      )}

      {data && (
        <div className="space-y-5">

          {/* タグ集計サマリー */}
          {grouped.map(({ prefix, label, tags }) => (
            <div key={prefix} className="card p-4">
              <h2 className="text-xs font-bold text-brown-400 uppercase tracking-wide mb-3">
                {label}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {tags.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setFilterTag(filterTag === t.name ? '' : t.name)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 border text-left transition-all ${
                      filterTag === t.name
                        ? 'ring-2 ring-brown-500 ' + tagColor(t.name)
                        : tagColor(t.name) + ' opacity-90 hover:opacity-100'
                    }`}
                  >
                    <span className="text-xs font-mono font-semibold truncate mr-2">
                      {t.name}
                    </span>
                    <span className="text-lg font-bold tabular-nums shrink-0">
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* フィルタ中のラベル */}
          {filterTag && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-brown-600">
                フィルタ中:
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded-lg border ${tagColor(filterTag)}`}>
                {filterTag}
              </span>
              <button
                onClick={() => setFilterTag('')}
                className="text-xs text-brown-400 hover:text-brown-700 underline"
              >
                解除
              </button>
            </div>
          )}

          {/* ユーザー一覧 */}
          <div className="card p-4">
            <h2 className="font-bold text-brown-700 mb-3">
              友だち一覧
              <span className="ml-2 text-sm font-normal text-brown-400">
                {data.users.length}人{filterTag ? '（絞り込み中）' : ''}
              </span>
            </h2>

            {data.users.length === 0 ? (
              <p className="text-center text-brown-400 py-8 text-sm">
                {filterTag ? 'このタグを持つユーザーはいません' : '友だちがいません'}
              </p>
            ) : (
              <div className="space-y-3">
                {data.users.map((u) => (
                  <div key={u.user_id} className="border border-cream-300 rounded-xl p-3">
                    {/* ユーザーID + 最終更新 */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-brown-500 truncate mr-2">
                        {u.user_id.slice(0, 12)}…
                      </span>
                      <span className="text-xs text-brown-400 shrink-0">
                        {relativeTime(u.updated_at)}
                      </span>
                    </div>

                    {/* タグ一覧 */}
                    {u.tags.length === 0 ? (
                      <span className="text-xs text-brown-300 italic">タグなし</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`text-xs font-mono px-2 py-0.5 rounded-lg border ${tagColor(tag)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
