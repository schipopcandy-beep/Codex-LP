'use client'

/** 管理画面からログアウトする（この端末だけ） */
export default function LogoutButton() {
  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {})
    window.location.href = '/login'
  }
  return (
    <button type="button" onClick={logout} className="text-cream-200 hover:text-white text-sm font-medium transition-colors">
      ログアウト
    </button>
  )
}
