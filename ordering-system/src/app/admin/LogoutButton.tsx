'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="text-cream-300 hover:text-white text-sm border border-cream-400 hover:border-white rounded px-2 py-1 transition-colors"
    >
      ログアウト
    </button>
  )
}
