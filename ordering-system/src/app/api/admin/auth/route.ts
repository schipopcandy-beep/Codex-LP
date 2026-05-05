import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'admin_auth'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7日間

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD が未設定です' }, { status: 500 })
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE_NAME, password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}
