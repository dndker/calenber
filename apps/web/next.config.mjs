/** @type {import('next').NextConfig} */

export const DOCS_URL =
    process.env.NEXT_PUBLIC_DOCS_URL || "http://localhost:3001"

const nextConfig = {
    transpilePackages: ["@workspace/ui"],
    async rewrites() {
        return [
            {
                source: "/docs",
                destination: `${DOCS_URL}/docs`,
            },
            {
                // 1. 유저가 브라우저에 입력하는 주소
                source: "/docs/:path*",
                // 2. 실제로 데이터를 가져올 주소 (3001번 포트)
                destination: `${DOCS_URL}/docs/:path*`,
            },
        ]
    },
}

export default nextConfig
