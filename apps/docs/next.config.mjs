import { createMDX } from "fumadocs-mdx/next"

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
    reactStrictMode: true,
    basePath: "/docs",
    assetPrefix: process.env.NODE_ENV === "production" ? "/docs" : undefined,
    transpilePackages: ["@workspace/ui"],
}

export default withMDX(config)
