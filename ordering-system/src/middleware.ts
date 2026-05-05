import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'admin_auth'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ログインページ自体は保護しない
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  // /admin 以下すべてを保護
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get(COOKIE_NAME)?.value
    if (!token || token !== process.env.ADMIN_PASSWORD) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
