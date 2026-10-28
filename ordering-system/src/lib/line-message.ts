/**
 * LINE Messaging API 共通ユーティリティ
 *
 * 使い方:
 *   import { sendLineMessage, sendWelcomeMessage } from '@/lib/line-message'
 *   await sendLineMessage(userId, 'こんにちは')
 *   await sendWelcomeMessage(userId)
 */

const LINE_API = 'https://api.line.me/v2/bot/message/push'
const LINE_REPLY_API = 'https://api.line.me/v2/bot/message/reply'

/** reply token を使ってテキストメッセージを返信する（push と違い無料・即時） */
export async function replyLineMessage(replyToken: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return

  await fetch(LINE_REPLY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
}

/**
 * テキストメッセージを1件送信する
 *
 * LINE APIは送信できない場合でもHTTPエラーを返すだけなので、
 * 原因（トークン切れ・友だち未追加など）がログに残るようにしている。
 * 送信できた場合は true を返す。
 */
export async function sendLineMessage(lineUserId: string, text: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.error('LINE送信スキップ: LINE_CHANNEL_ACCESS_TOKEN が未設定です')
    return false
  }

  const res = await fetch(LINE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    }),
  })

  if (!res.ok) {
    // 401/403: トークン不正・失効 / 400: 友だち未追加やブロックなど
    const detail = await res.text().catch(() => '')
    console.error(`LINE送信失敗 status=${res.status} user=${lineUserId} body=${detail}`)
    return false
  }

  return true
}

/**
 * お店のLINEの友だちか（ブロックされていないか）
 * プロフィールが取れれば友だち。取れない（404）なら、友だちでないかブロックされている。
 * トークンがない・LINEの障害など確かめられないときは null（注文を止めないため、呼ぶ側で通す）
 */
export async function isLineFriend(lineUserId: string): Promise<boolean | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return null
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return true
    if (res.status === 404 || res.status === 400) return false
    console.error(`友だちの確認に失敗 status=${res.status}`)
    return null
  } catch (err) {
    console.error('友だちの確認に失敗:', err)
    return null
  }
}

/** お店のLINEを友だち追加するURL（一度取れたらサーバーで覚えておく） */
let addFriendUrlCache: string | null = null
export async function getAddFriendUrl(): Promise<string | null> {
  if (addFriendUrlCache) return addFriendUrlCache
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return null
  try {
    const res = await fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    const { basicId } = (await res.json()) as { basicId?: string }
    if (!basicId) return null
    addFriendUrlCache = `https://line.me/R/ti/p/${encodeURIComponent(basicId)}`
    return addFriendUrlCache
  } catch {
    return null
  }
}

/**
 * 友だち追加・ブロック解除後の再登録時にウェルカムメッセージを送信する
 *
 * LINEの follow イベントは「友だち追加」「ブロック後の再登録」両方で発火するため、
 * どちらのケースでも同じメッセージが届く。
 *
 * 送信内容:
 *   ① テキストメッセージ（自己紹介・できることの案内）
 *   ② ボタンテンプレート（テイクアウトへの導線。店内注文はお席のQRコードから）
 *
 * 環境変数:
 *   NEXT_PUBLIC_LIFF_ID       - テイクアウト用LIFFのID（必須。エンドポイントは /takeout）
 *   LINE_CHANNEL_ACCESS_TOKEN - アクセストークン（必須）
 */
export async function sendWelcomeMessage(lineUserId: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID

  if (!token || !liffId) return

  // テイクアウトはLIFFとして開く。LINEアプリが毎回ログイン情報を渡すため、
  // ブラウザに保存したログインの期限切れで読み込みが止まることがない
  const takeoutUrl = `https://liff.line.me/${liffId}`

  await fetch(LINE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [
        // ① 自己紹介テキスト
        {
          type: 'text',
          text: [
            '織はや公式LINEへようこそ！🍙',
            '',
            '仙台のおにぎり専門店「織はや」です。',
            '東北のブランド米・金印海苔・こだわりの味噌など、',
            '素材にこだわったおにぎりをご用意してお待ちしております。',
            '',
            'このアカウントでは',
            '・新商品・季節のおすすめ情報',
            '・イベント・お知らせ',
            'などをお届けします🌸',
            '',
            '店内でのご注文は、各お席のQRコードからどうぞ。',
            'テイクアウトは下のボタンからご注文いただけます。',
            'またのお越しをお待ちしております😊',
          ].join('\n'),
        },
        // ② 注文導線ボタン
        {
          type: 'template',
          altText: 'テイクアウトのご注文はこちらから',
          template: {
            type: 'buttons',
            text: 'テイクアウトのご注文はこちらから承ります',
            // 店内注文は他の卓を選べないよう、お席のQRコードからに限っている
            actions: [
              {
                type: 'uri',
                label: '📦 テイクアウトを注文する',
                uri: takeoutUrl,
              },
            ],
          },
        },
      ],
    }),
  })
}
