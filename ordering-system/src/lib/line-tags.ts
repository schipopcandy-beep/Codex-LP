/**
 * LINE タグ操作ユーティリティ
 *
 * タグ命名規則（snake_case・接頭辞分類）:
 *   status_*  : ユーザーステータス
 *   visit_*   : 来店回数
 *   type_*    : 利用タイプ
 *   source_*  : 流入元
 *
 * 重要: すべての操作は service_role クライアント経由で実行すること
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================
// タグ定数
// ============================================================

export const TAGS = {
  // ステータス（排他: 1ユーザーにつき1つ）
  STATUS_NEW:         'status_new',
  STATUS_ACTIVE:      'status_active',
  STATUS_DORMANT_30D: 'status_dormant_30d',
  STATUS_DORMANT_60D: 'status_dormant_60d',

  // 来店回数（排他: 1ユーザーにつき1つ）
  VISIT_1:    'visit_1',
  VISIT_2:    'visit_2',
  VISIT_3PLUS: 'visit_3plus',

  // 利用タイプ（複数付与可）
  TYPE_EATIN:   'type_eatin',
  TYPE_TAKEOUT: 'type_takeout',

  // 流入元（複数付与可）
  SOURCE_QR_TABLE:    'source_qr_table',
  SOURCE_QR_TAKEOUT:  'source_qr_takeout',
  SOURCE_INSTAGRAM:   'source_instagram',
} as const

export type TagName = typeof TAGS[keyof typeof TAGS]

/** 排他的なステータスタグ（1ユーザーにつき1つしか持てない） */
const STATUS_TAGS: TagName[] = [
  TAGS.STATUS_NEW,
  TAGS.STATUS_ACTIVE,
  TAGS.STATUS_DORMANT_30D,
  TAGS.STATUS_DORMANT_60D,
]

/** 排他的な来店回数タグ */
const VISIT_TAGS: TagName[] = [
  TAGS.VISIT_1,
  TAGS.VISIT_2,
  TAGS.VISIT_3PLUS,
]

// ============================================================
// 内部ヘルパー
// ============================================================

/** タグ名 → tag.id のマップを取得（キャッシュなし・毎回DBから取得） */
async function fetchTagIds(
  supabase: SupabaseClient,
  names: string[],
): Promise<Map<string, string>> {
  if (names.length === 0) return new Map()

  const { data, error } = await supabase
    .from('line_tags')
    .select('id, name')
    .in('name', names)

  if (error) throw new Error(`line_tags fetch failed: ${error.message}`)

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.name, row.id)
  }
  return map
}

// ============================================================
// 公開API
// ============================================================

/**
 * ユーザーにタグを付与する
 * 同じタグが既に付与されていても安全（UPSERT）
 */
export async function assignTags(
  supabase: SupabaseClient,
  userId: string,
  tagNames: TagName[],
): Promise<void> {
  if (tagNames.length === 0) return

  const tagIds = await fetchTagIds(supabase, tagNames)
  const rows = tagNames
    .map((name) => tagIds.get(name))
    .filter((id): id is string => !!id)
    .map((tag_id) => ({
      user_id: userId,
      tag_id,
      assigned_at: new Date().toISOString(),
    }))

  if (rows.length === 0) return

  const { error } = await supabase
    .from('line_user_tags')
    .upsert(rows, { onConflict: 'user_id,tag_id', ignoreDuplicates: true })

  if (error) throw new Error(`assignTags failed: ${error.message}`)
}

/**
 * ユーザーからタグを外す
 * 持っていないタグを指定しても安全
 */
export async function removeTags(
  supabase: SupabaseClient,
  userId: string,
  tagNames: TagName[],
): Promise<void> {
  if (tagNames.length === 0) return

  const tagIds = await fetchTagIds(supabase, tagNames)
  const ids = tagNames.map((n) => tagIds.get(n)).filter((id): id is string => !!id)
  if (ids.length === 0) return

  const { error } = await supabase
    .from('line_user_tags')
    .delete()
    .eq('user_id', userId)
    .in('tag_id', ids)

  if (error) throw new Error(`removeTags failed: ${error.message}`)
}

/**
 * タグを付け替える（remove → assign を1トランザクションとして扱う）
 * 排他タグ（status / visit）の切り替えに使用
 */
export async function swapTags(
  supabase: SupabaseClient,
  userId: string,
  remove: TagName[],
  add: TagName[],
): Promise<void> {
  await removeTags(supabase, userId, remove)
  await assignTags(supabase, userId, add)
}

/**
 * ユーザーが現在持つタグ名一覧を返す
 */
export async function getUserTags(
  supabase: SupabaseClient,
  userId: string,
): Promise<TagName[]> {
  const { data, error } = await supabase
    .from('line_user_tags')
    .select('line_tags(name)')
    .eq('user_id', userId)

  if (error) throw new Error(`getUserTags failed: ${error.message}`)

  // Supabase はネストされたリレーションを配列で返す
  return (data ?? [])
    .flatMap((row) => {
      const tags = row.line_tags
      if (!tags) return []
      if (Array.isArray(tags)) return (tags as { name: string }[]).map((t) => t.name)
      return [(tags as { name: string }).name]
    })
    .filter((name): name is TagName => !!name)
}

// ============================================================
// 自動化ロジック
// ============================================================

/**
 * 【自動化①】友だち追加時
 * - status_new を付与
 */
export async function onFriendAdded(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await assignTags(supabase, userId, [TAGS.STATUS_NEW])
}

/**
 * 【自動化②〜④】注文完了時（paid になったとき）
 *
 * @param orderType 'eatin' | 'takeout' - 利用タイプ
 *
 * ロジック:
 *   現在のvisitタグを確認して次の段階へ進める
 *   初回: status_new → status_active、visit_1 付与
 *   2回目: visit_1 → visit_2
 *   3回目以降: visit_2 → visit_3plus (visit_3plus は累積でそのまま)
 *   休眠からの復帰: dormant系 → status_active
 */
export async function onOrderCompleted(
  supabase: SupabaseClient,
  userId: string,
  orderType: 'eatin' | 'takeout',
): Promise<void> {
  const currentTags = await getUserTags(supabase, userId)
  const has = (tag: TagName) => currentTags.includes(tag)

  const toRemove: TagName[] = []
  const toAdd: TagName[] = []

  // --- status 更新 ---
  if (has(TAGS.STATUS_NEW)) {
    // 初回注文: new → active
    toRemove.push(TAGS.STATUS_NEW)
    toAdd.push(TAGS.STATUS_ACTIVE)
  } else if (has(TAGS.STATUS_DORMANT_30D) || has(TAGS.STATUS_DORMANT_60D)) {
    // 休眠からの復帰
    toRemove.push(...STATUS_TAGS)
    toAdd.push(TAGS.STATUS_ACTIVE)
  }
  // status_active はそのまま維持

  // --- visit カウント更新 ---
  if (!has(TAGS.VISIT_1) && !has(TAGS.VISIT_2) && !has(TAGS.VISIT_3PLUS)) {
    // 初回注文
    toAdd.push(TAGS.VISIT_1)
  } else if (has(TAGS.VISIT_1)) {
    // 2回目
    toRemove.push(TAGS.VISIT_1)
    toAdd.push(TAGS.VISIT_2)
  } else if (has(TAGS.VISIT_2)) {
    // 3回目以降
    toRemove.push(TAGS.VISIT_2)
    toAdd.push(TAGS.VISIT_3PLUS)
  }
  // visit_3plus の場合はそのまま（累積なので外さない）

  // --- 利用タイプ付与（累積・外さない） ---
  if (orderType === 'eatin' && !has(TAGS.TYPE_EATIN)) {
    toAdd.push(TAGS.TYPE_EATIN)
  } else if (orderType === 'takeout' && !has(TAGS.TYPE_TAKEOUT)) {
    toAdd.push(TAGS.TYPE_TAKEOUT)
  }

  await swapTags(supabase, userId, toRemove, toAdd)
}

/**
 * 【自動化⑤⑥】休眠検出（バッチ処理用）
 *
 * 最終注文から指定日数以上経過したユーザーを休眠扱いにする。
 * 呼び出し元（cron API）が days=30 / days=60 で2回呼ぶ想定。
 *
 * @param days 30 または 60
 * @returns 更新したユーザー数
 */
export async function markDormantUsers(
  supabase: SupabaseClient,
  days: 30 | 60,
): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  // 対象: 最終注文が cutoff より古い（または注文なし）かつ is_friend=true のユーザー
  const { data: candidates, error } = await supabase
    .from('line_users')
    .select('user_id')
    .eq('is_friend', true)

  if (error) throw new Error(`markDormantUsers fetch failed: ${error.message}`)

  let updated = 0
  for (const { user_id } of candidates ?? []) {
    // 最終注文日を確認
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('updated_at')
      .eq('line_user_id', user_id)
      .eq('status', 'paid')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastOrderDate = lastOrder ? new Date(lastOrder.updated_at) : null
    if (lastOrderDate && lastOrderDate >= cutoff) continue // まだ休眠でない

    const currentTags = await getUserTags(supabase, user_id)
    const has = (tag: TagName) => currentTags.includes(tag)

    // 60日休眠
    if (days === 60 && !has(TAGS.STATUS_DORMANT_60D)) {
      await swapTags(supabase, user_id, STATUS_TAGS, [TAGS.STATUS_DORMANT_60D])
      updated++
    }
    // 30日休眠（60日には昇格させない）
    else if (
      days === 30 &&
      !has(TAGS.STATUS_DORMANT_30D) &&
      !has(TAGS.STATUS_DORMANT_60D) &&
      has(TAGS.STATUS_ACTIVE)
    ) {
      await swapTags(supabase, user_id, STATUS_TAGS, [TAGS.STATUS_DORMANT_30D])
      updated++
    }
  }

  return updated
}

/**
 * 【自動化⑦】流入元タグ付与
 * - QR/SNSなど流入元が判明した時点で呼ぶ
 */
export async function assignSourceTag(
  supabase: SupabaseClient,
  userId: string,
  source: 'qr_table' | 'qr_takeout' | 'instagram',
): Promise<void> {
  const tagMap = {
    qr_table:   TAGS.SOURCE_QR_TABLE,
    qr_takeout: TAGS.SOURCE_QR_TAKEOUT,
    instagram:  TAGS.SOURCE_INSTAGRAM,
  } as const

  await assignTags(supabase, userId, [tagMap[source]])
}
