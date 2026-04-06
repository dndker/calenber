/** @type {import('next').NextConfig} */
import withPWAInit from "@ducanh2912/next-pwa"

export const DOCS_URL =
    process.env.NEXT_PUBLIC_DOCS_URL || "http://localhost:3001"

const withPWA = withPWAInit({
    // disable: process.env.NODE_ENV !== "production",
    disable: false,
    // register: true,
    dest: "public",
    fallbacks: {
        // document: "/~offline",
        image: "/symbol.svg",
    },
    reloadOnOnline: true,
    customWorkerSrc: "worker",
    workboxOptions: {
        swSrc: "worker/index.ts",
    },
    // cacheOnFrontEndNav: true,
    // aggressiveFrontEndNavCaching: true,
    // customWorkerDest: "somewhere-else", // defaults to `dest`
    // customWorkerPrefix: "worker",
})

const nextConfig = {
    turbopack: {},
    compiler: {
        removeConsole:
            process.env.NODE_ENV === "production"
                ? {
                      exclude: ["error", "warn"],
                  }
                : false,
    },
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

export default withPWA(nextConfig)
