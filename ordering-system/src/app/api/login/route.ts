import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminCookieOptions, adminPassword, createAdminToken, safeEqual, ADMIN_PASSWORD_MIN_LENGTH } from '@/lib/admin-auth'

/** 続けて間違えられる回数と、超えたときにログインできない時間 */
const MAX_FAILURES = 5
const LOCK_MS = 15 * 60 * 1000

/**
 * 間違えた回数（接続元ごと）
 * サーバーのメモリに持つだけなので、サーバーが入れ替わると数え直しになる（総当たりを遅くするための目安）
 */
const failures = new Map<string, { count: number; lockedUntil: number }>()

function clientKey(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

async function digest(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 管理画面にログインする。body: { password } */
export async function POST(req: NextRequest) {
  const password = adminPassword()
  if (!password) {
    return NextResponse.json(
      { error: `管理画面のパスワードが設定されていません（${ADMIN_PASSWORD_MIN_LENGTH}文字以上で設定してください）` },
      { status: 503 },
    )
  }

  const key = clientKey(req)
  const record = failures.get(key)
  if (record && record.lockedUntil > Date.now()) {
    return NextResponse.json({ error: '何度も間違えたため、15分ほど待ってからお試しください' }, { status: 429 })
  }

  const body: { password?: unknown } = await req.json().catch(() => ({}))
  const input = typeof body.password === 'string' ? body.password : ''

  if (!safeEqual(await digest(input), await digest(password))) {
    const count = (record?.count ?? 0) + 1
    failures.set(key, { count, lockedUntil: count >= MAX_FAILURES ? Date.now() + LOCK_MS : 0 })
    // 総当たりを遅くする
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 })
  }

  failures.delete(key)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, (await createAdminToken())!, adminCookieOptions)
  return res
}
