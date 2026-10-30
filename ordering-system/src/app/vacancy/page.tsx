'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { ORDER_LIFF_ID, storageUrl } from '@/lib/types'

/** LINEで開く順番待ちの受付（店内注文のLIFFを ?wait=1 で開く）。空席状況も表示する */
const WAITLIST_URL = `https://liff.line.me/${ORDER_LIFF_ID}?wait=1`

/**
 * 空席確認
 * 順番待ちの受付画面に空席・待ち組数・呼び出し中の番号も出すため、そちらを直接開く
 * （LINEで開くので、順番が近づいたときのお知らせも届く）
 */
export default function VacancyPage() {
  useEffect(() => {
    window.location.replace(WAITLIST_URL)
  }, [])

  return (
    <div className="min-h-dvh bg-cream-50 flex flex-col items-center justify-center gap-6 px-4">
      <Image src={storageUrl('logo.png')} alt="織はや" width={120} height={48} className="object-contain h-10 w-auto" />
      <div className="w-10 h-10 border-4 border-brown-300 border-t-brown-600 rounded-full animate-spin" />
      <p className="text-brown-500 text-base">空席・順番待ちの画面を開いています...</p>
      <a href={WAITLIST_URL} className="btn-primary px-8 py-3 text-base">
        開かない場合はこちら
      </a>
    </div>
  )
}
