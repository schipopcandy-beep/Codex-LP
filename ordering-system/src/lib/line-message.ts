/**
 * LINE Messaging API 共通ユーティリティ
 *
 * 使い方:
 *   import { sendLineMessage, sendWelcomeMessage } from '@/lib/line-message'
 *   await sendLineMessage(userId, 'こんにちは')
 *   await sendWelcomeMessage(userId)
 */

const LINE_API = 'https://api.line.me/v2/bot/message/push'

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
 * 友だち追加時のウェルカムメッセージを送信する
 *
 * 送信内容:
 *   ① テキストメッセージ（挨拶）
 *   ② ボタンテンプレート（LIFFへの誘導）
 *
 * 環境変数:
 *   NEXT_PUBLIC_LIFF_ID      - LIFF ID（必須）
 *   LINE_CHANNEL_ACCESS_TOKEN - アクセストークン（必須）
 *   NEXT_PUBLIC_APP_URL      - アプリのURL（例: https://codex-lp-k187.vercel.app）
 */
export async function sendWelcomeMessage(lineUserId: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (!token || !liffId) return

  // LIFF URL: テーブル選択ページ（/order）を開く
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
        // ① 挨拶テキスト
        {
          type: 'text',
          text: '友だち追加ありがとうございます！\n織はや公式アカウントです🍙\n\nご来店の際は下のボタンから注文画面を開いてください。',
        },
        // ② ボタンテンプレート（注文ボタン）
        {
          type: 'template',
          altText: '注文はこちらから',
          template: {
            type: 'buttons',
            text: 'テーブルのボタンから席を選んで注文できます',
            actions: [
              {
                type: 'uri',
                label: '🍙 席で注文する',
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
