import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminCookieOptions } from '@/lib/admin-auth'

/** 管理画面からログアウトする（この端末のログインの印を消す） */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', { ...adminCookieOptions, maxAge: 0 })
  return res
}
