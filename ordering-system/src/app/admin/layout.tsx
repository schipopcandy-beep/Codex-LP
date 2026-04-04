import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { storageUrl } from '@/lib/types'

export const metadata: Metadata = {
  title: '管理画面 | 織はや',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream-50">
      <nav className="bg-brown-700 text-white px-4 py-2 flex items-center justify-between shadow-md">
        <Link href="/admin" className="flex items-center">
          <Image
            src={storageUrl('織はやロゴ.png')}
            alt="織はや"
            width={100}
            height={40}
            className="object-contain h-9 w-auto brightness-0 invert"
          />
        </Link>
        <div className="flex gap-4">
          <Link href="/admin" className="text-cream-200 hover:text-white text-base font-medium transition-colors">
            注文一覧
          </Link>
          <Link href="/admin/products" className="text-cream-200 hover:text-white text-base font-medium transition-colors">
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
