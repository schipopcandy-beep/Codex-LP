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

/** テキストメッセージを1件送信する */
export async function sendLineMessage(lineUserId: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return

  await fetch(LINE_API, {
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
}

/**
 * 友だち追加・ブロック解除後の再登録時にウェルカムメッセージを送信する
 *
 * LINEの follow イベントは「友だち追加」「ブロック後の再登録」両方で発火するため、
 * どちらのケースでも同じメッセージが届く。
 *
 * 送信内容:
 *   ① テキストメッセージ（自己紹介・できることの案内）
 *   ② ボタンテンプレート（注文・テイクアウトへの導線）
 *
 * 環境変数:
 *   NEXT_PUBLIC_LIFF_ID       - LIFF ID（必須）
 *   LINE_CHANNEL_ACCESS_TOKEN - アクセストークン（必須）
 *   NEXT_PUBLIC_APP_URL       - アプリのURL（例: https://codex-lp-k187.vercel.app）
 */
export async function sendWelcomeMessage(lineUserId: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (!token || !liffId) return

  // liff.state でパスを指定するとLIFF起動後に該当ページへ遷移する
  const liffUrl = `https://liff.line.me/${liffId}?liff.state=${encodeURIComponent('/order')}`

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
            'ご来店の際は下のボタンからご注文いただけます。',
            'またのお越しをお待ちしております😊',
          ].join('\n'),
        },
        // ② 注文導線ボタン
        {
          type: 'template',
          altText: '席での注文・テイクアウトはこちらから',
          template: {
            type: 'buttons',
            text: 'ご注文はこちらから承ります',
            actions: [
              {
                type: 'uri',
                label: '🍙 席で注文する（イートイン）',
                uri: liffUrl,
              },
              {
                type: 'uri',
                label: '📦 テイクアウトを注文する',
                uri: `${appUrl}/takeout`,
              },
            ],
          },
        },
      ],
    }),
  })
}
