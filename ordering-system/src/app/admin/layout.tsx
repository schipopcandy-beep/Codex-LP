import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '管理画面 | おにぎり注文システム',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-cream-50">
      {/* 管理ナビゲーション */}
      <nav className="bg-brown-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <Link href="/admin" className="font-serif text-xl font-bold">
          🍙 管理画面
        </Link>
        <div className="flex gap-4">
          <Link
            href="/admin"
            className="text-cream-200 hover:text-white text-base font-medium transition-colors"
          >
            注文一覧
          </Link>
          <Link
            href="/admin/products"
            className="text-cream-200 hover:text-white text-base font-medium transition-colors"
          >
            商品管理
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto">
        {children}
      </div>
    </div>
  )
}
