import { NextResponse } from 'next/server'

/**
 * LINE連携の状態を確認する診断用エンドポイント
 *
 * ブラウザで /api/admin/line-status を開くと、アクセストークンが
 * 有効かどうかを判定して返す。テイクアウト注文後のメッセージが
 * 届かないときに、原因がトークン側かどうかを切り分けるために使う。
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

  const res = await fetch('https://api.line.me/v2/bot/info', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.text()

  if (res.ok) {
    return NextResponse.json({
      ok: true,
      cause: 'トークンは有効です',
      detail:
        'メッセージが届かない場合、その注文にLINE IDが付いていないか、' +
        'お客様が友だち未追加・ブロック中の可能性があります。',
      bot: JSON.parse(body),
    })
  }

  return NextResponse.json({
    ok: false,
    cause: res.status === 401 ? 'トークンが無効または失効しています' : `LINE APIエラー (${res.status})`,
    detail: 'LINE Developers でアクセストークンを再発行し、Vercelの環境変数を更新してください。',
    response: body,
  })
}
