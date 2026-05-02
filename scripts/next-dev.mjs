import { spawn } from "node:child_process"

const args = ["dev", "-p", "3000"]
const platform = process.platform
const turbopackEnv = process.env.NEXT_DEV_USE_TURBOPACK

const shouldUseTurbopack =
    turbopackEnv === "1" ||
    (turbopackEnv !== "0" && platform !== "win32")

if (shouldUseTurbopack) {
    args.push("--turbopack")
}

const child = spawn(
    process.execPath,
    ["./node_modules/next/dist/bin/next", ...args],
    {
        stdio: "inherit",
        shell: false,
    }
)

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal)
        return
    }

    process.exit(code ?? 0)
})

