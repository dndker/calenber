import { execSync } from "node:child_process"

const msg = (process.env.VERCEL_GIT_COMMIT_MESSAGE || "").toLowerCase()

const skipKeywords = ["[skip]", "[wip]", "[no-deploy]"]

if (skipKeywords.some((k) => msg.includes(k))) {
    console.log("🚫 Skip build: matched keyword")
    process.exit(0)
}

/**
 * 🔥 여기부터 핵심
 */

// 현재 프로젝트가 web인지 docs인지 구분 (Vercel에서 각각 다름)
const projectName = process.env.VERCEL_PROJECT_NAME

const base = process.env.VERCEL_GIT_PREVIOUS_SHA
const head = process.env.VERCEL_GIT_COMMIT_SHA

let changedFiles = ""

try {
    changedFiles = execSync(`git diff --name-only ${base} ${head}`, {
        encoding: "utf-8",
    })
} catch (e) {
    console.log("⚠️ git diff failed, proceed build")
    process.exit(1)
}

console.log("Changed files:\n", changedFiles)

// 각 프로젝트별 허용 경로
const projectPaths = {
    "calenber-web": ["apps/web", "packages"],
    "calenber-docs": ["apps/docs", "packages"],
}

// 현재 프로젝트에 해당하는 경로
const allowedPaths = projectPaths[projectName] || []

const shouldBuild = changedFiles
    .split("\n")
    .some((file) => allowedPaths.some((p) => file.startsWith(p)))

if (!shouldBuild) {
    console.log(`🚫 Skip build: no relevant changes for ${projectName}`)
    process.exit(0)
}

console.log("✅ Proceed build")
process.exit(1)
