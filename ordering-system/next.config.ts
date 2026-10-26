import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cloud Run 用の Docker イメージを作るときだけ、必要なファイルだけを1つのフォルダにまとめる（standalone）
  // Vercel では NEXT_OUTPUT を設定しないので、これまでどおりの作り方のまま
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  // 安全のための通信ヘッダー（全ページ・全API）
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // ほかのサイトにこの画面を埋め込ませない（だましてボタンを押させる手口を防ぐ）
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          // ファイルの種類をブラウザに推測させない
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // ほかのサイトへ移るとき、URLのうちドメインだけを伝える（席番号などを渡さない）
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 常に https でつなぐ
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
