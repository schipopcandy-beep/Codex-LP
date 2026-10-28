import { NextResponse } from 'next/server'
import { getAddFriendUrl } from '@/lib/line-message'

/** お店のLINEを友だち追加するURL（テイクアウト予約の前に案内する） */
export async function GET() {
  return NextResponse.json({ url: await getAddFriendUrl() })
}
