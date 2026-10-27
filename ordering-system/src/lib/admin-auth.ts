/**
 * 管理画面のログイン（お店用のパスワード）
 *
 * - パスワードは環境変数 ADMIN_PASSWORD（Vercel・Cloud Run の設定画面で入れる。GitHub には書かない）
 * - ログインすると、期限つきの印（クッキー）を端末に保存する。印はパスワードから作るので、
 *   パスワードを変えると全端末がログアウトする
 * - 定期実行（Vercel Cron など）は Authorization: Bearer <CRON_SECRET> で通す
 *
 * middleware（Edge）とAPI（Node.js）の両方で使うため、Web Crypto だけを使う
 */

export const ADMIN_COOKIE = 'orihaya_admin'
/** ログインしたままにする期間（秒） */
export const ADMIN_SESSION_SECONDS = 30 * 24 * 60 * 60
/** 残りがこれより短くなったら、使ったときに期限を延ばす（秒） */
const RENEW_BELOW_SECONDS = 20 * 24 * 60 * 60
/**
 * この時刻（日本時間）からパスワードが必要になる。それまではログインなしで使える（ログインしておくこともできる）
 * null ならいつも必要
 */
const ADMIN_AUTH_START: string | null = '2026-11-01T00:00:00+09:00'

/** 今、管理画面にパスワードが必要か */
export function adminAuthRequired(): boolean {
  return ADMIN_AUTH_START === null || Date.now() >= new Date(ADMIN_AUTH_START).getTime()
}

/** パスワードの最低文字数 */
export const ADMIN_PASSWORD_MIN_LENGTH = 12

/** 設定されたパスワード。未設定・短すぎるときは null（誰もログインできない） */
export function adminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD ?? ''
  return password.length >= ADMIN_PASSWORD_MIN_LENGTH ? password : null
}

async function sign(message: string, password: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`orihaya-admin:${message}`))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 2つの文字列を、かかる時間が中身によらないように比べる */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** ログインの印を作る（"期限のUNIX秒.署名"） */
export async function createAdminToken(): Promise<string | null> {
  const password = adminPassword()
  if (!password) return null
  const expires = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS
  return `${expires}.${await sign(String(expires), password)}`
}

/** ログインの印を確かめる。正しければ期限（UNIX秒）、違えば null */
export async function verifyAdminToken(token: string | undefined): Promise<number | null> {
  const password = adminPassword()
  if (!password || !token) return null
  const [expiresText, signature] = token.split('.')
  const expires = Number(expiresText)
  if (!Number.isInteger(expires) || expires < Date.now() / 1000 || !signature) return null
  return safeEqual(signature, await sign(expiresText, password)) ? expires : null
}

/** 期限を延ばしたほうがよいか */
export function shouldRenew(expires: number): boolean {
  return expires - Date.now() / 1000 < RENEW_BELOW_SECONDS
}

/** 定期実行からの呼び出しか（Authorization: Bearer <CRON_SECRET>） */
export function isCronRequest(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && !!authorization && safeEqual(authorization, `Bearer ${secret}`)
}

/** リクエストが管理者（ログイン済みの端末か定期実行）からか */
export async function isAdminRequest(req: {
  headers: Headers
  cookies: { get(name: string): { value: string } | undefined }
}): Promise<boolean> {
  if (!adminAuthRequired() || isCronRequest(req.headers.get('authorization'))) return true
  return (await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) !== null
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: ADMIN_SESSION_SECONDS,
}
