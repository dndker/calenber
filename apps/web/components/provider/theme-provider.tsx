"use client"

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import * as React from "react"

function ThemeColorSync() {
    const { resolvedTheme } = useTheme()

    React.useEffect(() => {
        if (!resolvedTheme) return

        const colorMap: Record<string, string> = {
            light: "#ffffff",
            dark: "#0c0d0e",
        }
        const color = colorMap[resolvedTheme] ?? "#ffffff"

        /**
         * media 쿼리가 있는 태그는 모두 제거하고 단일 태그 하나만 유지한다.
         * router.refresh() 후 Next.js가 media 배열 태그를 head에 재주입하면
         * MutationObserver가 즉시 이 함수를 다시 호출해 덮어쓴다.
         */
        const applyThemeColor = () => {
            const metas = Array.from(
                document.querySelectorAll<HTMLMetaElement>(
                    'meta[name="theme-color"]'
                )
            )

            // media 쿼리 태그는 모두 제거
            for (const meta of metas) {
                if (meta.getAttribute("media")) {
                    meta.remove()
                }
            }

            const remaining = document.querySelector<HTMLMetaElement>(
                'meta[name="theme-color"]:not([media])'
            )

            if (remaining) {
                remaining.content = color
            } else {
                const meta = document.createElement("meta")
                meta.name = "theme-color"
                meta.content = color
                document.head.appendChild(meta)
            }
        }

        applyThemeColor()

        // router.refresh() / 라우트 전환 / iOS Safari 복귀 시 Next.js가
        // head를 다시 쓰는 경우를 감지해 즉시 재적용한다.
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (
                        node instanceof HTMLMetaElement &&
                        node.name === "theme-color"
                    ) {
                        applyThemeColor()
                        return
                    }
                }
            }
        })
        observer.observe(document.head, { childList: true })

        const onVis = () => applyThemeColor()
        document.addEventListener("visibilitychange", onVis)

        return () => {
            observer.disconnect()
            document.removeEventListener("visibilitychange", onVis)
        }
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
