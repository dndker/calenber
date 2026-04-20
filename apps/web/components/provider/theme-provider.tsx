"use client"

import { usePathname } from "next/navigation"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import * as React from "react"

function ThemeColorSync() {
    const { resolvedTheme } = useTheme() // Provider 안이므로 정상 동작
    const pathname = usePathname()

    React.useEffect(() => {
        if (!resolvedTheme) return

        const colorMap: Record<string, string> = {
            light: "#ffffff",
            dark: "#0c0d0e",
        }
        const color = colorMap[resolvedTheme] || "#ffffff"

        const applyThemeColor = () => {
            const metas = Array.from(
                document.querySelectorAll<HTMLMetaElement>(
                    'meta[name="theme-color"]'
                )
            )

            if (metas.length === 0) {
                const meta = document.createElement("meta")
                meta.name = "theme-color"
                meta.content = color
                document.head.appendChild(meta)
                return
            }

            for (const meta of metas) {
                meta.content = color
            }
        }

        applyThemeColor()

        // 라우트 전환이나 iOS/Safari 복귀 시 head 메타가 다시 써지는 경우를 보정.
        const onVis = () => applyThemeColor()
        document.addEventListener("visibilitychange", onVis)
        return () => document.removeEventListener("visibilitychange", onVis)
    }, [pathname, resolvedTheme])

    return null
}

function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            {...props}
        >
            <ThemeSyncToCookie />
            <ThemeColorSync />
            <ThemeHotkey />
            {children}
        </NextThemesProvider>
    )
}

function isTypingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false
    }

    return (
        target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
    )
}

function ThemeSyncToCookie() {
    const { theme } = useTheme()

    React.useEffect(() => {
        if (!theme) return

        document.cookie = `theme=${theme}; path=/; max-age=31536000`
    }, [theme])

    return null
}

function ThemeHotkey() {
    const { resolvedTheme, setTheme } = useTheme()

    React.useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.defaultPrevented || event.repeat) {
                return
            }

            if (isTypingTarget(event.target)) {
                return
            }

            if (event.metaKey || event.ctrlKey || event.altKey) {
                return
            }

            if (typeof event.key !== "string") {
                return
            }

            if (event.key.toLowerCase() !== "d") {
                return
            }

            setTheme(resolvedTheme === "dark" ? "light" : "dark")
        }

        window.addEventListener("keydown", onKeyDown)

        return () => {
            window.removeEventListener("keydown", onKeyDown)
        }
    }, [resolvedTheme, setTheme])

    return null
}

export { ThemeProvider }
