"use client"

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import * as React from "react"

function ThemeColorSync() {
    const { resolvedTheme } = useTheme() // Provider 안이므로 정상 동작

    React.useEffect(() => {
        if (!resolvedTheme) return

        // meta[name="theme-color"] 확보
        let meta = document.querySelector<HTMLMetaElement>(
            'meta[name="theme-color"]'
        )
        if (!meta) {
            meta = document.createElement("meta")
            meta.name = "theme-color"
            document.head.appendChild(meta)
        }

        // 테마별 색상
        const colorMap: Record<string, string> = {
            light: "#ffffff",
            dark: "#0c0d0e",
        }

        meta.content = colorMap[resolvedTheme] || "#ffffff"

        // iOS/Safari가 가끔 복귀 시 초기화하는 문제 대응(선택)
        const onVis = () =>
            (meta!.content = colorMap[resolvedTheme] || "#ffffff")
        document.addEventListener("visibilitychange", onVis)
        return () => document.removeEventListener("visibilitychange", onVis)
    }, [resolvedTheme])

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
    const { resolvedTheme } = useTheme()

    React.useEffect(() => {
        if (!resolvedTheme) return

        document.cookie = `theme=${resolvedTheme}; path=/; max-age=31536000`
    }, [resolvedTheme])

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
