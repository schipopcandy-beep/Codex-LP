import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { orderShortId } from '@/lib/types'

const LINE_API_BASE = 'https://api.line.me/v2/bot'

/** LINE IDの下位を伏せて表示する（画面に出しても差し支えない形にする） */
function maskUserId(userId: string): string {
  return `${userId.slice(0, 9)}…`
}

/**
 * LINE連携の状態を確認する診断用エンドポイント
 *
 * ブラウザで /api/admin/line-status を開くと次を返す:
 *   - アクセストークンが有効か
 *   - 直近のテイクアウト注文にLINE IDが付いているか
 *   - そのお客様が友だち登録済みか
 *
 * テイクアウト注文後のメッセージが届かないときの原因切り分けに使う。
 */
export async function GET() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

  if (!token) {
    return NextResponse.json({
      ok: false,
      cause: 'トークン未設定',
      detail: 'Vercelの環境変数 LINE_CHANNEL_ACCESS_TOKEN が設定されていません。',
    })
  }

  const infoRes = await fetch(`${LINE_API_BASE}/info`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!infoRes.ok) {
    return NextResponse.json({
      ok: false,
      cause:
        infoRes.status === 401
          ? 'トークンが無効または失効しています'
          : `LINE APIエラー (${infoRes.status})`,
      detail: 'LINE Developers でアクセストークンを再発行し、Vercelの環境変数を更新してください。',
      response: await infoRes.text(),
    })
  }

  // 直近のテイクアウト注文について、LINE IDの有無と友だち登録状況を調べる
  const supabase = createServiceRoleClient()
  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at, line_user_id')
    .eq('table_id', 'takeout')
    .order('created_at', { ascending: false })
    .limit(5)

  const recentTakeout = await Promise.all(
    (orders ?? []).map(async (order) => {
      const orderedAt = new Date(order.created_at).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
      })

      if (!order.line_user_id) {
        return {
          注文番号: orderShortId(order.id),
          注文日時: orderedAt,
          判定: 'LINE IDなし（メッセージは送られません）',
        }
      }

      // 友だちでないユーザーのプロフィールは404になる
      const profileRes = await fetch(`${LINE_API_BASE}/profile/${order.line_user_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      return {
        注文番号: orderShortId(order.id),
        注文日時: orderedAt,
        LINE_ID: maskUserId(order.line_user_id),
        判定: profileRes.ok
          ? '送信可能（友だち登録あり）'
          : profileRes.status === 404
            ? '友だち未追加またはブロック中（送信できません）'
            : `確認できず (${profileRes.status})`,
      }
    }),
  )

  return NextResponse.json({
    ok: true,
    cause: 'トークンは有効です',
    公式アカウント: (await infoRes.json()).displayName,
    直近のテイクアウト注文: recentTakeout.length ? recentTakeout : '注文がありません',
  })
}
