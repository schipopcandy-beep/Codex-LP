import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminCookieOptions, createAdminToken, isCronRequest, shouldRenew, verifyAdminToken } from '@/lib/admin-auth'

/**
 * 管理画面（/admin）と管理用API（/api/admin）は、ログインした端末と定期実行だけが使える
 * ログインしていなければ、画面はログイン画面へ、APIは 401 を返す
 */
export async function middleware(req: NextRequest) {
  if (isCronRequest(req.headers.get('authorization'))) return NextResponse.next()

  const expires = await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
  if (expires === null) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })
    }
    const login = new URL('/login', req.url)
    login.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(login)
  }

  // 使っている端末は、ログインしたままにする期間を延ばす
  const res = NextResponse.next()
  if (shouldRenew(expires)) {
    const token = await createAdminToken()
    if (token) res.cookies.set(ADMIN_COOKIE, token, adminCookieOptions)
  }
  return res
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
