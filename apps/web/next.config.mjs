/** @type {import('next').NextConfig} */
import path from "node:path"
import { fileURLToPath } from "node:url"
import withPWAInit from "@ducanh2912/next-pwa"
import createNextIntlPlugin from "next-intl/plugin"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** 번들마다 다른 실제 경로로 yjs가 이중 로드되는 경우 완화 (Turbopack은 상대 별칭만 안전) */
const yjsPackageDir = path.join(__dirname, "node_modules", "yjs")

export const DOCS_URL =
    process.env.NEXT_PUBLIC_DOCS_URL || "http://localhost:3001"

const withPWA = withPWAInit({
    disable: process.env.NODE_ENV !== "production",
    // register: true,
    dest: "public",
    fallbacks: {
        // document: "/~offline",
        image: "/symbol.svg",
    },
    reloadOnOnline: true,
    workboxOptions: {
        swSrc: "worker/index.ts",
    },
    // cacheOnFrontEndNav: true,
    // aggressiveFrontEndNavCaching: true,
    // customWorkerDest: "somewhere-else", // defaults to `dest`
    // customWorkerPrefix: "worker",
})

const nextConfig = {
    turbopack: {
        resolveAlias: {
            yjs: "./node_modules/yjs",
        },
    },
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            yjs: yjsPackageDir,
        }
        return config
    },
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

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts")

export default withPWA(withNextIntl(nextConfig))
