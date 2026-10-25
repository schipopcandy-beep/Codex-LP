import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cloud Run 用の Docker イメージを作るときだけ、必要なファイルだけを1つのフォルダにまとめる（standalone）
  // Vercel では NEXT_OUTPUT を設定しないので、これまでどおりの作り方のまま
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
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
